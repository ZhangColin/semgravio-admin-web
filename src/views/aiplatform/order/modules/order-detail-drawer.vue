<script setup lang="ts">
/**
 * 订单详情抽屉（#57）——报价依据全量：状态时点组 + 价目史（append-only 新→旧，带操作者）+ PRD 快照。
 *
 * #89 改 NTabs 两签（项目抽屉五签先例）：「基本信息」＝原单列内容原样入签；「付款核验」签按
 * payment:read 显隐（无码不渲染——account-profile 嵌件先例）、v-if 切签挂载即加载（切签卸载
 * 重挂天然重置）；抽屉每次打开回 basic 签。写按钮按态门控（未支付=报价/改价+取消；已支付=
 * 重试归档）+ hasAuth 逐写码；下载按钮按交付物类型自适应（#76：2=系统→源码包；1/3→设计
 * 资产包）＝读码、不按支付态门控。创建/重建合同按钮常给（#87：仅 hasAuth，不按态/在场门控
 * ——服务端 409 裁决透传）。报价/取消弹窗在父页统一挂载（抽屉发事件）；重试归档/创建合同
 * $dialog 二次确认在父页收口；写成功回读详情 + emit('updated') 通知列表刷新。
 */
import { computed, ref, watch } from 'vue';
import { NButton, NDataTable, NDrawer, NDrawerContent, NTabPane, NTabs, NTag } from 'naive-ui';
import type { TableColumns } from 'naive-ui/es/data-table/src/interface';
import { fetchDownloadOrderDesignPackage, fetchDownloadOrderSourcePackage, fetchGetAiplatformOrder } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { CONTRACT_CREATE_AUTH, PAYMENT_READ_AUTH, orderDeliverableTypeTagColor, orderStatusTagColor } from '@/constants/aiplatform';
import { formatDateTime, formatMoney, saveBlobFile } from '@/utils/common';
import AccountProfile from '../../modules/account-profile.vue';
import PaymentPlanPane from './payment-plan-pane.vue';

defineOptions({ name: 'OrderDetailDrawer' });

const props = defineProps<{
  orderId: string;
  /** 列表页 externalId 筛选值——账号档案嵌件查询锚（详情响应不带 externalId，契约如此）。 */
  externalId?: string | null;
}>();

const emit = defineEmits<{
  /** 请求报价/改价（弹窗在父页挂载；requote 预填当前价）。 */
  quote: [orderId: string, mode: 'quote' | 'requote', currentAmountCents: string | null, currentNote: string | null];
  /** 请求取消（弹窗在父页挂载）。 */
  cancel: [orderId: string];
  /** 请求重试归档（$dialog 二次确认在父页单点实现，同 account 先例）。 */
  retry: [orderId: string];
  /** 请求创建/重建合同（#87——$dialog 确认在父页单点；成功不跳转、回执不消费）。 */
  createContract: [orderId: string];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { hasAuth } = useAuth();

const detail = ref<Api.Aiplatform.OrderDetail | null>(null);
const loading = ref(false);
const downloading = ref(false);

/** 两签：basic＝原单列内容；payment＝付款核验（payment:read 门控显隐）。 */
const activeTab = ref<'basic' | 'payment'>('basic');
const canReadPayment = hasAuth(PAYMENT_READ_AUTH);

async function loadDetail() {
  loading.value = true;
  const { data, error } = await fetchGetAiplatformOrder(props.orderId);
  loading.value = false;
  if (!error) detail.value = data;
}

watch(visible, val => {
  if (val) {
    detail.value = null;
    activeTab.value = 'basic';
    loadDetail();
  }
});

/** 未支付态（1|2）：可报价/改价 + 取消；已支付（3）：可重试归档。 */
const canQuote = computed(() => {
  const d = detail.value;
  return !!d && (d.status === 1 || d.status === 2) && hasAuth('admin:aiplatform:order:quote');
});
const canCancel = computed(() => {
  const d = detail.value;
  return !!d && (d.status === 1 || d.status === 2) && hasAuth('admin:aiplatform:order:cancel');
});
const canRetryArchive = computed(
  () => detail.value?.status === 3 && hasAuth('admin:aiplatform:order:retry-archive')
);
const canDownload = computed(() => hasAuth('admin:aiplatform:order:read'));
/**
 * 创建/重建合同（#87）：按钮**常给**（仅 hasAuth 门控，不按订单态/合同在场门控——订单响应
 * 不带合同在场标志不可观测；在场/可建由服务端 409 ORD_024/025 等裁决透传）。
 */
const canCreateContract = computed(() => detail.value !== null && hasAuth(CONTRACT_CREATE_AUTH));

function handleQuote() {
  const d = detail.value;
  if (!d) return;
  emit('quote', d.id, d.status === 2 ? 'requote' : 'quote', d.amount, d.note);
}

/**
 * 取件按交付物类型自适应（#76）：2=系统→源码包（工作区实时打包）；1/3→设计资产包（下单冻结件，
 * 3 型统一部件容器含系统部件即全覆盖）。3 型无源码包入口＝有意取舍（实时源码诉求走项目页文件包，
 * 不同件）——错配不可达，错误态零专属处理（onError 透传 toast 兜底）。
 */
const isSourcePackage = computed(() => detail.value?.deliverableType === 2);

/** 两包同族：tar.gz 无信封 blob；文件名以服务端 Content-Disposition 为准（provider 约定 `{id}-source|design.tar.gz`），缺失时端侧兜底。 */
async function handleDownload() {
  const d = detail.value;
  if (!d) return;
  const isSource = isSourcePackage.value;
  downloading.value = true;
  const { data, error, response } = isSource
    ? await fetchDownloadOrderSourcePackage(d.id)
    : await fetchDownloadOrderDesignPackage(d.id);
  downloading.value = false;
  if (error || !data) return;
  const disposition = String(response?.headers?.['content-disposition'] ?? '');
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `${d.id}-${isSource ? 'source' : 'design'}.tar.gz`;
  saveBlobFile(data, filename);
  window.$message?.success(
    $t(isSource ? 'page.aiplatform.order.success.downloaded' : 'page.aiplatform.order.success.downloadedDesign')
  );
}

const priceColumns: TableColumns<Api.Aiplatform.OrderPriceEntry> = [
  {
    key: 'amount',
    title: $t('page.aiplatform.order.drawer.priceAmount'),
    align: 'right',
    width: 120,
    render: row => formatMoney(row.amount)
  },
  {
    key: 'note',
    title: $t('page.aiplatform.order.drawer.priceNote'),
    minWidth: 140,
    render: row => row.note ?? '-'
  },
  {
    key: 'operatorName',
    title: $t('page.aiplatform.order.drawer.priceOperator'),
    align: 'center',
    width: 110,
    render: row => row.operatorName ?? '-'
  },
  {
    key: 'createdAt',
    title: $t('page.aiplatform.order.drawer.priceAt'),
    align: 'center',
    width: 160,
    render: row => formatDateTime(row.createdAt)
  }
];

defineExpose({ reload: loadDetail });
</script>

<template>
  <NDrawer v-model:show="visible" :width="720">
    <NDrawerContent :title="$t('page.aiplatform.order.detailTitle')" closable>
      <div v-if="detail">
        <NTabs v-model:value="activeTab" type="line" animated>
          <!-- 基本信息＝原单列内容原样入签（操作行/基本信息/账号档案/价目史/PRD 快照零丢失） -->
          <NTabPane name="basic" :tab="$t('page.aiplatform.order.drawer.tabs.basic')">
            <div class="flex-col-stretch gap-16px">
              <!-- 操作行：按态 + hasAuth 门控 -->
              <div class="flex flex-wrap gap-8px">
                <NButton v-if="canQuote" type="primary" size="small" @click="handleQuote">
                  {{ detail.status === 2 ? $t('page.aiplatform.order.action.requote') : $t('page.aiplatform.order.action.quote') }}
                </NButton>
                <NButton v-if="canCancel" type="error" ghost size="small" @click="emit('cancel', detail.id)">
                  {{ $t('page.aiplatform.order.action.cancel') }}
                </NButton>
                <NButton v-if="canRetryArchive" type="warning" size="small" @click="emit('retry', detail.id)">
                  {{ $t('page.aiplatform.order.action.retryArchive') }}
                </NButton>
                <NButton v-if="canDownload" size="small" :loading="downloading" @click="handleDownload">
                  {{
                    isSourcePackage
                      ? $t('page.aiplatform.order.drawer.downloadPackage')
                      : $t('page.aiplatform.order.drawer.downloadDesignPackage')
                  }}
                </NButton>
                <NButton v-if="canCreateContract" type="primary" ghost size="small" @click="emit('createContract', detail.id)">
                  {{ $t('page.aiplatform.order.action.createContract') }}
                </NButton>
              </div>

              <!-- 基本信息 -->
              <div class="grid grid-cols-[110px_1fr] gap-x-16px gap-y-10px text-14px">
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.orderId') }}</span><span class="font-mono">{{ detail.id }}</span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.projectId') }}</span><span class="font-mono">{{ detail.projectId }}</span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.projectName') }}</span><span>{{ detail.projectName }}</span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.owner') }}</span><span>{{ detail.ownerDisplayName ?? '-' }}</span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.status') }}</span>
                <span>
                  <NTag :type="orderStatusTagColor[detail.status]" size="small">{{ detail.statusName }}</NTag>
                </span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.deliverableType') }}</span>
                <span>
                  <NTag :type="orderDeliverableTypeTagColor[detail.deliverableType]" size="small">
                    {{ detail.deliverableTypeName }}
                  </NTag>
                </span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.amount') }}</span><span>{{ formatMoney(detail.amount) }}</span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.createdAt') }}</span><span>{{ formatDateTime(detail.createdAt) }}</span>
                <span class="text-right text-#999">{{ $t('page.aiplatform.order.quotedAt') }}</span><span>{{ formatDateTime(detail.quotedAt) }}</span>
                <template v-if="detail.paidAt">
                  <span class="text-right text-#999">{{ $t('page.aiplatform.order.drawer.paidAt') }}</span><span>{{ formatDateTime(detail.paidAt) }}</span>
                </template>
                <template v-if="detail.archivedAt">
                  <span class="text-right text-#999">{{ $t('page.aiplatform.order.drawer.archivedAt') }}</span>
                  <span>
                    {{ formatDateTime(detail.archivedAt) }}
                    <template v-if="detail.archiveOperatorName">（{{ $t('page.aiplatform.order.drawer.archiveOperator') }}：{{ detail.archiveOperatorName }}）</template>
                  </span>
                </template>
                <template v-if="detail.cancelledAt">
                  <span class="text-right text-#999">{{ $t('page.aiplatform.order.drawer.cancelledAt') }}</span>
                  <span>{{ formatDateTime(detail.cancelledAt) }}</span>
                  <span class="text-right text-#999">{{ $t('page.aiplatform.order.drawer.cancelReason') }}</span>
                  <span>
                    {{ detail.cancelReason ?? '-' }}
                    <template v-if="detail.cancelOperatorName">（{{ $t('page.aiplatform.order.drawer.cancelOperator') }}：{{ detail.cancelOperatorName }}）</template>
                  </span>
                </template>
              </div>

              <!-- 账号档案（externalId 筛选驱动；筛选缺省/无读码不渲染） -->
              <AccountProfile :external-id="externalId" />

              <!-- 价目历史（append-only，新→旧） -->
              <div>
                <div class="mb-8px font-600">{{ $t('page.aiplatform.order.drawer.priceHistory') }}</div>
                <NDataTable :columns="priceColumns" :data="detail.priceEntries" size="small" :pagination="false" />
              </div>

              <!-- PRD 快照（下单冻结） -->
              <div v-if="detail.prdSnapshot">
                <div class="mb-8px font-600">{{ $t('page.aiplatform.order.drawer.prdSnapshot') }}</div>
                <pre class="max-h-320px overflow-auto whitespace-pre-wrap rounded-8px bg-#f5f5f5 p-12px text-13px">{{ detail.prdSnapshot }}</pre>
              </div>
            </div>
          </NTabPane>

          <!-- 付款核验（#89：payment:read 门控显隐——无码不渲染签；v-if 切签挂载即加载） -->
          <NTabPane v-if="canReadPayment" name="payment" :tab="$t('page.aiplatform.payment.tab')">
            <PaymentPlanPane v-if="activeTab === 'payment'" :order-id="orderId" />
          </NTabPane>
        </NTabs>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
