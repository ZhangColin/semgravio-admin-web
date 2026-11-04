<script setup lang="ts">
/**
 * 生产承接签（#92）——按项目寻址的两态承接面：四段信息（null 如实「—」）＋statusName
 * 直读＋留痕时间线新→旧（创建行 operatorId=system 呈现「系统建档」）。切签挂载即加载。
 */
import { computed, h, ref } from 'vue';
import { NButton, NEmpty, NInput, NSpin, NSwitch, NTag, NTimeline, NTimelineItem } from 'naive-ui';
import { PRODUCTION_ADVANCE_AUTH, PRODUCTION_SUPPLEMENT_AUTH, PRODUCTION_UPDATE_AUTH, productionStatusTagColor } from '@/constants/aiplatform';
import { fetchAdvanceAiplatformProductionHandoff, fetchGetAiplatformProductionHandoff, fetchSetAiplatformProductionSupplement } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/common';
import ProductionUpdateModal from './production-update-modal.vue';

defineOptions({ name: 'ProductionHandoffPane' });

const props = defineProps<{
  projectId: string;
}>();

const detail = ref<Api.Aiplatform.ProductionHandoff | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  const { data, error } = await fetchGetAiplatformProductionHandoff(props.projectId);
  loading.value = false;
  if (!error) detail.value = data;
}

const { hasAuth } = useAuth();
const canUpdate = hasAuth(PRODUCTION_UPDATE_AUTH);
const canAdvance = computed(() => detail.value?.status === 1 && hasAuth(PRODUCTION_ADVANCE_AUTH));
const updateModalVisible = ref(false);
const advanceBasis = ref('');

function handleAdvance() {
  advanceBasis.value = '';
  window.$dialog?.warning({
    title: $t('page.aiplatform.production.advanceConfirm.title'),
    content: () =>
      h('div', { class: 'flex-col-stretch gap-8px' }, [
        h('p', { class: 'text-13px text-#999' }, $t('page.aiplatform.production.advanceConfirm.tip')),
        h(NInput, {
          value: advanceBasis.value,
          type: 'textarea',
          rows: 3,
          maxlength: 1000,
          placeholder: $t('page.aiplatform.production.advanceConfirm.basisPlaceholder'),
          'onUpdate:value': (value: string) => {
            advanceBasis.value = value;
          }
        })
      ]),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const basis = advanceBasis.value.trim();
      if (!basis) return false;
      const { data, error } = await fetchAdvanceAiplatformProductionHandoff(props.projectId, { basis });
      if (!error && data) {
        // 推进回执＝全量详情（含新留痕行）——直填整签，免二次 GET。
        detail.value = data;
        window.$message?.success($t('page.aiplatform.production.success.advanced'));
      }
      // PRJ_056 等错误由 onError 原样透传；稳态门控之外不另判业务码。
      return true;
    }
  });
}

const canSupplement = hasAuth(PRODUCTION_SUPPLEMENT_AUTH);
// null＝读面未下发（未知），不冒充 false；已确认值提升到父抽屉，切签重挂不丢。
const supplementRequired = defineModel<boolean | null>('supplementRequired', { default: null });
const supplementSubmitting = ref(false);

function handleSupplement(required: boolean) {
  window.$dialog?.warning({
    title: $t(required ? 'page.aiplatform.production.supplementConfirm.setTitle' : 'page.aiplatform.production.supplementConfirm.clearTitle'),
    content: $t(required ? 'page.aiplatform.production.supplementConfirm.setTip' : 'page.aiplatform.production.supplementConfirm.clearTip'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      supplementSubmitting.value = true;
      const { error } = await fetchSetAiplatformProductionSupplement(props.projectId, { required });
      supplementSubmitting.value = false;
      if (!error) {
        // 回执 data=null 不消费：成功后才推动受控开关，并回读承接其余事实。
        // admin HEAD 的 handoff 读面不含盖帽布尔；已确认值由父抽屉跨切签保留，重开抽屉仍明示未知。
        supplementRequired.value = required;
        window.$message?.success(
          $t(required ? 'page.aiplatform.production.success.supplementSet' : 'page.aiplatform.production.success.supplementCleared')
        );
        await load();
      }
      return true;
    }
  });
}

function handleUpdated(updated: Api.Aiplatform.ProductionHandoff) {
  // 更新回执＝全量详情（含时间线）——响应即新事实，整签直填不二次 GET（沙箱先例）。
  detail.value = updated;
  window.$message?.success($t('page.aiplatform.production.success.updated'));
}

function operatorText(transition: Api.Aiplatform.ProductionTransition) {
  if (transition.operatorId === 'system') return $t('page.aiplatform.production.systemCreated');
  return transition.operatorName ?? transition.operatorId ?? '—';
}

load();
</script>

<template>
  <div v-if="loading" class="flex-center min-h-300px">
    <NSpin />
  </div>
  <div v-else-if="detail" class="flex-col-stretch gap-16px">
    <div class="flex items-center gap-8px">
      <span class="text-13px text-#999">{{ $t('page.aiplatform.production.status') }}</span>
      <NTag :type="productionStatusTagColor[detail.status]" size="small">{{ detail.statusName }}</NTag>
      <NButton v-if="canAdvance" class="ml-auto" type="primary" size="small" @click="handleAdvance">
        {{ $t('page.aiplatform.production.action.advance') }}
      </NButton>
      <NButton v-if="canUpdate" :class="{ 'ml-auto': !canAdvance }" type="primary" ghost size="small" @click="updateModalVisible = true">
        {{ $t('page.aiplatform.production.action.update') }}
      </NButton>
    </div>

    <div v-if="canSupplement" class="flex items-center gap-8px text-13px">
      <span>{{ $t('page.aiplatform.production.needsUserSupplement') }}</span>
      <NSwitch
        :value="supplementRequired === true"
        :loading="supplementSubmitting"
        size="small"
        :aria-label="$t('page.aiplatform.production.needsUserSupplement')"
        @update:value="handleSupplement"
      />
      <span v-if="supplementRequired === null" class="text-12px text-#999">
        {{ $t('page.aiplatform.production.supplementStateUnknown') }}
      </span>
    </div>

    <div class="desc-table">
      <div class="desc-row">
        <div class="desc-label">{{ $t('page.aiplatform.production.contact') }}</div>
        <div class="desc-value whitespace-pre-wrap">{{ detail.contact ?? '—' }}</div>
      </div>
      <div class="desc-row">
        <div class="desc-label">{{ $t('page.aiplatform.production.nextStep') }}</div>
        <div class="desc-value whitespace-pre-wrap">{{ detail.nextStep ?? '—' }}</div>
      </div>
      <div class="desc-row">
        <div class="desc-label">{{ $t('page.aiplatform.production.progressNote') }}</div>
        <div class="desc-value whitespace-pre-wrap">{{ detail.progressNote ?? '—' }}</div>
      </div>
      <div class="desc-row">
        <div class="desc-label">{{ $t('page.aiplatform.production.estimatedStartAt') }}</div>
        <div class="desc-value">{{ detail.estimatedStartAt ? formatDateTime(detail.estimatedStartAt) : '—' }}</div>
      </div>
    </div>

    <section>
      <div class="mb-12px font-600">{{ $t('page.aiplatform.production.transitions') }}</div>
      <NTimeline>
        <NTimelineItem
          v-for="(transition, index) in detail.transitions"
          :key="`${transition.createdAt}-${index}`"
          :title="transition.actionName"
          :content="`${transition.fromStatusName} → ${transition.toStatusName}\n${transition.basis}`"
          :time="formatDateTime(transition.createdAt)"
        >
          <template #footer>
            <span class="text-12px text-#999">{{ operatorText(transition) }}</span>
          </template>
        </NTimelineItem>
      </NTimeline>
    </section>

    <ProductionUpdateModal v-model:visible="updateModalVisible" :project-id="projectId" :detail="detail" @success="handleUpdated" />
  </div>
  <NEmpty v-else :description="$t('page.aiplatform.production.empty')" />
</template>

<style scoped>
.desc-table {
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
}
.desc-row {
  display: flex;
  border-bottom: 1px solid var(--n-border-color);
}
.desc-row:last-child {
  border-bottom: none;
}
.desc-label {
  flex-shrink: 0;
  width: 120px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--n-text-color-3);
  background: var(--n-color-embedded);
  border-right: 1px solid var(--n-border-color);
}
.desc-value {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
}

@media (max-width: 639px) {
  .desc-row {
    flex-direction: column;
  }
  .desc-label {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--n-border-color);
  }
}
</style>
