<script setup lang="tsx">
/**
 * AI 平台订单列表页（#57，#56 六域 T1 tracer bullet）。
 *
 * 列表 NDataTable（flex-height + sm:h-full）+ 筛选平铺（status 多选/创建区间/externalId/orderId）+
 * 行内「查看 + 操作下拉」（按态给操作：未支付=报价·改价/取消，已支付=重试归档——互斥/不可达不出现）+
 * 详情抽屉（价目史 + PRD 快照 + 下载源码包）。写按钮 hasAuth 逐写码门控；分页全链 1-based 直传零 ±1。
 */
import { ref } from 'vue';
import { NButton, NDropdown, NTag } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import { orderDeliverableTypeTagColor, orderStatusTagColor } from '@/constants/aiplatform';
import { fetchCreateAiplatformContractForOrder, fetchGetAiplatformOrderList, fetchRetryArchiveAiplatformOrder } from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import { formatDateTime, formatMoney } from '@/utils/common';
import AiplatformOrderSearch from './modules/order-search.vue';
import OrderDetailDrawer from './modules/order-detail-drawer.vue';
import OrderQuoteModal from './modules/quote-modal.vue';
import OrderCancelModal from './modules/cancel-modal.vue';

defineOptions({ name: 'AiplatformOrder' });

const appStore = useAppStore();
const { hasAuth } = useAuth();
const canQuote = hasAuth('admin:aiplatform:order:quote');
const canCancel = hasAuth('admin:aiplatform:order:cancel');
const canRetryArchive = hasAuth('admin:aiplatform:order:retry-archive');

/** 搜索参数 = 分页 + 当前筛选（OrderSearch 清洗后并入）。 */
const searchParams = ref<Api.Aiplatform.OrderSearchParams>({ page: 1, size: 10 });

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetAiplatformOrderList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.page = params.page ?? 1;
      searchParams.value.size = params.pageSize ?? 10;
    },
    columns: () => [
      {
        key: 'id',
        title: $t('page.aiplatform.order.orderId'),
        align: 'center',
        width: 170,
        render: row => <span class="font-mono">{row.id}</span>
      },
      {
        key: 'projectId',
        title: $t('page.aiplatform.order.projectId'),
        align: 'center',
        width: 170,
        render: row => <span class="font-mono">{row.projectId}</span>
      },
      {
        key: 'projectName',
        title: $t('page.aiplatform.order.projectName'),
        align: 'center',
        minWidth: 150,
        render: row => row.projectName ?? '-'
      },
      {
        key: 'ownerDisplayName',
        title: $t('page.aiplatform.order.owner'),
        align: 'center',
        width: 110,
        render: row => row.ownerDisplayName ?? '-'
      },
      {
        key: 'status',
        title: $t('page.aiplatform.order.status'),
        align: 'center',
        width: 100,
        render: row => (
          <NTag type={orderStatusTagColor[row.status]} size="small">
            {row.statusName}
          </NTag>
        )
      },
      {
        // 交付物类型（#76）：deliverableTypeName 直读（ADR-0009）＋三色 tag；无类型筛选维度（spec 已备案）
        key: 'deliverableType',
        title: $t('page.aiplatform.order.deliverableType'),
        align: 'center',
        width: 110,
        render: row => (
          <NTag type={orderDeliverableTypeTagColor[row.deliverableType]} size="small">
            {row.deliverableTypeName}
          </NTag>
        )
      },
      {
        key: 'amount',
        title: $t('page.aiplatform.order.amount'),
        align: 'right',
        width: 120,
        render: row => formatMoney(row.amount)
      },
      {
        key: 'createdAt',
        title: $t('page.aiplatform.order.createdAt'),
        align: 'center',
        width: 160,
        render: row => formatDateTime(row.createdAt)
      },
      {
        key: 'quotedAt',
        title: $t('page.aiplatform.order.quotedAt'),
        align: 'center',
        width: 160,
        render: row => formatDateTime(row.quotedAt)
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
                {$t('page.aiplatform.order.detail')}
              </NButton>
              {/* 无可用写操作（终态行/无写权限）时不渲染下拉触发器——互斥/不可达操作不出现（account 先例） */}
              {opts.length > 0 && (
                <NDropdown trigger="click" options={opts} onSelect={key => onAction(row.id, String(key))}>
                  <NButton size="small">{$t('page.aiplatform.order.more')}</NButton>
                </NDropdown>
              )}
            </div>
          );
        }
      }
    ]
  });

function getRowKey(row: Api.Aiplatform.OrderSummary) {
  return row.id;
}

/** 下拉选项按行动态：未支付（1|2）=报价/改价+取消；已支付（3）=重试归档；互斥/不可达不出现。 */
function rowOptions(row: Api.Aiplatform.OrderSummary): DropdownOption[] {
  const opts: DropdownOption[] = [];
  const unpaid = row.status === 1 || row.status === 2;
  if (unpaid && canQuote) {
    opts.push({
      key: 'quote',
      label: row.status === 2 ? $t('page.aiplatform.order.action.requote') : $t('page.aiplatform.order.action.quote')
    });
  }
  if (unpaid && canCancel) {
    opts.push({ key: 'cancel', label: $t('page.aiplatform.order.action.cancel') });
  }
  if (row.status === 3 && canRetryArchive) {
    opts.push({ key: 'retryArchive', label: $t('page.aiplatform.order.action.retryArchive') });
  }
  return opts;
}

/** 接筛选条提交：重置筛选字段（保留分页）、并入新筛选，回到第一页。 */
function handleSearch(filter: Api.Aiplatform.OrderFilter) {
  searchParams.value = { page: searchParams.value.page, size: searchParams.value.size, ...filter };
  getDataByPage(1);
}

/* ---- 详情抽屉 ---- */
const drawerVisible = ref(false);
const selectedOrderId = ref('');
const drawerRef = ref<InstanceType<typeof OrderDetailDrawer> | null>(null);

function openDetail(orderId: string) {
  selectedOrderId.value = orderId;
  drawerVisible.value = true;
}

/* ---- 报价弹窗 ---- */
const quoteModalVisible = ref(false);
const quoteTarget = ref<{
  orderId: string;
  mode: 'quote' | 'requote';
  currentAmountCents: string | null;
  currentNote: string | null;
} | null>(null);

function openQuote(orderId: string, mode: 'quote' | 'requote', amount: string | null, note: string | null) {
  quoteTarget.value = { orderId, mode, currentAmountCents: amount, currentNote: note };
  quoteModalVisible.value = true;
}

/* ---- 取消弹窗 ---- */
const cancelModalVisible = ref(false);
const cancelTargetId = ref('');

function openCancel(orderId: string) {
  cancelTargetId.value = orderId;
  cancelModalVisible.value = true;
}

/** 重试归档：$dialog 二次确认（行下拉与抽屉共用单点；成功后 toast + 抽屉回读 + 列表刷新）。 */
function handleRetryArchive(orderId: string) {
  window.$dialog?.warning({
    title: $t('page.aiplatform.order.confirm.retryArchive'),
    content: $t('page.aiplatform.order.confirm.target', { orderId }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchRetryArchiveAiplatformOrder(orderId);
      if (!error) {
        window.$message?.success($t('page.aiplatform.order.success.retried'));
        if (drawerVisible.value) {
          drawerRef.value?.reload();
        }
        getData();
      }
    }
  });
}

/**
 * 创建/重建合同（#87）：$dialog 二次确认 → 无请求体 POST。前置门（报价先在/范围已录/活跃
 * 唯一/已签关门）全在 provider——409/404 走 onError 透传 toast 不判码。成功**不跳转、回执
 * 不消费**（合同面经侧栏「合同管理」或 orderId 筛选自然可达）；订单自身状态不动，无需刷新。
 */
function handleCreateContract(orderId: string) {
  window.$dialog?.warning({
    title: $t('page.aiplatform.order.createContractConfirm.title'),
    content: $t('page.aiplatform.order.createContractConfirm.tip', { orderId }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchCreateAiplatformContractForOrder(orderId);
      if (!error) {
        window.$message?.success($t('page.aiplatform.order.success.contractCreated'));
      }
    }
  });
}

/** 行内下拉动作分发（quote/cancel 开弹窗；retryArchive 走父页单点确认，与抽屉事件共用）。 */
function onAction(orderId: string, key: string) {
  const row = data.value.find(item => item.id === orderId);
  if (!row) return;
  if (key === 'quote') {
    openQuote(orderId, row.status === 2 ? 'requote' : 'quote', row.amount, null);
    return;
  }
  if (key === 'cancel') {
    openCancel(orderId);
    return;
  }
  if (key === 'retryArchive') {
    handleRetryArchive(orderId);
  }
}

/**
 * 写成功统一收口：toast + 抽屉回读 + 列表刷新。
 * 写弹窗只能由抽屉内按钮或行下拉触发——抽屉为 modal 遮罩（背景不可点），行触发时抽屉必关，故开着即同目标。
 */
function handleWriteSuccess(successKey: 'quoted' | 'cancelled') {
  window.$message?.success($t(`page.aiplatform.order.success.${successKey}`));
  if (drawerVisible.value) {
    drawerRef.value?.reload();
  }
  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <AiplatformOrderSearch @search="handleSearch" />
    <NCard :title="$t('page.aiplatform.order.title')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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

    <!-- 详情抽屉（价目史 + PRD 快照 + 按态写操作 + 源码包下载 + 账号档案嵌件 + 创建合同入口） -->
    <OrderDetailDrawer
      ref="drawerRef"
      v-model:visible="drawerVisible"
      :order-id="selectedOrderId"
      :external-id="searchParams.externalId ?? null"
      @quote="openQuote"
      @cancel="openCancel"
      @retry="handleRetryArchive"
      @create-contract="handleCreateContract"
    />
    <OrderQuoteModal
      v-model:visible="quoteModalVisible"
      :order-id="quoteTarget?.orderId ?? ''"
      :mode="quoteTarget?.mode ?? 'quote'"
      :current-amount-cents="quoteTarget?.currentAmountCents ?? null"
      :current-note="quoteTarget?.currentNote ?? null"
      @success="handleWriteSuccess('quoted')"
    />
    <OrderCancelModal
      v-model:visible="cancelModalVisible"
      :order-id="cancelTargetId"
      @success="handleWriteSuccess('cancelled')"
    />
  </div>
</template>
