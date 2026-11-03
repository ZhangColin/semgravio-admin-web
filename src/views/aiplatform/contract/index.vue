<script setup lang="tsx">
/**
 * AI 平台合同列表页（#87，#79 A 批 T1）——六态人工承接工作台。
 *
 * 列表 NDataTable（flex-height + sm:h-full）+ 筛选平铺（status 多选/创建区间/orderId/contractNo）
 * + 行内「查看 + 操作下拉」。七写**双入口**（行下拉＋抽屉动作条，门控矩阵收 constants 单点
 * `availableContractActions`——行清单 wire 无签署位，末边 3→4 推进只在抽屉可观测门控）＋
 * 逐写 hasAuth；六写弹窗（basis-only 共用 modal×advance/fail/withdraw/void、sign 加 party 单选、
 * record 五肢整组）在父页挂载收口。写回执不消费——成功 toast＋抽屉回读＋列表刷新；
 * 失败走 onError 统一透传 toast（不判码，ORD_027 竞态等服务端裁决兜底）。分页 1-based 直传零 ±1。
 */
import { ref } from 'vue';
import { NButton, NDropdown, NTag } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import { availableContractActions, contractStatusTagColor, contractWriteAuth } from '@/constants/aiplatform';
import { fetchGetAiplatformContractList } from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import { formatDateTime, formatMoney } from '@/utils/common';
import AiplatformContractSearch from './modules/contract-search.vue';
import ContractDetailDrawer from './modules/contract-detail-drawer.vue';
import ContractActionModal from './modules/contract-action-modal.vue';
import ContractRecordModal from './modules/contract-record-modal.vue';

defineOptions({ name: 'AiplatformContract' });

const appStore = useAppStore();
const { hasAuth } = useAuth();

/** 搜索参数 = 分页 + 当前筛选（ContractSearch 清洗后并入）。 */
const searchParams = ref<Api.Aiplatform.ContractSearchParams>({ page: 1, size: 10 });

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetAiplatformContractList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.page = params.page ?? 1;
      searchParams.value.size = params.pageSize ?? 10;
    },
    columns: () => [
      {
        key: 'id',
        title: $t('page.aiplatform.contract.contractId'),
        align: 'center',
        width: 170,
        render: row => <span class="font-mono">{row.id}</span>
      },
      {
        key: 'contractNo',
        title: $t('page.aiplatform.contract.contractNo'),
        align: 'center',
        width: 130,
        render: row => <span class="font-mono">{row.contractNo}</span>
      },
      {
        key: 'orderId',
        title: $t('page.aiplatform.contract.orderId'),
        align: 'center',
        width: 170,
        render: row => <span class="font-mono">{row.orderId}</span>
      },
      {
        key: 'status',
        title: $t('page.aiplatform.contract.status'),
        align: 'center',
        width: 140,
        render: row => (
          <NTag type={contractStatusTagColor[row.status]} size="small">
            {row.statusName}
          </NTag>
        )
      },
      {
        key: 'version',
        title: $t('page.aiplatform.contract.version'),
        align: 'center',
        width: 70,
        render: row => row.version
      },
      {
        key: 'amount',
        title: $t('page.aiplatform.contract.amount'),
        align: 'right',
        width: 120,
        render: row => formatMoney(row.amount)
      },
      {
        key: 'createdAt',
        title: $t('page.aiplatform.contract.createdAt'),
        align: 'center',
        width: 160,
        render: row => formatDateTime(row.createdAt)
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 170,
        fixed: 'right',
        render: row => {
          const opts = rowOptions(row);
          return (
            <div class="flex-center gap-8px whitespace-nowrap">
              <NButton type="primary" ghost size="small" onClick={() => openDetail(row.id)}>
                {$t('page.aiplatform.contract.detail')}
              </NButton>
              {/* 无任一可用写（终态行/无写权限）时不渲染下拉触发器——不可达操作不出现 */}
              {opts.length > 0 && (
                <NDropdown trigger="click" options={opts} onSelect={key => handleAction(String(key) as Api.Aiplatform.ContractAction, row)}>
                  <NButton size="small">{$t('page.aiplatform.contract.more')}</NButton>
                </NDropdown>
              )}
            </div>
          );
        }
      }
    ]
  });

function getRowKey(row: Api.Aiplatform.ContractSummary) {
  return row.id;
}

/**
 * 行下拉选项＝矩阵（status-only：签署位不可观测 → 3 态不出推进，末边推进走抽屉）∩ 逐写 hasAuth。
 */
function rowOptions(row: Api.Aiplatform.ContractSummary): DropdownOption[] {
  return availableContractActions({ status: row.status })
    .filter(action => hasAuth(contractWriteAuth[action]))
    .map(action => ({ key: action, label: $t(`page.aiplatform.contract.action.${action}`) }));
}

/** 接筛选条提交：重置筛选字段（保留分页）、并入新筛选，回到第一页。 */
function handleSearch(filter: Api.Aiplatform.ContractFilter) {
  searchParams.value = { page: searchParams.value.page, size: searchParams.value.size, ...filter };
  getDataByPage(1);
}

/* ---- 详情抽屉 ---- */
const drawerVisible = ref(false);
const selectedContractId = ref('');
const drawerRef = ref<InstanceType<typeof ContractDetailDrawer> | null>(null);

function openDetail(contractId: string) {
  selectedContractId.value = contractId;
  drawerVisible.value = true;
}

/* ---- 六写弹窗（basis-only 共用 modal＋sign 变体；record 独立五肢表单） ---- */
const actionModalVisible = ref(false);
const actionTarget = ref<Api.Aiplatform.ContractSummary | null>(null);
/** action-modal 承载面＝六写除 record（record 早返独立弹窗，不会落入本 ref）。 */
const actionKind = ref<Exclude<Api.Aiplatform.ContractAction, 'record'>>('advance');

const recordModalVisible = ref(false);
const recordTarget = ref<Api.Aiplatform.ContractSummary | null>(null);

/**
 * 双入口动作收口（行下拉传清单行、抽屉传详情 contract 段——record 四预览字段预填仅抽屉可达，
 * 行入口空表单整组录入）。弹窗在父页统一挂载；确认与请求在弹窗内收口（cancel-modal 先例）。
 */
function handleAction(action: Api.Aiplatform.ContractAction, contract: Api.Aiplatform.ContractSummary) {
  if (action === 'record') {
    recordTarget.value = contract;
    recordModalVisible.value = true;
    return;
  }
  actionKind.value = action;
  actionTarget.value = contract;
  actionModalVisible.value = true;
}

/**
 * 写成功统一收口：toast + 抽屉回读（回执是单段合同体非三段 detail，不消费）+ 列表刷新。
 * 弹窗只能由抽屉内按钮或行下拉触发——抽屉为 modal 遮罩，行触发时抽屉必关，故开着即同目标。
 */
function handleWriteSuccess(action: Api.Aiplatform.ContractAction) {
  window.$message?.success($t(`page.aiplatform.contract.success.${action}`));
  if (drawerVisible.value) {
    drawerRef.value?.reload();
  }
  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <AiplatformContractSearch @search="handleSearch" />
    <NCard :title="$t('page.aiplatform.contract.title')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :hide-add="true"
          :hide-delete="true"
          :loading="loading"
          @refresh="getData"
        />
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        class="sm:h-full"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="getRowKey"
        :pagination="mobilePagination"
      />
    </NCard>

    <!-- 详情抽屉（三段：contract 全字段 / PRD 全文 / 动作时间线；动作条 emit 回本页收口） -->
    <ContractDetailDrawer ref="drawerRef" v-model:visible="drawerVisible" :contract-id="selectedContractId" @action="handleAction" />

    <!-- 六写共用弹窗（advance/fail/withdraw/void basis-only；sign 加 party 单选） -->
    <ContractActionModal
      v-model:visible="actionModalVisible"
      :action="actionKind"
      :contract="actionTarget"
      @success="handleWriteSuccess"
    />

    <!-- 草稿重录五肢整组表单（仅草稿态可达；抽屉入口预填四预览字段） -->
    <ContractRecordModal v-model:visible="recordModalVisible" :contract="recordTarget" @success="handleWriteSuccess('record')" />
  </div>
</template>
