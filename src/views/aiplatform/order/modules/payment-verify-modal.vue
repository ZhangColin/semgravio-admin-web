<script setup lang="ts">
/**
 * 到账核验弹窗（#89）——实到金额（元输入，提交转整数分）＋实到时间（必填）＋关联凭证
 * （可空，选项＝该节点已传凭证清单）＋渠道流水号（可空落值）＋依据/备注（可空 ≤1000）。
 *
 * **全额判定归 provider 不预判**：累计核到账≥节点额自动转已到账、不足留痕回待支付——弹窗
 * 只录事实不做判定提示结论。基础校验先行（金额正数/时间必填——ORD_041 服务端兜底透传）；
 * 凭证归属守卫（ORD_045）由选项集天然限定（只出该节点凭证）。金额输入用 NInput
 * （quote-modal 先例，校验用 utils 共用件 parsePositiveYuan）；时间 NDatePicker datetime →
 * 本地 ISO 串（order-search 同款序列化）。channelRefNo **不预填**（每笔到账各随行落值，
 * 预填会把上次核验的流水号静默重交进新留痕）。
 */
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { NDatePicker, NForm, NFormItem, NInput, NModal, NSelect } from 'naive-ui';
import { fetchVerifyAiplatformPaymentNode } from '@/service/api';
import { $t } from '@/locales';
import { parsePositiveYuan } from '@/utils/common';

defineOptions({ name: 'PaymentVerifyModal' });

const props = defineProps<{
  orderId: string;
  /** 核验目标节点（须为线下转账待核验态——按钮按态门控；携本人凭证清单）。 */
  node: Api.Aiplatform.PaymentNode | null;
}>();

const emit = defineEmits<{
  /** 核验成功（父面 toast＋回读 plan detail）。 */
  success: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const amountText = ref('');
const arrivedTs = ref<number | null>(null);
const voucherId = ref<string | null>(null);
const channelRefNo = ref('');
const basis = ref('');
const submitting = ref(false);

watch(visible, val => {
  if (!val) return;
  amountText.value = '';
  arrivedTs.value = null;
  voucherId.value = null;
  channelRefNo.value = '';
  basis.value = '';
});

/** 凭证选项＝目标节点已传凭证（归属守卫 ORD_045 由选项集天然限定）。 */
const voucherOptions = computed(() =>
  (props.node?.vouchers ?? []).map(voucher => ({ label: voucher.fileName, value: voucher.id }))
);

/** 正数（≤2 位小数）即合法——确认时再取整转分。 */
const parsedAmountYuan = computed(() => parsePositiveYuan(amountText.value));

const isValid = computed(() => parsedAmountYuan.value !== null && arrivedTs.value !== null);

async function handleConfirm() {
  if (!isValid.value || !props.node || arrivedTs.value === null) return false;
  const command: Api.Aiplatform.PaymentVerifyCommand = {
    actualAmount: Math.round((parsedAmountYuan.value as number) * 100),
    arrivedAt: dayjs(arrivedTs.value).format('YYYY-MM-DDTHH:mm:ss'),
    voucherId: voucherId.value ?? null,
    channelRefNo: channelRefNo.value.trim() || null,
    basis: basis.value.trim() || null
  };
  submitting.value = true;
  const { error } = await fetchVerifyAiplatformPaymentNode(props.orderId, props.node.id, command);
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success');
    return true;
  }
  // 失败：onError 已透传 toast（ORD_038 状态守卫/ORD_041 录入无效/ORD_045 凭证归属）；保持弹窗可修正重试
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.payment.verifyModal.title')"
    preset="dialog"
    :positive-text="$t('page.aiplatform.payment.verifyModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px text-13px text-#999">{{ $t('page.aiplatform.payment.verifyModal.tip') }}</p>
    <NForm label-placement="top" class="pt-12px">
      <NFormItem :label="$t('page.aiplatform.payment.verifyModal.actualAmount')">
        <NInput
          v-model:value="amountText"
          :placeholder="$t('page.aiplatform.payment.verifyModal.actualAmountPlaceholder')"
          :input-props="{ inputmode: 'decimal' }"
          clearable
          class="w-full"
        />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.payment.verifyModal.arrivedAt')">
        <NDatePicker v-model:value="arrivedTs" type="datetime" class="w-full" />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.payment.verifyModal.voucherId')">
        <NSelect
          v-model:value="voucherId"
          :options="voucherOptions"
          :placeholder="$t('page.aiplatform.payment.verifyModal.voucherIdPlaceholder')"
          clearable
        />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.payment.verifyModal.channelRefNo')">
        <NInput
          v-model:value="channelRefNo"
          :placeholder="$t('page.aiplatform.payment.verifyModal.channelRefNoPlaceholder')"
          clearable
        />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.payment.verifyModal.basis')">
        <NInput
          v-model:value="basis"
          type="textarea"
          :rows="3"
          :maxlength="1000"
          show-count
          :placeholder="$t('page.aiplatform.payment.verifyModal.basisPlaceholder')"
        />
      </NFormItem>
    </NForm>
  </NModal>
</template>
