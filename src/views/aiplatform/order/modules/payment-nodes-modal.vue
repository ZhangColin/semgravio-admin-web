<script setup lang="ts">
/**
 * 付款节点录入弹窗（#89）——整组替换（不收半组，每次全量提交）：每条＝名称/金额（元输入，
 * 提交转整数分）/开工门标志。序号按列表序服务端派生（录入序即展示序）、附言码自合同号定格。
 *
 * 重录唯一窗口（支付活动未开始）由服务端裁决（409 ORD_044）——前端**不预判**（可观测推导
 * 复杂易漂移），按钮常给、弹窗可开；录入无效（至少一条/名称必填/金额为正 ORD_039）做基础
 * 先行拦截，服务端兜底透传。有既有节点时整组预填（重录＝改后整组再提交）。
 * 金额输入用 NInput（quote-modal 先例：NInputNumber 失焦才提交，弹窗内即输即点会撞禁用态）；
 * 校验/预填用 utils 共用件（parsePositiveYuan / centsToYuanText）。
 */
import { computed, ref, watch } from 'vue';
import { NButton, NInput, NModal, NSwitch } from 'naive-ui';
import { fetchEnterAiplatformPaymentNodes } from '@/service/api';
import { $t } from '@/locales';
import { centsToYuanText, parsePositiveYuan } from '@/utils/common';

defineOptions({ name: 'PaymentNodesModal' });

interface NodeRow {
  name: string;
  amountText: string;
  kickoffGate: boolean;
}

const props = defineProps<{
  orderId: string;
  /** 既有节点（整组预填＝重录；空表＝首次录入）。 */
  nodes: Api.Aiplatform.PaymentNode[];
}>();

const emit = defineEmits<{
  /** 录入成功（父面 toast＋回读 plan detail）。 */
  success: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const rows = ref<NodeRow[]>([]);
const submitting = ref(false);

watch(visible, val => {
  if (!val) return;
  rows.value = props.nodes.length
    ? props.nodes.map(node => ({
        name: node.name,
        amountText: centsToYuanText(node.amount),
        kickoffGate: node.kickoffGate
      }))
    : [{ name: '', amountText: '', kickoffGate: false }];
});

function addRow() {
  rows.value.push({ name: '', amountText: '', kickoffGate: false });
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
}

/** 整组合法：≥1 条、每条名称非空白＋金额正数（≤2 位小数——确认时再取整转分）。 */
const isValid = computed(
  () => rows.value.length > 0 && rows.value.every(row => row.name.trim() !== '' && parsePositiveYuan(row.amountText) !== null)
);

async function handleConfirm() {
  if (!isValid.value) return false;
  const command: Api.Aiplatform.PaymentNodesCommand = {
    nodes: rows.value.map(row => ({
      name: row.name.trim(),
      amount: Math.round((parsePositiveYuan(row.amountText) as number) * 100),
      kickoffGate: row.kickoffGate
    }))
  };
  submitting.value = true;
  const { error } = await fetchEnterAiplatformPaymentNodes(props.orderId, command);
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success');
    return true;
  }
  // 失败：onError 已透传 toast（ORD_044 重录窗口/ORD_039 录入无效）；保持弹窗可修正重试
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.payment.nodesModal.title')"
    preset="dialog"
    :positive-text="$t('page.aiplatform.payment.nodesModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px text-13px text-#999">{{ $t('page.aiplatform.payment.nodesModal.tip') }}</p>
    <div class="flex-col-stretch gap-8px">
      <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-8px">
        <NInput
          v-model:value="row.name"
          :placeholder="$t('page.aiplatform.payment.nodesModal.namePlaceholder')"
          class="min-w-120px flex-1"
        />
        <NInput
          v-model:value="row.amountText"
          :placeholder="$t('page.aiplatform.payment.nodesModal.amountPlaceholder')"
          :input-props="{ inputmode: 'decimal' }"
          class="w-110px"
        />
        <span class="w-56px shrink-0 text-center text-12px text-#999">{{ $t('page.aiplatform.payment.nodesModal.kickoffGate') }}</span>
        <NSwitch v-model:value="row.kickoffGate" size="small" />
        <NButton quaternary type="error" size="small" :disabled="rows.length === 1" @click="removeRow(i)">
          {{ $t('common.delete') }}
        </NButton>
      </div>
      <NButton dashed size="small" @click="addRow">
        {{ $t('page.aiplatform.payment.nodesModal.addRow') }}
      </NButton>
    </div>
  </NModal>
</template>
