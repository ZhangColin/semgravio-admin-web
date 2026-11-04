<script setup lang="ts">
/**
 * 合同草稿重录弹窗（#87）——「需更新」处置正路：五肢整组（甲乙方/范围/付款计划＋依据）。
 *
 * 仅草稿态（1/2）可达（矩阵门控；3 起 ORD_031 服务端兜底）；抽屉入口预填四预览字段现值、
 * 行下拉入口空表单——整组替换语义：**空＝未录入**（提交归一 null，重录后四字段以本次为准）；
 * 同号 version+1、needsUpdate 清零、冻结集取订单现值重新定格（服务端）。basis 必填 ≤1000
 * （ORD_022/023 拦截同六写 modal）；内容长度归 provider（ORD_032：主体 200/其余 2000）。
 */
import { computed, reactive, ref, watch } from 'vue';
import { NInput, NModal } from 'naive-ui';
import { fetchRecordAiplatformContract } from '@/service/api';
import { $t } from '@/locales';
import { trimmedOrNull } from '@/utils/common';

defineOptions({ name: 'ContractRecordModal' });

const props = defineProps<{
  /** 目标合同（抽屉入口携四预览字段现值预填；行下拉入口仅 id/contractNo——空表单整组录入）。 */
  contract: {
    id: string;
    contractNo: string;
    partyA?: string | null;
    partyB?: string | null;
    projectScope?: string | null;
    paymentPlan?: string | null;
  } | null;
}>();

const emit = defineEmits<{
  /** 重录成功（父页 toast＋抽屉回读＋列表刷新）。 */
  success: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const model = reactive({
  partyA: '',
  partyB: '',
  projectScope: '',
  paymentPlan: '',
  basis: ''
});
const submitting = ref(false);

watch(visible, val => {
  if (val) {
    // 预填四预览字段现值（未录入 null → 空＝维持未录入；整组替换语义表单明示）
    model.partyA = props.contract?.partyA ?? '';
    model.partyB = props.contract?.partyB ?? '';
    model.projectScope = props.contract?.projectScope ?? '';
    model.paymentPlan = props.contract?.paymentPlan ?? '';
    model.basis = '';
  }
});

const isValid = computed(() => model.basis.trim().length > 0);

async function handleConfirm() {
  if (!isValid.value || !props.contract) return false;
  submitting.value = true;
  const { error } = await fetchRecordAiplatformContract(props.contract.id, {
    partyA: trimmedOrNull(model.partyA),
    partyB: trimmedOrNull(model.partyB),
    projectScope: trimmedOrNull(model.projectScope),
    paymentPlan: trimmedOrNull(model.paymentPlan),
    basis: model.basis.trim()
  });
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success');
    return true;
  }
  // 失败保持弹窗（onError 已统一透传 toast——ORD_031/032 不判码）
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.contract.recordModal.title')"
    preset="dialog"
    type="warning"
    :positive-text="$t('page.aiplatform.contract.recordModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting, type: 'warning' }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px">{{ $t('page.aiplatform.contract.recordModal.tip', { contractNo: contract?.contractNo ?? '-' }) }}</p>
    <div class="flex-col-stretch gap-8px">
      <NInput v-model:value="model.partyA" maxlength="200" :placeholder="$t('page.aiplatform.contract.recordModal.partyAPlaceholder')" />
      <NInput v-model:value="model.partyB" maxlength="200" :placeholder="$t('page.aiplatform.contract.recordModal.partyBPlaceholder')" />
      <NInput
        v-model:value="model.projectScope"
        type="textarea"
        :rows="2"
        maxlength="2000"
        :placeholder="$t('page.aiplatform.contract.recordModal.projectScopePlaceholder')"
      />
      <NInput
        v-model:value="model.paymentPlan"
        type="textarea"
        :rows="2"
        maxlength="2000"
        :placeholder="$t('page.aiplatform.contract.recordModal.paymentPlanPlaceholder')"
      />
      <NInput
        v-model:value="model.basis"
        type="textarea"
        :rows="3"
        maxlength="1000"
        show-count
        :placeholder="$t('page.aiplatform.contract.recordModal.basisPlaceholder')"
      />
    </div>
  </NModal>
</template>
