<script setup lang="ts">
/** 边缘调用点窄面板（#91）：仅模型档位一件；留痕默认收起，写体严格窄化为 {modelId}。 */
import { computed, onMounted, ref } from 'vue';
import { AGENT_CONFIG_UPDATE_AUTH, edgeKeyLabel } from '@/constants/aiplatform';
import {
  fetchGetAiplatformEdgeModelConfig,
  fetchGetAiplatformEdgeModelTraces,
  fetchUpdateAiplatformEdgeModel
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/common';
import ModelTierSelect from './model-tier-select.vue';

const props = withDefaults(
  defineProps<{
    edgeKey: Api.Aiplatform.EdgeKey;
    modelTiers: Api.Aiplatform.ModelTier[];
    tierLoading?: boolean;
  }>(),
  { tierLoading: false }
);

const { hasAuth } = useAuth();
const loading = ref(false);
const saving = ref(false);
const config = ref<Api.Aiplatform.EdgeModelConfig | null>(null);
const traces = ref<Api.Aiplatform.AgentConfigTrace[]>([]);
const modelId = ref<string | null>('');
const expandedNames = ref<string[]>([]);

const panelTitle = computed(() => config.value?.agentName ?? $t(edgeKeyLabel[props.edgeKey]));

async function load() {
  loading.value = true;
  const [configRes, tracesRes] = await Promise.all([
    fetchGetAiplatformEdgeModelConfig(props.edgeKey),
    fetchGetAiplatformEdgeModelTraces(props.edgeKey)
  ]);
  if (!configRes.error && configRes.data) {
    config.value = configRes.data;
    modelId.value = configRes.data.modelId;
  }
  if (!tracesRes.error) traces.value = tracesRes.data ?? [];
  loading.value = false;
}

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateAiplatformEdgeModel(props.edgeKey, { modelId: modelId.value });
  saving.value = false;
  if (!error) {
    window.$message?.success($t('page.aiplatform.agentConfig.edit.saved', { agent: panelTitle.value }));
    load();
  }
}

function formatTraceValue(value: string | null) {
  return value ?? $t('page.aiplatform.agentConfig.defaultValue');
}

onMounted(load);
</script>

<template>
  <NCard :data-edge-key="edgeKey" :title="panelTitle" :bordered="false" size="small">
    <div v-if="loading" class="flex-center min-h-96px">
      <NSpin />
    </div>
    <template v-else-if="config">
      <NForm label-placement="top" :show-feedback="false">
        <NFormItem>
          <template #label>
            <span class="flex items-center gap-8px">
              {{ $t('page.aiplatform.agentConfig.edit.modelId') }}
              <NTag size="small" :type="config.modelIdOverridden ? 'warning' : 'default'">
                {{ $t(config.modelIdOverridden ? 'page.aiplatform.agentConfig.edit.overridden' : 'page.aiplatform.agentConfig.edit.defaultTag') }}
              </NTag>
            </span>
          </template>
          <div class="w-full flex-col-stretch gap-4px">
            <ModelTierSelect v-model:value="modelId" :tiers="modelTiers" :loading="tierLoading" />
            <div class="text-12px text-gray-400">
              {{ $t('page.aiplatform.agentConfig.edit.fallbackModel', { model: config.defaultModelId }) }}
            </div>
          </div>
        </NFormItem>
      </NForm>
      <div v-if="hasAuth(AGENT_CONFIG_UPDATE_AUTH)" class="mb-12px flex justify-end">
        <NButton type="primary" size="small" :loading="saving" @click="handleSave">
          {{ $t('page.aiplatform.agentConfig.edit.save') }}
        </NButton>
      </div>
      <NCollapse v-model:expanded-names="expandedNames">
        <NCollapseItem :title="$t('page.aiplatform.agentConfig.traces.title')" name="traces">
          <NTimeline v-if="expandedNames.includes('traces') && traces.length" size="large">
            <NTimelineItem v-for="trace in traces" :key="trace.id" type="info" :time="formatDateTime(trace.operatedAt)">
              <div v-if="trace.oldModelId !== trace.newModelId" class="mt-2px text-13px">
                <span class="text-[var(--n-text-color-3)]">{{ $t('page.aiplatform.agentConfig.field.modelId') }}：</span>
                <span class="font-mono">{{ formatTraceValue(trace.oldModelId) }}</span>
                <span class="mx-4px">→</span>
                <span class="font-mono">{{ formatTraceValue(trace.newModelId) }}</span>
              </div>
              <div class="mt-4px text-12px text-[var(--n-text-color-3)]">{{ trace.operatorName }}</div>
            </NTimelineItem>
          </NTimeline>
          <div v-else-if="expandedNames.includes('traces')" class="py-12px text-center text-14px text-gray-400">
            {{ $t('page.aiplatform.agentConfig.traces.empty') }}
          </div>
        </NCollapseItem>
      </NCollapse>
    </template>
  </NCard>
</template>
