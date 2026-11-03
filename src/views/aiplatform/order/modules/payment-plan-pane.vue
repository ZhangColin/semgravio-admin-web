<script setup lang="tsx">
/**
 * 付款核验签（#89，A 批 T2）——订单抽屉第二签承载面：计划详情三段全量（plan 活跃计划＋
 * trails 留痕时间线＋history 历史计划行）＋凭证字节下载。v-if 挂载即加载（切签卸载重挂、
 * 天然重置——项目抽屉五签先例）；写成功回读 detail（三写回执＝PaymentPlan 现值，不含
 * trails/history——不消费）。
 *
 * 分节：动作行（节点录入/重录常给——**不预判重录窗口**，ORD_044 服务端裁决透传）／计划
 * 概览（合同号＝附言码正身源 mono／总额／累计已核到账／创建时点）／节点表（附言码 mono＋
 * 渠道流水号·到账时点随行小字、开工门标志、五态 statusName 直读、累计核到账、还需支付；
 * 核验/打回按钮按 4 态可前置门控＋逐写 hasAuth）／凭证清单（点行下载——无信封 blob，
 * Content-Disposition 文件名透传、缺失端侧以 fileName 兜底）／核验留痕时间线（新→旧跨
 * 节点直读；from/to 状态 code 无 *Name——mono 数字如实呈现不造映射）／历史计划行收起态。
 *
 * 订单无计划（尚无合同，404 ORD_036）＝面板缺席 NEmpty（prd-pane 先例：错误态不写防御性
 * 处理，不按业务码分支——onError 已透传 toast）。全额判定归 provider 不预判（不足留痕回
 * 待支付、累计不清零——均由回读 detail 呈现）。
 */
import { computed, ref } from 'vue';
import { NButton, NDataTable, NEmpty, NSpin, NTag, NTimeline, NTimelineItem } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  PAYMENT_NODES_AUTH,
  PAYMENT_REJECT_AUTH,
  PAYMENT_VERIFY_AUTH,
  paymentNodeStatusTagColor
} from '@/constants/aiplatform';
import { fetchDownloadAiplatformPaymentVoucher, fetchGetAiplatformPaymentPlan } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime, formatFileSize, formatMoney, saveBlobFile } from '@/utils/common';
import PaymentNodesModal from './payment-nodes-modal.vue';
import PaymentRejectModal from './payment-reject-modal.vue';
import PaymentVerifyModal from './payment-verify-modal.vue';

defineOptions({ name: 'PaymentPlanPane' });

const props = defineProps<{
  orderId: string;
}>();

const { hasAuth } = useAuth();
const canEnterNodes = hasAuth(PAYMENT_NODES_AUTH);
const canVerify = hasAuth(PAYMENT_VERIFY_AUTH);
const canReject = hasAuth(PAYMENT_REJECT_AUTH);

const detail = ref<Api.Aiplatform.PaymentPlanDetail | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  const { data, error } = await fetchGetAiplatformPaymentPlan(props.orderId);
  loading.value = false;
  if (!error) detail.value = data;
}

/* ---- 三写 modal 态（挂本签内——单入口签面自持，写成功 toast＋回读收口） ---- */
const nodesModalVisible = ref(false);
const verifyModalVisible = ref(false);
const rejectModalVisible = ref(false);
const verifyTarget = ref<Api.Aiplatform.PaymentNode | null>(null);
const rejectTarget = ref<Api.Aiplatform.PaymentNode | null>(null);

function handleWriteSuccess(successKey: 'nodesEntered' | 'verified' | 'rejected') {
  window.$message?.success($t(`page.aiplatform.payment.success.${successKey}`));
  load();
}

/* ---- 凭证下载（无信封二进制流；文件名 provider Content-Disposition 优先，端侧兜底） ---- */
const downloadingVoucherId = ref<string | null>(null);

async function handleDownloadVoucher(voucher: Api.Aiplatform.PaymentVoucher) {
  downloadingVoucherId.value = voucher.id;
  const { data, error, response } = await fetchDownloadAiplatformPaymentVoucher(voucher.id);
  downloadingVoucherId.value = null;
  if (error || !data) return;
  const disposition = String(response?.headers?.['content-disposition'] ?? '');
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? voucher.fileName;
  saveBlobFile(data, filename);
  window.$message?.success($t('page.aiplatform.payment.success.voucherDownloaded'));
}

/** 全节点凭证平面（上传序＝节点录入序×节点内上传序；点行看证不分明细区）。 */
const vouchers = computed(() => detail.value?.plan.nodes.flatMap(node => node.vouchers) ?? []);
const nodeNameOf = computed(() => {
  const map = new Map<string, string>();
  for (const node of detail.value?.plan.nodes ?? []) map.set(node.id, node.name);
  return map;
});

/** 节点表列（tsx render：附言码/流水号 mono、开工门标志、五态 tag、核验/打回按 4 态×码门控；
 *  无响应式依赖（canVerify/canReject 为会话静态布尔）——plain const 即可（价目史列先例）。 */
const nodeColumns: DataTableColumns<Api.Aiplatform.PaymentNode> = [
  {
    key: 'seq',
    title: $t('page.aiplatform.payment.node.seq'),
    align: 'center',
    width: 48,
    render: row => row.seq
  },
  {
    key: 'name',
    title: $t('page.aiplatform.payment.node.name'),
    minWidth: 96,
    render: row => <span class="text-13px">{row.name}</span>
  },
  {
    key: 'amount',
    title: $t('page.aiplatform.payment.node.amount'),
    align: 'right',
    width: 92,
    render: row => formatMoney(row.amount)
  },
  {
    key: 'remarkCode',
    title: $t('page.aiplatform.payment.node.remarkCode'),
    minWidth: 140,
    render: row => (
      <div class="flex flex-col">
        <span class="font-mono text-12px">{row.remarkCode}</span>
        {row.channelRefNo && <span class="font-mono text-11px text-gray-400">{row.channelRefNo}</span>}
      </div>
    )
  },
  {
    key: 'kickoffGate',
    title: $t('page.aiplatform.payment.node.kickoffGate'),
    align: 'center',
    width: 64,
    render: row => (row.kickoffGate ? <NTag type="success" size="small">{$t('page.aiplatform.payment.node.kickoffGateTag')}</NTag> : <span class="text-#999">-</span>)
  },
  {
    key: 'status',
    title: $t('page.aiplatform.payment.node.status'),
    align: 'center',
    width: 104,
    render: row => (
      <div class="flex flex-col items-center gap-2px">
        <NTag type={paymentNodeStatusTagColor[row.status]} size="small">
          {row.statusName}
        </NTag>
        {row.receivedAt && <span class="text-11px text-gray-400">{formatDateTime(row.receivedAt)}</span>}
      </div>
    )
  },
  {
    key: 'settledAmount',
    title: $t('page.aiplatform.payment.node.settledAmount'),
    align: 'right',
    width: 96,
    render: row => formatMoney(row.settledAmount)
  },
  {
    key: 'remainingAmount',
    title: $t('page.aiplatform.payment.node.remainingAmount'),
    align: 'right',
    width: 92,
    render: row => formatMoney(row.remainingAmount)
  },
  {
    key: 'operate',
    title: $t('page.aiplatform.payment.node.operate'),
    align: 'center',
    width: 140,
    fixed: 'right',
    // 4＝线下转账待核验——核验/打回唯一可达态（ORD_038 兜底竞态）；互斥/不可达不出现先例
    render: row =>
      row.status === 4 ? (
        <div class="flex-center gap-4px whitespace-nowrap">
          {canVerify && (
            <NButton
              type="primary"
              ghost
              size="tiny"
              onClick={() => {
                verifyTarget.value = row;
                verifyModalVisible.value = true;
              }}
            >
              {$t('page.aiplatform.payment.action.verify')}
            </NButton>
          )}
          {canReject && (
            <NButton
              type="error"
              ghost
              size="tiny"
              onClick={() => {
                rejectTarget.value = row;
                rejectModalVisible.value = true;
              }}
            >
              {$t('page.aiplatform.payment.action.reject')}
            </NButton>
          )}
        </div>
      ) : (
        <span class="text-#999">-</span>
      )
  }
];

/** 凭证清单列（所属节点经 node 名映射；下载按钮行内触发）。读响应式
 *  （nodeNameOf/downloadingVoucherId）——computed 换列集驱动重渲染（loading 态/节点名同步）。 */
const voucherColumns = computed<DataTableColumns<Api.Aiplatform.PaymentVoucher>>(() => [
  {
    key: 'node',
    title: $t('page.aiplatform.payment.voucher.node'),
    align: 'center',
    width: 100,
    render: row => nodeNameOf.value.get(row.nodeId) ?? '-'
  },
  {
    key: 'fileName',
    title: $t('page.aiplatform.payment.voucher.fileName'),
    minWidth: 140,
    render: row => <span class="break-all text-13px">{row.fileName}</span>
  },
  {
    key: 'byteSize',
    title: $t('page.aiplatform.payment.voucher.size'),
    align: 'right',
    width: 80,
    render: row => formatFileSize(row.byteSize)
  },
  {
    key: 'createdAt',
    title: $t('page.aiplatform.payment.voucher.createdAt'),
    align: 'center',
    width: 150,
    render: row => formatDateTime(row.createdAt)
  },
  {
    key: 'operate',
    title: $t('page.aiplatform.payment.node.operate'),
    align: 'center',
    width: 80,
    render: row => (
      <NButton
        size="tiny"
        loading={downloadingVoucherId.value === row.id}
        onClick={() => {
          handleDownloadVoucher(row);
        }}
      >
        {$t('page.aiplatform.payment.voucher.download')}
      </NButton>
    )
  }
]);

/** 历史计划行（收起态＝摘要行集；节点细节不在留痕面）。 */
const historyColumns: DataTableColumns<Api.Aiplatform.PaymentHistoryPlan> = [
  {
    key: 'contractNo',
    title: $t('page.aiplatform.payment.historyRow.contractNo'),
    align: 'center',
    width: 120,
    render: row => <span class="font-mono text-12px">{row.contractNo}</span>
  },
  {
    key: 'nodeCount',
    title: $t('page.aiplatform.payment.historyRow.nodeCount'),
    align: 'center',
    width: 70,
    render: row => row.nodeCount
  },
  {
    key: 'totalAmount',
    title: $t('page.aiplatform.payment.historyRow.totalAmount'),
    align: 'right',
    width: 100,
    render: row => formatMoney(row.totalAmount)
  },
  {
    key: 'totalSettled',
    title: $t('page.aiplatform.payment.historyRow.totalSettled'),
    align: 'right',
    width: 100,
    render: row => formatMoney(row.totalSettled)
  },
  {
    key: 'createdAt',
    title: $t('page.aiplatform.payment.historyRow.createdAt'),
    align: 'center',
    width: 150,
    render: row => formatDateTime(row.createdAt)
  }
];

/** 留痕时间线节点色（到账核验 success／打回 error）。 */
const TRAIL_TIMELINE_TYPE: Record<number, 'success' | 'error'> = { 1: 'success', 2: 'error' };

load();
</script>

<template>
  <div v-if="loading" class="flex-center min-h-300px">
    <NSpin />
  </div>
  <template v-else-if="detail">
    <div class="flex-col-stretch gap-16px">
      <!-- 动作行：节点录入/重录常给（不预判重录窗口——ORD_044 服务端裁决透传） -->
      <div v-if="canEnterNodes" class="flex flex-wrap gap-8px">
        <NButton type="primary" ghost size="small" @click="nodesModalVisible = true">
          {{
            detail.plan.nodes.length
              ? $t('page.aiplatform.payment.action.reEnterNodes')
              : $t('page.aiplatform.payment.action.enterNodes')
          }}
        </NButton>
      </div>

      <!-- 计划概览（合同号＝附言码正身源） -->
      <div>
        <div class="mb-8px font-600">{{ $t('page.aiplatform.payment.overview') }}</div>
        <div class="grid grid-cols-[110px_1fr] gap-x-16px gap-y-10px text-14px">
          <span class="text-right text-#999">{{ $t('page.aiplatform.payment.contractNo') }}</span>
          <span class="font-mono">{{ detail.plan.contractNo }}</span>
          <span class="text-right text-#999">{{ $t('page.aiplatform.payment.totalAmount') }}</span>
          <span>{{ formatMoney(detail.plan.totalAmount) }}</span>
          <span class="text-right text-#999">{{ $t('page.aiplatform.payment.totalSettled') }}</span>
          <span>{{ formatMoney(detail.plan.totalSettled) }}</span>
          <span class="text-right text-#999">{{ $t('page.aiplatform.payment.createdAt') }}</span>
          <span>{{ formatDateTime(detail.plan.createdAt) }}</span>
        </div>
      </div>

      <!-- 节点表（录入序；空表＝待录入） -->
      <div>
        <div class="mb-8px font-600">{{ $t('page.aiplatform.payment.nodes') }}</div>
        <NDataTable
          v-if="detail.plan.nodes.length"
          :columns="nodeColumns"
          :data="detail.plan.nodes"
          size="small"
          :pagination="false"
          :scroll-x="880"
        />
        <NEmpty v-else :description="$t('page.aiplatform.payment.nodesEmpty')" />
      </div>

      <!-- 凭证清单（点行下载 blob） -->
      <div>
        <div class="mb-8px font-600">{{ $t('page.aiplatform.payment.vouchers') }}</div>
        <NDataTable
          v-if="vouchers.length"
          :columns="voucherColumns"
          :data="vouchers"
          size="small"
          :pagination="false"
          :scroll-x="560"
        />
        <NEmpty v-else :description="$t('page.aiplatform.payment.vouchersEmpty')" />
      </div>

      <!-- 核验留痕时间线（新→旧跨节点；from/to code 无 *Name——mono 数字如实呈现） -->
      <div>
        <div class="mb-8px font-600">{{ $t('page.aiplatform.payment.trails') }}</div>
        <div v-if="detail.trails.length" class="pt-8px">
          <NTimeline size="large">
            <NTimelineItem
              v-for="trail in detail.trails"
              :key="trail.id"
              :type="TRAIL_TIMELINE_TYPE[trail.action] ?? 'default'"
              :time="formatDateTime(trail.createdAt)"
            >
              <div class="flex items-center gap-8px">
                <NTag size="small">{{ trail.actionName }}</NTag>
                <span class="font-mono text-12px text-gray-400">
                  {{ trail.fromStatus }} → {{ trail.toStatus }}
                </span>
                <span v-if="nodeNameOf.get(trail.nodeId)" class="text-13px">{{ nodeNameOf.get(trail.nodeId) }}</span>
              </div>
              <div v-if="trail.action === 1" class="mt-2px text-13px">
                {{ formatMoney(trail.actualAmount) }}
                <template v-if="trail.arrivedAt">（{{ formatDateTime(trail.arrivedAt) }}）</template>
              </div>
              <div v-if="trail.basis" class="mt-2px text-13px">{{ trail.basis }}</div>
              <div class="mt-2px text-12px text-gray-400">
                {{ trail.operatorName }}
                <span class="font-mono">{{ trail.operatorId }}</span>
              </div>
            </NTimelineItem>
          </NTimeline>
        </div>
        <span v-else class="text-13px text-gray-400">{{ $t('page.aiplatform.payment.trailsEmpty') }}</span>
      </div>

      <!-- 历史计划行（收起态＝摘要行集；不含活跃行） -->
      <div v-if="detail.history.length">
        <div class="mb-8px font-600">{{ $t('page.aiplatform.payment.history') }}</div>
        <NDataTable :columns="historyColumns" :data="detail.history" size="small" :pagination="false" :scroll-x="540" />
      </div>
    </div>

    <!-- 三写 modal（单入口签面自持；成功 toast＋回读 detail） -->
    <PaymentNodesModal
      v-model:visible="nodesModalVisible"
      :order-id="orderId"
      :nodes="detail.plan.nodes"
      @success="handleWriteSuccess('nodesEntered')"
    />
    <PaymentVerifyModal
      v-model:visible="verifyModalVisible"
      :order-id="orderId"
      :node="verifyTarget"
      @success="handleWriteSuccess('verified')"
    />
    <PaymentRejectModal
      v-model:visible="rejectModalVisible"
      :order-id="orderId"
      :node="rejectTarget"
      @success="handleWriteSuccess('rejected')"
    />
  </template>
  <!-- 无付款计划（尚无合同，404 ORD_036）＝面板缺席（onError 已透传 toast——prd-pane 先例） -->
  <NEmpty v-else :description="$t('page.aiplatform.payment.empty')" />
</template>
