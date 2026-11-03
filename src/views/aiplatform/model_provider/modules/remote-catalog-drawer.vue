<script setup lang="tsx">
/**
 * 远端模型清单对照抽屉（#88）——行动作「拉取清单」的承载面：POST /{providerKey}/remote-models
 * **每次全量真拉无缓存**（手动同步——重开即再拉；loading 诚实），失败明确错误态＋重试入口
 * **不静默兜底空清单**（502 PRJ_077 / key 空 400 PRJ_076 走 onError 透传 toast）。
 *
 * 对照目录两区块：条目表（modelId mono／展示名／status **如实转述**——null/空＝活跃、其余
 * 原文；trackedTierKeys 空＝「建议入库」可勾选，非空＝已入库档位键直读不可勾）；staleTiers
 * 「已过时档位」区块（库内指向远端已无——过时判据 modelName 直读，升版/改指向前处置）。
 *
 * 入库＝**drawer 内嵌轻量表单**（勾选＋行内语义键输入 → 直接建档位，不跨页跳转）：复用档位
 * 创建写口 POST /model-tiers（providerKey＝本通道、modelName 预填所选 modelId、displayName/
 * enabled 留空走缺省——hasAuth model-tier:create 跨域码门控）。逐条顺序创建：成功条目本地
 * 转「已入库」态（trackedTierKeys 补键）、失败条目留勾选可修正重试；回执不消费——toast＋
 * 本地对照态更新（重拉目录即服务端事实）。
 */
import { computed, ref, watch } from 'vue';
import { NAlert, NButton, NCheckbox, NInput, NSpin, NTag } from 'naive-ui';
import type { DataTableColumn } from 'naive-ui';
import { MODEL_TIER_CREATE_AUTH } from '@/constants/aiplatform';
import { fetchCreateAiplatformModelTier, fetchPullAiplatformRemoteModels } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/common';

defineOptions({ name: 'RemoteCatalogDrawer' });

const props = defineProps<{
  /** 拉取目标通道（providerKey 寻址）。 */
  provider: Api.Aiplatform.ModelProvider | null;
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { hasAuth } = useAuth();

const loading = ref(false);
const pullFailed = ref(false);
const catalog = ref<Api.Aiplatform.RemoteModelCatalog | null>(null);

/* ---- 内嵌入库轻量表单态：勾选集＋行内语义键输入（modelId 键控） ---- */
const checkedModelIds = ref<string[]>([]);
const tierKeyInputs = ref<Record<string, string>>({});
const ingesting = ref(false);

/** 拉取（每次真拉无缓存）：失败置错误态——onError 已透传 toast，本面给重试入口不兜底空表。 */
async function pull() {
  if (!props.provider) return;
  loading.value = true;
  pullFailed.value = false;
  catalog.value = null;
  const { data, error } = await fetchPullAiplatformRemoteModels(props.provider.providerKey);
  loading.value = false;
  if (!error && data) catalog.value = data;
  else pullFailed.value = true;
}

watch(visible, val => {
  if (!val) return;
  checkedModelIds.value = [];
  tierKeyInputs.value = {};
  pull();
});

/** 条目是否建议入库（trackedTierKeys 空＝远端有库里无）。 */
function isSuggested(entry: Api.Aiplatform.RemoteModelEntry): boolean {
  return entry.trackedTierKeys.length === 0;
}

/** 勾选目标须语义键已填（空键不入库——提交归一 trim；批量全填才放开确认）。 */
const canIngest = computed(
  () =>
    checkedModelIds.value.length > 0 &&
    checkedModelIds.value.every(id => (tierKeyInputs.value[id] ?? '').trim().length > 0)
);

/**
 * 逐条顺序入库（回执不消费）：成功＝条目本地转已入库态（trackedTierKeys 补键、清输入、出勾选集）
 * ＋toast 计数；失败＝该条留勾选可修正重试（onError 已透传——409 PRJ_068 撞名/400 PRJ_071 等）。
 */
async function handleIngest() {
  if (!canIngest.value || !props.provider || !catalog.value) return;
  ingesting.value = true;
  const providerKey = props.provider.providerKey;
  const targets = catalog.value.remoteModels.filter(entry => checkedModelIds.value.includes(entry.modelId));
  let done = 0;
  for (const entry of targets) {
    const tierKey = (tierKeyInputs.value[entry.modelId] ?? '').trim();
    const { error } = await fetchCreateAiplatformModelTier({
      tierKey,
      providerKey,
      modelName: entry.modelId,
      displayName: null,
      enabled: null
    });
    if (error) continue;
    done += 1;
    entry.trackedTierKeys.push(tierKey);
    // 已入库条目清输入态（置空等价删除——读路径 ?? '' 兜底，避动态 delete）
    tierKeyInputs.value[entry.modelId] = '';
    checkedModelIds.value = checkedModelIds.value.filter(id => id !== entry.modelId);
  }
  ingesting.value = false;
  if (done > 0) {
    window.$message?.success($t('page.aiplatform.modelProvider.catalogDrawer.ingestSuccess', { count: done }));
  }
}

/** 勾选切换（建议行可勾；已入库行 checkbox 不渲染）。 */
function toggleCheck(modelId: string, checked: boolean) {
  checkedModelIds.value = checked ? [...checkedModelIds.value, modelId] : checkedModelIds.value.filter(id => id !== modelId);
}

/** 条目表 row-key（modelId 寻址——模板内联箭头函数引用 Api 命名空间会触发 vue/no-undef-properties）。 */
function entryRowKey(row: Api.Aiplatform.RemoteModelEntry): string {
  return row.modelId;
}

const entryColumns = computed<DataTableColumn<Api.Aiplatform.RemoteModelEntry>[]>(() => [
  {
    title: $t('page.aiplatform.modelProvider.catalogDrawer.modelId'),
    key: 'modelId',
    align: 'center',
    width: 240,
    render: (row: Api.Aiplatform.RemoteModelEntry) => <span class="break-all font-mono">{row.modelId}</span>
  },
  {
    title: $t('page.aiplatform.modelProvider.catalogDrawer.name'),
    key: 'name',
    align: 'center',
    width: 150,
    render: (row: Api.Aiplatform.RemoteModelEntry) => row.name ?? '—'
  },
  {
    // status 如实转述：null/空＝活跃（方舟口径），其余原文直读不代拍
    title: $t('page.aiplatform.modelProvider.catalogDrawer.status'),
    key: 'status',
    align: 'center',
    width: 110,
    render: (row: Api.Aiplatform.RemoteModelEntry) =>
      row.status ? <NTag size="small">{row.status}</NTag> : <NTag size="small" type="success">{$t('page.aiplatform.modelProvider.catalogDrawer.statusActive')}</NTag>
  },
  {
    title: $t('page.aiplatform.modelProvider.catalogDrawer.domain'),
    key: 'domain',
    align: 'center',
    width: 100,
    render: (row: Api.Aiplatform.RemoteModelEntry) => row.domain ?? '—'
  },
  {
    title: $t('page.aiplatform.modelProvider.catalogDrawer.tracked'),
    key: 'trackedTierKeys',
    align: 'center',
    minWidth: 150,
    render: (row: Api.Aiplatform.RemoteModelEntry) =>
      isSuggested(row) ? (
        <NTag size="small" type="info">
          {$t('page.aiplatform.modelProvider.catalogDrawer.suggestTag')}
        </NTag>
      ) : (
        <span class="break-all font-mono">{row.trackedTierKeys.join('、')}</span>
      )
  },
  {
    // 勾选＋行内语义键输入（建议行专用）——入库轻量表单本体；已入库行占位
    title: $t('page.aiplatform.modelProvider.catalogDrawer.ingestColumn'),
    key: 'ingest',
    align: 'center',
    width: 220,
    render: (row: Api.Aiplatform.RemoteModelEntry) =>
      isSuggested(row) ? (
        <div class="flex-center gap-8px">
          <NCheckbox
            checked={checkedModelIds.value.includes(row.modelId)}
            onUpdate:checked={(v: boolean) => toggleCheck(row.modelId, v)}
          />
          <NInput
            value={tierKeyInputs.value[row.modelId] ?? ''}
            onUpdate:value={(v: string) => (tierKeyInputs.value[row.modelId] = v)}
            size="small"
            placeholder={$t('page.aiplatform.modelProvider.catalogDrawer.tierKeyPlaceholder')}
          />
        </div>
      ) : (
        <span class="text-gray-400">—</span>
      )
  }
]);
</script>

<template>
  <NDrawer v-model:show="visible" :width="980">
    <NDrawerContent :title="$t('page.aiplatform.modelProvider.catalogDrawer.title')" closable>
      <!-- 拉取中：loading 诚实（真拉走网络可慢） -->
      <div v-if="loading" class="flex-center min-h-300px">
        <NSpin />
      </div>
      <!-- 失败：错误态＋重试——不静默兜底空条目表（PRJ_077/076 已透传 toast） -->
      <div v-else-if="pullFailed" class="flex-col-center gap-12px min-h-300px">
        <NAlert type="error" :show-icon="false">{{ $t('page.aiplatform.modelProvider.catalogDrawer.errorState') }}</NAlert>
        <NButton size="small" @click="pull">{{ $t('page.aiplatform.modelProvider.catalogDrawer.retry') }}</NButton>
      </div>
      <template v-else-if="catalog">
        <div class="pb-8px text-12px text-gray-400">
          {{ $t('page.aiplatform.modelProvider.catalogDrawer.providerLine', { providerKey: catalog.providerKey }) }}
          · {{ $t('page.aiplatform.modelProvider.catalogDrawer.pulledAt') }} {{ formatDateTime(catalog.pulledAt) }}
        </div>
        <NDataTable
          :columns="entryColumns"
          :data="catalog.remoteModels"
          size="small"
          :scroll-x="980"
          :row-key="entryRowKey"
        />
        <!-- staleTiers「已过时」区块：库内指向远端已无（升模型版本/改档位指向后自然消除） -->
        <template v-if="catalog.staleTiers.length">
          <div class="mt-16px mb-8px flex items-center gap-8px">
            <span class="font-500">{{ $t('page.aiplatform.modelProvider.catalogDrawer.staleTitle') }}</span>
            <span class="text-12px text-gray-400">{{ $t('page.aiplatform.modelProvider.catalogDrawer.staleHint') }}</span>
          </div>
          <div
            v-for="tier in catalog.staleTiers"
            :key="tier.tierKey"
            class="flex items-center gap-12px rounded-4px border border-gray-200 px-12px py-6px dark:border-gray-700"
          >
            <span class="font-mono">{{ tier.tierKey }}</span>
            <span class="break-all font-mono text-12px text-gray-400">{{ tier.modelName }}</span>
            <NTag size="small" :type="tier.enabled ? 'success' : 'default'">
              {{ tier.enabled ? $t('page.aiplatform.modelProvider.enabledOn') : $t('page.aiplatform.modelProvider.enabledOff') }}
            </NTag>
          </div>
        </template>
      </template>
      <div v-else class="flex-center min-h-300px text-14px text-gray-400">
        {{ $t('page.aiplatform.modelProvider.catalogDrawer.empty') }}
      </div>
      <template #footer>
        <!-- 入库＝drawer 内嵌轻量表单收口（跨域码门控；勾选全填语义键才放开）——不跨页跳转 -->
        <NButton
          v-if="hasAuth(MODEL_TIER_CREATE_AUTH) && catalog && !pullFailed && !loading"
          type="primary"
          size="small"
          :disabled="!canIngest"
          :loading="ingesting"
          @click="handleIngest"
        >
          {{ $t('page.aiplatform.modelProvider.catalogDrawer.ingest', { count: checkedModelIds.length }) }}
        </NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
