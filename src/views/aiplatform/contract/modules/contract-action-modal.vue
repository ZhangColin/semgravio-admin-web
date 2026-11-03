<script setup lang="ts">
/**
 * 合同六写共用弹窗（#87）——advance/fail/withdraw/void 共用 basis-only 确认形态；sign 加
 * party 单选（1=甲方客户方 2=乙方服务方）。
 *
 * basis 必填（空禁用确认——ORD_022 前端先行拦截）≤1000（ORD_023 服务端兜底）；确认文案按
 * action 插值、合同号对账锚（cancel-modal 先例）。成功关窗 emit 回父页（toast＋回读＋刷新在
 * 父页收口）；失败保持弹窗可修正重试（onError 已统一透传 toast——ORD_021/027/028 等不判码）。
 */
import { computed, ref, watch } from 'vue';
import { NInput, NModal, NRadio, NRadioGroup } from 'naive-ui';
import {
  fetchAdvanceAiplatformContract,
  fetchFailAiplatformContract,
  fetchSignAiplatformContract,
  fetchVoidAiplatformContract,
  fetchWithdrawAiplatformContract
} from '@/service/api';
import { $t } from '@/locales';

defineOptions({ name: 'ContractActionModal' });

/** 本弹窗承载的写动作（六写中除 record——record 走独立五肢表单弹窗）。 */
type ModalAction = Exclude<Api.Aiplatform.ContractAction, 'record'>;

/** basis-only 四写请求映射（收口单点，material WRITE_FETCH 先例）；sign 因 party 参数独立分支。 */
const BASIS_ONLY_FETCH: Record<Exclude<ModalAction, 'sign'>, (id: string, data: Api.Aiplatform.ContractActionCommand) => ReturnType<typeof fetchAdvanceAiplatformContract>> = {
  advance: fetchAdvanceAiplatformContract,
  fail: fetchFailAiplatformContract,
  withdraw: fetchWithdrawAiplatformContract,
  void: fetchVoidAiplatformContract
};

const props = defineProps<{
  action: ModalAction;
  /** 目标合同（id 寻址＋contractNo 对账锚；行下拉/抽屉双入口同形）。 */
  contract: { id: string; contractNo: string } | null;
}>();

const emit = defineEmits<{
  /** 六写之一成功（父页 toast＋抽屉回读＋列表刷新）。 */
  success: [action: Api.Aiplatform.ContractAction];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const basis = ref('');
const party = ref<Api.Aiplatform.ContractSignParty | null>(null);
const submitting = ref(false);

watch(visible, val => {
  if (val) {
    basis.value = '';
    party.value = null;
  }
});

/** basis 必填非空白；sign 另需 party 已选。 */
const isValid = computed(() => basis.value.trim().length > 0 && (props.action !== 'sign' || party.value !== null));

/** 动作中文名（标题/确认钮/提示文案插值共用单点）。 */
const actionLabel = computed(() => $t(`page.aiplatform.contract.action.${props.action}`));

async function handleConfirm() {
  if (!isValid.value || !props.contract) return false;
  submitting.value = true;
  const id = props.contract.id;
  const command = { basis: basis.value.trim() };
  const { error } =
    props.action === 'sign'
      ? await fetchSignAiplatformContract(id, { party: party.value as Api.Aiplatform.ContractSignParty, basis: command.basis })
      : await BASIS_ONLY_FETCH[props.action](id, command);
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success', props.action);
    return true;
  }
  // 失败保持弹窗（同 cancel-modal：preset dialog 返回 false 阻止自动关闭）
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.contract.actionModal.title', { action: actionLabel })"
    preset="dialog"
    type="warning"
    :positive-text="$t('page.aiplatform.contract.actionModal.confirm', { action: actionLabel })"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting, type: 'warning' }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px">
      {{ $t('page.aiplatform.contract.actionModal.tip', { contractNo: contract?.contractNo ?? '-', action: actionLabel }) }}
    </p>
    <!-- sign 变体：签署方单选（1=甲方客户方 2=乙方服务方；已落位幂等拒由服务端 ORD_028 兜底） -->
    <NRadioGroup v-if="action === 'sign'" v-model:value="party" class="mb-8px" name="contract-sign-party">
      <NRadio :value="1">{{ $t('page.aiplatform.contract.actionModal.partyA') }}</NRadio>
      <NRadio :value="2">{{ $t('page.aiplatform.contract.actionModal.partyB') }}</NRadio>
    </NRadioGroup>
    <NInput
      v-model:value="basis"
      type="textarea"
      :rows="3"
      maxlength="1000"
      show-count
      :placeholder="$t('page.aiplatform.contract.actionModal.basisPlaceholder')"
    />
  </NModal>
</template>
