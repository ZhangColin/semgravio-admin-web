<script setup lang="ts">
/**
 * 订单范围录入弹窗（#92）——交付清单/验收方式/工期口径三段整组替换；空白显式归一 null
 * （清空该段终态），表单明示语义。回执不消费：成功由父抽屉 toast＋回读详情；ORD_033 等
 * 服务端守卫经 onError 原样透传，失败保持弹窗可修正重试。
 */
import { reactive, ref, watch } from 'vue';
import { NInput, NModal } from 'naive-ui';
import { fetchEnterAiplatformOrderScope } from '@/service/api';
import { $t } from '@/locales';
import { trimmedOrNull } from '@/utils/common';

defineOptions({ name: 'OrderScopeModal' });

const props = defineProps<{
  orderId: string;
  detail: Api.Aiplatform.OrderDetail | null;
}>();

const emit = defineEmits<{
  success: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });
const submitting = ref(false);
const model = reactive({ scopeDeliverables: '', scopeAcceptance: '', scopeTimeline: '' });

watch(visible, val => {
  if (!val) return;
  model.scopeDeliverables = props.detail?.scopeDeliverables ?? '';
  model.scopeAcceptance = props.detail?.scopeAcceptance ?? '';
  model.scopeTimeline = props.detail?.scopeTimeline ?? '';
});

async function handleConfirm() {
  submitting.value = true;
  const { error } = await fetchEnterAiplatformOrderScope(props.orderId, {
    scopeDeliverables: trimmedOrNull(model.scopeDeliverables),
    scopeAcceptance: trimmedOrNull(model.scopeAcceptance),
    scopeTimeline: trimmedOrNull(model.scopeTimeline)
  });
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success');
    return true;
  }
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t('page.aiplatform.order.scopeModal.title')"
    preset="dialog"
    :positive-text="$t('page.aiplatform.order.scopeModal.confirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ loading: submitting }"
    @positive-click="handleConfirm"
  >
    <p class="py-8px text-13px text-#999">{{ $t('page.aiplatform.order.scopeModal.tip') }}</p>
    <div class="flex-col-stretch gap-8px">
      <NInput
        v-model:value="model.scopeDeliverables"
        type="textarea"
        :rows="3"
        maxlength="2000"
        :placeholder="$t('page.aiplatform.order.scopeModal.deliverablesPlaceholder')"
      />
      <NInput
        v-model:value="model.scopeAcceptance"
        type="textarea"
        :rows="3"
        maxlength="2000"
        :placeholder="$t('page.aiplatform.order.scopeModal.acceptancePlaceholder')"
      />
      <NInput
        v-model:value="model.scopeTimeline"
        type="textarea"
        :rows="3"
        maxlength="2000"
        :placeholder="$t('page.aiplatform.order.scopeModal.timelinePlaceholder')"
      />
    </div>
  </NModal>
</template>
