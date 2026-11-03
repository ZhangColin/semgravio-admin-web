<script setup lang="ts">
/**
 * 订单报价/改价弹窗（#57）——amount（元输入，提交转整数分）+ note（选填 ≤1000）。
 *
 * 已报价态重复提交＝改价（provider 端点同一）：requote 模式预填当前金额/备注。
 * 金额校验正数（provider 守卫 ORD_008 裁决非正——前端只做基础正数拦截，错误走透传 toast）。
 *
 * 金额输入用 NInput 而非 NInputNumber（payment 筛选条用后者）：NInputNumber 的 v-model
 * 仅在 blur/Enter 时提交，弹窗内「输完即点确认」会先撞上禁用态（点空白处才解锁，真实 UX 死胡同）；
 * NInput 逐键绑定 + 确认时解析，合法即解禁。校验/预填用 utils 共用件
 * （parsePositiveYuan / centsToYuanText——#89 起收编，本 modal 为落地先例）。
 */
import { computed, ref, watch } from 'vue';
import { NForm, NFormItem, NInput, NModal } from 'naive-ui';
import { fetchQuoteAiplatformOrder } from '@/service/api';
import { $t } from '@/locales';
import { centsToYuanText, parsePositiveYuan } from '@/utils/common';

defineOptions({ name: 'OrderQuoteModal' });

const props = defineProps<{
  orderId: string;
  /** quote=待报价首报 / requote=已报价改价（预填） */
  mode: 'quote' | 'requote';
  /** 当前价（分）——requote 预填用 */
  currentAmountCents?: string | null;
  currentNote?: string | null;
}>();

const emit = defineEmits<{
  /** 报价成功（父页 toast 后回读详情 + 刷列表） */
  success: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const amountText = ref('');
const note = ref('');
const submitting = ref(false);

watch(visible, val => {
  if (!val) return;
  amountText.value = props.mode === 'requote' ? centsToYuanText(props.currentAmountCents) : '';
  note.value = props.mode === 'requote' ? (props.currentNote ?? '') : '';
});

/** 正数（≤2 位小数）即解禁；确认时再取整转分。 */
const parsedAmountYuan = computed(() => parsePositiveYuan(amountText.value));

const isValid = computed(() => parsedAmountYuan.value !== null);

async function handleConfirm() {
  if (!isValid.value) return false;
  const command: Api.Aiplatform.QuoteOrderCommand = {
    amount: Math.round((parsedAmountYuan.value as number) * 100),
    note: note.value.trim() || undefined
  };
  submitting.value = true;
  const { error } = await fetchQuoteAiplatformOrder(props.orderId, command);
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success');
    return true;
  }
  // 失败：onError 已统一弹透传 message；返回 false 阻止 preset dialog 自动关闭（用户可修正重试）
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="mode === 'requote' ? $t('page.aiplatform.order.quoteModal.requoteTitle') : $t('page.aiplatform.order.quoteModal.title')"
    preset="dialog"
    :positive-text="$t('page.aiplatform.order.quoteModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting }"
    @positive-click="handleConfirm"
  >
    <NForm label-placement="top" class="pt-12px">
      <NFormItem :label="$t('page.aiplatform.order.quoteModal.amount')">
        <NInput
          v-model:value="amountText"
          :placeholder="$t('page.aiplatform.order.quoteModal.amountPlaceholder')"
          :input-props="{ inputmode: 'decimal' }"
          clearable
          class="w-full"
        />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.order.quoteModal.note')">
        <NInput
          v-model:value="note"
          type="textarea"
          :rows="3"
          :maxlength="1000"
          show-count
          :placeholder="$t('page.aiplatform.order.quoteModal.notePlaceholder')"
        />
      </NFormItem>
    </NForm>
  </NModal>
</template>
