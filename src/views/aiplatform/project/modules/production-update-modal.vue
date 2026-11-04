<script setup lang="ts">
/**
 * 生产承接信息更新弹窗（#92）——五字段整组替换：四段空白显式归一 null（清空终态），
 * 预计开始时间提交 ISO-8601 本地串；依据必填。回执同详情含时间线，交由父签直填免回读。
 */
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { NDatePicker, NInput, NModal } from 'naive-ui';
import { fetchUpdateAiplatformProductionHandoff } from '@/service/api';
import { $t } from '@/locales';
import { trimmedOrNull, tsToIsoLocal } from '@/utils/common';

defineOptions({ name: 'ProductionUpdateModal' });

const props = defineProps<{
  projectId: string;
  detail: Api.Aiplatform.ProductionHandoff | null;
}>();

const emit = defineEmits<{
  success: [detail: Api.Aiplatform.ProductionHandoff];
}>();

const visible = defineModel<boolean>('visible', { default: false });
const submitting = ref(false);
const estimatedStartTs = ref<number | null>(null);
const model = reactive({ contact: '', nextStep: '', progressNote: '', basis: '' });

watch(visible, val => {
  if (!val) return;
  model.contact = props.detail?.contact ?? '';
  model.nextStep = props.detail?.nextStep ?? '';
  model.progressNote = props.detail?.progressNote ?? '';
  model.basis = '';
  estimatedStartTs.value = props.detail?.estimatedStartAt ? dayjs(props.detail.estimatedStartAt).valueOf() : null;
});

const isValid = computed(() => model.basis.trim().length > 0);

async function handleConfirm() {
  if (!isValid.value) return false;
  submitting.value = true;
  const { data, error } = await fetchUpdateAiplatformProductionHandoff(props.projectId, {
    contact: trimmedOrNull(model.contact),
    nextStep: trimmedOrNull(model.nextStep),
    progressNote: trimmedOrNull(model.progressNote),
    estimatedStartAt: estimatedStartTs.value === null ? null : tsToIsoLocal(estimatedStartTs.value),
    basis: model.basis.trim()
  });
  submitting.value = false;
  if (!error && data) {
    visible.value = false;
    emit('success', data);
    return true;
  }
  // 失败保持弹窗（PRJ_055/057/058 等由 onError 原样透传，不判码）。
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.production.updateModal.title')"
    preset="dialog"
    :positive-text="$t('page.aiplatform.production.updateModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px text-13px text-#999">{{ $t('page.aiplatform.production.updateModal.tip') }}</p>
    <div class="flex-col-stretch gap-8px">
      <NInput
        v-model:value="model.contact"
        maxlength="200"
        :placeholder="$t('page.aiplatform.production.updateModal.contactPlaceholder')"
      />
      <NInput
        v-model:value="model.nextStep"
        type="textarea"
        :rows="2"
        maxlength="1000"
        :placeholder="$t('page.aiplatform.production.updateModal.nextStepPlaceholder')"
      />
      <NInput
        v-model:value="model.progressNote"
        type="textarea"
        :rows="3"
        maxlength="2000"
        :placeholder="$t('page.aiplatform.production.updateModal.progressNotePlaceholder')"
      />
      <NDatePicker
        v-model:value="estimatedStartTs"
        type="datetime"
        clearable
        class="w-full"
        :placeholder="$t('page.aiplatform.production.updateModal.estimatedStartAtPlaceholder')"
      />
      <NInput
        v-model:value="model.basis"
        type="textarea"
        :rows="3"
        maxlength="1000"
        show-count
        :placeholder="$t('page.aiplatform.production.updateModal.basisPlaceholder')"
      />
    </div>
  </NModal>
</template>
