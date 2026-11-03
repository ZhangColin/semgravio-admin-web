<script setup lang="ts">
/**
 * 付款打回弹窗（#89）——basis-only 确认形态（A-T1 contract-action-modal 同款）：打回依据
 * 必填留痕（空禁用确认——ORD_042 前端先行拦截）≤1000、节点名插值对账锚。打回回「待支付」
 * 不动累计已核到账；命令体 voucherId 可空（打回语境＝凭证主张被否，不关联凭证留痕）。
 * 失败保持弹窗可修正重试（onError 已透传 toast——ORD_038 状态守卫竞态不判码）。
 */
import { computed, ref, watch } from 'vue';
import { NInput, NModal } from 'naive-ui';
import { fetchRejectAiplatformPaymentNode } from '@/service/api';
import { $t } from '@/locales';

defineOptions({ name: 'PaymentRejectModal' });

const props = defineProps<{
  orderId: string;
  /** 打回目标节点（须为线下转账待核验态——按钮按态门控）。 */
  node: Api.Aiplatform.PaymentNode | null;
}>();

const emit = defineEmits<{
  /** 打回成功（父面 toast＋回读 plan detail）。 */
  success: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const basis = ref('');
const submitting = ref(false);

watch(visible, val => {
  if (val) basis.value = '';
});

const isValid = computed(() => basis.value.trim().length > 0);

async function handleConfirm() {
  if (!isValid.value || !props.node) return false;
  submitting.value = true;
  const { error } = await fetchRejectAiplatformPaymentNode(props.orderId, props.node.id, {
    voucherId: null,
    basis: basis.value.trim()
  });
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success');
    return true;
  }
  // 失败：onError 已透传 toast（ORD_038 状态守卫/ORD_042 依据）；保持弹窗可修正重试
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.payment.rejectModal.title')"
    preset="dialog"
    type="warning"
    :positive-text="$t('page.aiplatform.payment.rejectModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting, type: 'warning' }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px">
      {{ $t('page.aiplatform.payment.rejectModal.tip', { name: node?.name ?? '-' }) }}
    </p>
    <NInput
      v-model:value="basis"
      type="textarea"
      :rows="3"
      :maxlength="1000"
      show-count
      :placeholder="$t('page.aiplatform.payment.rejectModal.basisPlaceholder')"
    />
  </NModal>
</template>
