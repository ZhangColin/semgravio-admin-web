<script setup lang="tsx">
/**
 * AI 平台模型供应商页（#88，#80 B 批 T1）——模型接入通道维护工作台。
 *
 * 列表 NDataTable **无分页**（有界目录全量直灌，技能页先例）——providerKey(mono)/baseUrl/
 * apiKeyMasked（掩码尾 4 位；null＝未配置「—」——读面零明文 key，铁律）/enabled tag/最近写者。
 * 通道 CRUD（创建 modal＝apiKey 明文唯一写口；更新 modal 缺省肢保持）＋远端清单拉取对照
 * （勾选入库＝drawer 内嵌轻量表单，复用档位创建写口）＋变更留痕（时间倒序、apiKey 快照恒掩码、
 * per-trace 回滚＝打开预填表单非直接 PUT）。写回执不消费——toast＋刷新；错误信封透传不判码。
 */
import { ref } from 'vue';
import { NButton, NDropdown, NTag } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import { modelProviderWriteAuth } from '@/constants/aiplatform';
import { fetchDeleteAiplatformModelProvider, fetchGetAiplatformModelProviderList } from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useNaiveTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ProviderFormModal from './modules/provider-form-modal.vue';
import RemoteCatalogDrawer from './modules/remote-catalog-drawer.vue';
import ProviderTracesDrawer from './modules/provider-traces-drawer.vue';

defineOptions({ name: 'AiplatformModelProvider' });

const appStore = useAppStore();
const { hasAuth } = useAuth();

/** 清单无分页（有界目录）——useNaiveTable 非分页形：全量数组直灌，flex-height + sm:h-full。 */
const { columns, columnChecks, data, getData, loading, scrollX } = useNaiveTable({
  api: () => fetchGetAiplatformModelProviderList(),
  transform: response => (response.error ? [] : response.data),
  columns: () => [
    {
      key: 'providerKey',
      title: $t('page.aiplatform.modelProvider.providerKey'),
      align: 'center',
      width: 140,
      render: row => <span class="font-mono">{row.providerKey}</span>
    },
    {
      key: 'baseUrl',
      title: $t('page.aiplatform.modelProvider.baseUrl'),
      align: 'center',
      minWidth: 260,
      ellipsis: { tooltip: true },
      render: row => row.baseUrl
    },
    {
      // 掩码尾 4 位 mono；null＝未配置「—」（写面唯一明文口在创建/更新表单——读面零明文铁律）
      key: 'apiKeyMasked',
      title: $t('page.aiplatform.modelProvider.apiKeyMasked'),
      align: 'center',
      width: 140,
      render: row => (row.apiKeyMasked ? <span class="font-mono">{row.apiKeyMasked}</span> : <span class="text-gray-400">—</span>)
    },
    {
      key: 'enabled',
      title: $t('page.aiplatform.modelProvider.enabled'),
      align: 'center',
      width: 90,
      render: row => (
        <NTag type={row.enabled ? 'success' : 'default'} size="small">
          {row.enabled ? $t('page.aiplatform.modelProvider.enabledOn') : $t('page.aiplatform.modelProvider.enabledOff')}
        </NTag>
      )
    },
    {
      // 种子/迁移写入 null → '-'（技能/单价表 operator 先例）
      key: 'operator',
      title: $t('page.aiplatform.modelProvider.lastWrite'),
      align: 'center',
      width: 120,
      render: row => row.operatorName ?? '-'
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 230,
      fixed: 'right',
      render: row => {
        const opts = rowOptions();
        return (
          <div class="flex-center gap-8px whitespace-nowrap">
            {/* 拉取清单＝行动作（POST 真拉无缓存；读动作不逐码门控——页面已挂 read） */}
            <NButton type="primary" ghost size="small" onClick={() => openCatalog(row)}>
              {$t('page.aiplatform.modelProvider.pull')}
            </NButton>
            {opts.length > 0 && (
              <NDropdown trigger="click" options={opts} onSelect={key => onRowAction(row, key as RowAction)}>
                <NButton size="small">{$t('page.aiplatform.modelProvider.more')}</NButton>
              </NDropdown>
            )}
          </div>
        );
      }
    }
  ]
});

/* ---- 创建/更新共用弹窗（apiKey 全量明文＝写面唯一明文口；回滚入口传留痕旧值预填） ---- */
const formModalVisible = ref(false);
const formMode = ref<'create' | 'update'>('create');
const formTarget = ref<{ providerKey: string; baseUrl: string; enabled: boolean } | null>(null);

function openCreate() {
  formMode.value = 'create';
  formTarget.value = null;
  formModalVisible.value = true;
}

function openUpdate(row: Api.Aiplatform.ModelProvider, prefill?: { baseUrl: string; enabled: boolean }) {
  formMode.value = 'update';
  // 预填源：行现值（编辑）或留痕旧值快照（回滚——apiKey 恒不预填须重输全量）
  formTarget.value = {
    providerKey: row.providerKey,
    baseUrl: prefill?.baseUrl ?? row.baseUrl,
    enabled: prefill?.enabled ?? row.enabled
  };
  formModalVisible.value = true;
}

/* ---- 远端清单对照抽屉（行动作拉取→对照→勾选入库内嵌收口） ---- */
const catalogVisible = ref(false);
const catalogTarget = ref<Api.Aiplatform.ModelProvider | null>(null);

function openCatalog(row: Api.Aiplatform.ModelProvider) {
  catalogTarget.value = row;
  catalogVisible.value = true;
}

/* ---- 变更留痕抽屉（时间倒序、掩码恒显；回滚＝按旧值开更新表单） ---- */
const tracesVisible = ref(false);
const tracesTarget = ref<Api.Aiplatform.ModelProvider | null>(null);
const tracesDrawerRef = ref<InstanceType<typeof ProviderTracesDrawer> | null>(null);

function openTraces(row: Api.Aiplatform.ModelProvider) {
  tracesTarget.value = row;
  tracesVisible.value = true;
}

/**
 * 留痕回滚＝打开预填表单（非直接 PUT）：baseUrl/enabled 按该痕 old* 快照预填、apiKey 恒空
 * （留痕只有掩码，须重输全量——表单 placeholder 明示）；提交即一次新变更、将留新痕。
 */
function handleTraceRollback(trace: Api.Aiplatform.ModelProviderTrace) {
  if (!tracesTarget.value) return;
  openUpdate(tracesTarget.value, {
    baseUrl: trace.oldBaseUrl ?? tracesTarget.value.baseUrl,
    enabled: trace.oldEnabled ?? tracesTarget.value.enabled
  });
}

/** 行动作键（两写＋留痕读动作——拉取清单是独立行动作钮）。 */
type RowAction = 'edit' | 'delete' | 'traces';

/**
 * 行下拉选项矩阵：编辑/删除逐码 hasAuth（读写分权）；留痕是读动作不门控——页面已挂
 * model-provider:read（技能页先例）。
 */
function rowOptions(): DropdownOption[] {
  const opts: DropdownOption[] = [];
  if (hasAuth(modelProviderWriteAuth.update)) {
    opts.push({ key: 'edit', label: $t('page.aiplatform.modelProvider.edit') });
  }
  if (hasAuth(modelProviderWriteAuth.delete)) {
    opts.push({ key: 'delete', label: $t('page.aiplatform.modelProvider.remove') });
  }
  opts.push({ key: 'traces', label: $t('page.aiplatform.modelProvider.traces') });
  return opts;
}

function onRowAction(row: Api.Aiplatform.ModelProvider, action: RowAction) {
  if (action === 'edit') openUpdate(row);
  else if (action === 'traces') openTraces(row);
  else handleDelete(row);
}

/**
 * 删除：$dialog.warning 二次确认（键名对账）→ DELETE；被档位引用 409 PRJ_072 走 onError
 * 透传 toast（先解除引用指路在 message 原文），行留列不吞；删成 toast＋刷新（DELETE 回执
 * data＝null，信封即回执）。删除痕 new 全 null、留痕 append-only 跨行存活。
 */
function handleDelete(row: Api.Aiplatform.ModelProvider) {
  window.$dialog?.warning({
    title: $t('page.aiplatform.modelProvider.confirm.delete'),
    content: $t('page.aiplatform.modelProvider.confirm.deleteTip', { providerKey: row.providerKey }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchDeleteAiplatformModelProvider(row.providerKey);
      if (!error) {
        window.$message?.success($t('page.aiplatform.modelProvider.success.delete'));
        getData();
      }
    }
  });
}

/** 写成功统一收口：toast（回执掩码行不消费）＋清单刷新；留痕抽屉开着则同步回读（modal 叠 drawer）。 */
function handleFormSuccess(mode: 'create' | 'update') {
  window.$message?.success($t(`page.aiplatform.modelProvider.success.${mode}`));
  getData();
  if (tracesVisible.value) {
    tracesDrawerRef.value?.reload();
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.aiplatform.modelProvider.title')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <div class="flex items-center gap-8px">
          <!-- 创建入口（hasAuth create 门控；技能页安装钮先例） -->
          <NButton v-if="hasAuth(modelProviderWriteAuth.create)" type="primary" size="small" @click="openCreate">
            {{ $t('page.aiplatform.modelProvider.create') }}
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

    <!-- 创建/更新共用弹窗（apiKey 明文唯一写口；更新/回滚按 target 预填） -->
    <ProviderFormModal v-model:visible="formModalVisible" :mode="formMode" :target="formTarget" @success="handleFormSuccess" />

    <!-- 远端清单对照抽屉（每次真拉无缓存；勾选入库＝内嵌轻量表单） -->
    <RemoteCatalogDrawer v-model:visible="catalogVisible" :provider="catalogTarget" />

    <!-- 变更留痕抽屉（时间倒序、apiKey 快照恒掩码；回滚 emit 回本页开预填表单） -->
    <ProviderTracesDrawer
      ref="tracesDrawerRef"
      v-model:visible="tracesVisible"
      :provider="tracesTarget"
      @rollback="handleTraceRollback"
    />
  </div>
</template>
