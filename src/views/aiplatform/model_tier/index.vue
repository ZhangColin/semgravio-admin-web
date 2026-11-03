<script setup lang="tsx">
/**
 * AI 平台模型档位页（#90，#80 B 批 T2）——语义键档位维护工作台。
 *
 * 档位＝绑定引用腿（agent-configs 的 modelId 即语义键）：升模型版本/换供应商＝改档位行指向
 * （providerKey/modelName 终态替换）而全部绑定自动跟上——本页即该维护入口。列表 NDataTable
 * **无分页**（有界目录全量直灌，技能页先例）——tierKey(mono)/providerKey/modelName(mono)/
 * displayName（null 回落 tierKey 灰显）/enabled tag/最近写者。停用＝不可作新绑定、既有引用
 * 保留（临时下线用停用不删行——表单与删除确认文案随注）；删除被绑定引用 409 PRJ_073 透传。
 * 留痕时间倒序跨行存活（入口挂行、行删入口自然消失）；per-trace 回滚＝打开预填表单非直接
 * PUT：行在＝编辑预填旧值、行已删＝创建按旧值预填重建。写回执不消费——toast＋刷新。
 */
import { computed, ref } from 'vue';
import { NButton, NDropdown, NTag } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import { modelTierWriteAuth } from '@/constants/aiplatform';
import { fetchDeleteAiplatformModelTier, fetchGetAiplatformModelTierList } from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useNaiveTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import TierFormModal from './modules/tier-form-modal.vue';
import TierTracesDrawer from './modules/tier-traces-drawer.vue';

defineOptions({ name: 'AiplatformModelTier' });

const appStore = useAppStore();
const { hasAuth } = useAuth();

/** 清单无分页（有界目录）——useNaiveTable 非分页形：全量数组直灌，flex-height + sm:h-full。 */
const { columns, columnChecks, data, getData, loading, scrollX } = useNaiveTable({
  api: () => fetchGetAiplatformModelTierList(),
  transform: response => (response.error ? [] : response.data),
  columns: () => [
    {
      key: 'tierKey',
      title: $t('page.aiplatform.modelTier.tierKey'),
      align: 'center',
      width: 160,
      render: row => <span class="font-mono">{row.tierKey}</span>
    },
    {
      key: 'providerKey',
      title: $t('page.aiplatform.modelTier.providerKey'),
      align: 'center',
      width: 130,
      render: row => row.providerKey
    },
    {
      key: 'modelName',
      title: $t('page.aiplatform.modelTier.modelName'),
      align: 'center',
      minWidth: 240,
      ellipsis: { tooltip: true },
      render: row => <span class="font-mono">{row.modelName}</span>
    },
    {
      // null＝回落 tierKey 展示（灰显区分「未设显示名」与显式命名——清空回落是显式特性）
      key: 'displayName',
      title: $t('page.aiplatform.modelTier.displayName'),
      align: 'center',
      minWidth: 140,
      ellipsis: { tooltip: true },
      render: row =>
        row.displayName ? row.displayName : (
          <span class="text-gray-400" title={$t('page.aiplatform.modelTier.displayNameFallback')}>
            {row.tierKey}
          </span>
        )
    },
    {
      key: 'enabled',
      title: $t('page.aiplatform.modelTier.enabled'),
      align: 'center',
      width: 90,
      render: row => (
        <NTag type={row.enabled ? 'success' : 'default'} size="small">
          {row.enabled ? $t('page.aiplatform.modelTier.enabledOn') : $t('page.aiplatform.modelTier.enabledOff')}
        </NTag>
      )
    },
    {
      // 种子/迁移写入 null → '-'（技能/单价表 operator 先例）
      key: 'operator',
      title: $t('page.aiplatform.modelTier.lastWrite'),
      align: 'center',
      width: 120,
      render: row => row.operatorName ?? '-'
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      fixed: 'right',
      render: row => {
        const opts = rowOptions();
        return (
          <div class="flex-center gap-8px whitespace-nowrap">
            {opts.length > 0 && (
              <NDropdown trigger="click" options={opts} onSelect={key => onRowAction(row, key as RowAction)}>
                <NButton size="small">{$t('page.aiplatform.modelTier.more')}</NButton>
              </NDropdown>
            )}
          </div>
        );
      }
    }
  ]
});

/** 表单预填形（行现值或留痕旧值快照共用——回滚/编辑两入口同形）。 */
interface TierPrefill {
  providerKey: string;
  modelName: string;
  displayName: string | null;
  enabled: boolean;
}

/* ---- 创建/更新共用弹窗（三肢终态替换＋enabled 显式传；回滚两路预填） ---- */
const formModalVisible = ref(false);
const formMode = ref<'create' | 'update'>('create');
const formTarget = ref<{ tierKey: string } | null>(null);
const formPrefill = ref<TierPrefill | null>(null);

function openCreate(prefill?: TierPrefill & { tierKey: string }) {
  formMode.value = 'create';
  // 回滚·行已删路：按留痕旧值预填重建（tierKey 亦来自痕主体）
  formTarget.value = prefill ? { tierKey: prefill.tierKey } : null;
  formPrefill.value = prefill ?? null;
  formModalVisible.value = true;
}

function openUpdate(row: Api.Aiplatform.ModelTier, prefill?: TierPrefill) {
  formMode.value = 'update';
  // 预填源：行现值（编辑）或留痕旧值快照（回滚·行在路）
  formTarget.value = { tierKey: row.tierKey };
  formPrefill.value = prefill ?? {
    providerKey: row.providerKey,
    modelName: row.modelName,
    displayName: row.displayName,
    enabled: row.enabled
  };
  formModalVisible.value = true;
}

/* ---- 变更留痕抽屉（时间倒序；跨行存活零特判——入口挂行、行删入口自然消失） ---- */
const tracesVisible = ref(false);
const tracesTarget = ref<Api.Aiplatform.ModelTier | null>(null);
const tracesDrawerRef = ref<InstanceType<typeof TierTracesDrawer> | null>(null);

/** 留痕主体在清单现值中的行（null＝行已删）——回滚 PUT/POST 分流与逐码门控共用同一事实源。 */
const tracesCurrentRow = computed(
  () => data.value.find(item => item.tierKey === tracesTarget.value?.tierKey) ?? null
);

function openTraces(row: Api.Aiplatform.ModelTier) {
  tracesTarget.value = row;
  tracesVisible.value = true;
}

/**
 * 留痕回滚＝打开预填表单（非直接 PUT）：按该痕 old* 快照预填；**行在＝编辑预填旧值、行已删＝
 * 创建按旧值预填重建**（皆一次新变更、将留新痕）。行存在性按清单现值判——drawer 开着时行被
 * 删（留痕跨行存活仍可读）即自然落重建路，零特判。档位域无 apiKey 肢，旧值四件全可恢复。
 */
function handleTraceRollback(trace: Api.Aiplatform.ModelTierTrace) {
  if (!tracesTarget.value) return;
  const tierKey = tracesTarget.value.tierKey;
  const prefill: TierPrefill = {
    providerKey: trace.oldProviderKey ?? '',
    modelName: trace.oldModelName ?? '',
    displayName: trace.oldDisplayName,
    enabled: trace.oldEnabled ?? true
  };
  const row = tracesCurrentRow.value;
  if (row) openUpdate(row, prefill);
  else openCreate({ tierKey, ...prefill });
}

/** 行动作键（两写＋留痕读动作）。 */
type RowAction = 'edit' | 'delete' | 'traces';

/**
 * 行下拉选项矩阵：编辑/删除逐码 hasAuth（读写分权）；留痕是读动作不门控——页面已挂
 * model-tier:read（技能页先例）。
 */
function rowOptions(): DropdownOption[] {
  const opts: DropdownOption[] = [];
  if (hasAuth(modelTierWriteAuth.update)) {
    opts.push({ key: 'edit', label: $t('page.aiplatform.modelTier.edit') });
  }
  if (hasAuth(modelTierWriteAuth.delete)) {
    opts.push({ key: 'delete', label: $t('page.aiplatform.modelTier.remove') });
  }
  opts.push({ key: 'traces', label: $t('page.aiplatform.modelTier.traces') });
  return opts;
}

function onRowAction(row: Api.Aiplatform.ModelTier, action: RowAction) {
  if (action === 'edit') openUpdate(row);
  else if (action === 'traces') openTraces(row);
  else handleDelete(row);
}

/**
 * 删除：$dialog.warning 二次确认（键名对账＋「临时下线用停用」指路）→ DELETE；被绑定引用
 * 409 PRJ_073 走 onError 透传 toast（先改绑或清空绑定再删，指路在 message 原文），行留列
 * 不吞；删成 toast＋刷新（DELETE 回执 data＝null，信封即回执）＋留痕抽屉开着同步回读
 * （删除痕入列——跨行存活回滚重建的入口即在此）。删除痕 new 全 null。
 */
function handleDelete(row: Api.Aiplatform.ModelTier) {
  window.$dialog?.warning({
    title: $t('page.aiplatform.modelTier.confirm.delete'),
    content: $t('page.aiplatform.modelTier.confirm.deleteTip', { tierKey: row.tierKey }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchDeleteAiplatformModelTier(row.tierKey);
      if (!error) {
        // 同步移除本地行：tracesCurrentRow 立即转 null，删除痕先回读时回滚也必走创建/POST，
        // 不被清单请求延迟误导成 PUT（权限门控同源切换）；随后再回读服务端对账。
        data.value = data.value.filter(item => item.tierKey !== row.tierKey);
        window.$message?.success($t('page.aiplatform.modelTier.success.delete'));
        getData();
        if (tracesVisible.value) {
          tracesDrawerRef.value?.reload();
        }
      }
    }
  });
}

/** 写成功统一收口：toast（回执行不消费）＋清单刷新；留痕抽屉开着则同步回读（modal 叠 drawer）。 */
function handleFormSuccess(mode: 'create' | 'update') {
  window.$message?.success($t(`page.aiplatform.modelTier.success.${mode}`));
  getData();
  if (tracesVisible.value) {
    tracesDrawerRef.value?.reload();
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.aiplatform.modelTier.title')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <div class="flex items-center gap-8px">
          <!-- 创建入口（hasAuth create 门控；技能页安装钮先例） -->
          <NButton v-if="hasAuth(modelTierWriteAuth.create)" type="primary" size="small" @click="openCreate()">
            {{ $t('page.aiplatform.modelTier.create') }}
          </NButton>
          <TableHeaderOperation
            v-model:columns="columnChecks"
            :hide-add="true"
            :hide-delete="true"
            :loading="loading"
            @refresh="getData"
          />
        </div>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        class="sm:h-full"
        :scroll-x="scrollX"
        :loading="loading"
      />
    </NCard>

    <!-- 创建/更新共用弹窗（三肢终态替换；回滚两路按 target/prefill 预填） -->
    <TierFormModal v-model:visible="formModalVisible" :mode="formMode" :target="formTarget" :prefill="formPrefill" @success="handleFormSuccess" />

    <!-- 变更留痕抽屉（时间倒序、跨行存活；回滚 emit 回本页按行在/行删分流预填表单） -->
    <TierTracesDrawer
      ref="tracesDrawerRef"
      v-model:visible="tracesVisible"
      :tier="tracesTarget"
      :row-exists="tracesCurrentRow !== null"
      @rollback="handleTraceRollback"
    />
  </div>
</template>
