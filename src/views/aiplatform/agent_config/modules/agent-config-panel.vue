<script setup lang="ts">
/**
 * 智能体配置面板（#69 初建；#91 主/强档双下拉）——单座编辑卡＋留痕时间线卡。
 *
 * systemPrompt 用 NTextarea；modelId/routingStrongModelId 共用档位下拉（页面级清单），
 * 覆盖标记「已覆盖/默认」＋默认预览；清空提交＝清覆盖回落默认。保存五字段全量回传——
 * webSearch/fetchUrl 两 flag 以 GET 原值透传；失败走 onError 透传 toast、表单保留。
 *
 * 留痕只渲染 old≠new 的五件变化项（null 显「（默认）」）；回滚＝确认后 old 五值 PUT
 * 写回（一次新变更、留新痕）→ toast＋双卡刷新。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { AGENT_CONFIG_UPDATE_AUTH, agentKeyLabel } from '@/constants/aiplatform';
import {
  fetchGetAiplatformAgentConfig,
  fetchGetAiplatformAgentConfigTraces,
  fetchUpdateAiplatformAgentConfig
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/common';
import ModelTierSelect from './model-tier-select.vue';

defineOptions({ name: 'AgentConfigPanel' });

const props = defineProps<{
  /** 配置座稳定键（路径段寻址；签 label 由父页 tab 承载，toast 插值用 agentKeyLabel）。 */
  agentKey: Api.Aiplatform.AgentKey;
  /** 页面级共享档位清单（本 panel 不重复拉取）。 */
  modelTiers: Api.Aiplatform.ModelTier[];
  tierLoading?: boolean;
}>();

const { hasAuth } = useAuth();

const loading = ref(false);
const saving = ref(false);
const config = ref<Api.Aiplatform.AgentConfig | null>(null);
const traces = ref<Api.Aiplatform.AgentConfigTrace[]>([]);

/** 编辑态（生效值直灌——未覆盖时即默认原文，清空提交＝回落）；保存按原样透传（契约收纯空白＝清覆盖）。 */
const form = reactive<{ systemPrompt: string; modelId: string | null; routingStrongModelId: string | null }>({
  systemPrompt: '',
  modelId: '',
  routingStrongModelId: ''
});

/** 卡片题（读面到手直读 agentName；在途回落端侧映射——签 label 同源）。 */
const panelTitle = computed(() => config.value?.agentName ?? $t(agentKeyLabel[props.agentKey]));

/** 进入即并行拉读面＋留痕；成功直灌编辑态（失败走 onError 透传，卡面留空态）。 */
async function load() {
  loading.value = true;
  const [configRes, tracesRes] = await Promise.all([
    fetchGetAiplatformAgentConfig(props.agentKey),
    fetchGetAiplatformAgentConfigTraces(props.agentKey)
  ]);
  if (!configRes.error && configRes.data) {
    config.value = configRes.data;
    form.systemPrompt = configRes.data.systemPrompt;
    form.modelId = configRes.data.modelId;
    form.routingStrongModelId = configRes.data.routingStrongModelId;
  }
  if (!tracesRes.error) traces.value = tracesRes.data ?? [];
  loading.value = false;
}

/** 保存（全量五字段回传）：PUT → toast（座名插值）→ 回读刷新（编辑卡＋时间线一起）。 */
async function handleSave() {
  saving.value = true;
  const { error: err } = await fetchUpdateAiplatformAgentConfig(props.agentKey, {
    systemPrompt: form.systemPrompt,
    modelId: form.modelId,
    // 两 flag 原值透传（防静默误开）；config 表单不动开关——开关走工具面 tool 端点
    webSearchEnabled: config.value!.webSearchEnabled,
    fetchUrlEnabled: config.value!.fetchUrlEnabled,
    routingStrongModelId: form.routingStrongModelId
  });
  saving.value = false;
  if (!err) {
    window.$message?.success($t('page.aiplatform.agentConfig.edit.saved', { agent: panelTitle.value }));
    load();
  }
}

/** 留痕值面五件键（old/new 对的字段名——变化项投影与 label 映射共用）。 */
type TraceFieldKey = 'systemPrompt' | 'modelId' | 'routingStrongModelId' | 'webSearchEnabled' | 'fetchUrlEnabled';

interface TraceFieldChange {
  key: TraceFieldKey;
  from: string | boolean | null;
  to: string | boolean | null;
}

/** 变化项 label（i18n key 单点——编辑卡两字段与时间线共用同款键）。 */
const FIELD_LABEL: Record<TraceFieldKey, App.I18n.I18nKey> = {
  systemPrompt: 'page.aiplatform.agentConfig.field.systemPrompt',
  modelId: 'page.aiplatform.agentConfig.field.modelId',
  routingStrongModelId: 'page.aiplatform.agentConfig.field.routingStrongModelId',
  webSearchEnabled: 'page.aiplatform.agentConfig.field.webSearch',
  fetchUrlEnabled: 'page.aiplatform.agentConfig.field.fetchUrl'
};

function changedFields(trace: Api.Aiplatform.AgentConfigTrace): TraceFieldChange[] {
  const pairs: TraceFieldChange[] = [
    { key: 'systemPrompt', from: trace.oldSystemPrompt, to: trace.newSystemPrompt },
    { key: 'modelId', from: trace.oldModelId, to: trace.newModelId },
    { key: 'routingStrongModelId', from: trace.oldRoutingStrongModelId, to: trace.newRoutingStrongModelId },
    { key: 'webSearchEnabled', from: trace.oldWebSearchEnabled, to: trace.newWebSearchEnabled },
    { key: 'fetchUrlEnabled', from: trace.oldFetchUrlEnabled, to: trace.newFetchUrlEnabled }
  ];
  return pairs.filter(pair => pair.from !== pair.to);
}

/** 变化值呈现：字符串 null＝「（默认）」；布尔＝开/关。 */
function formatFieldValue(value: string | boolean | null): string {
  if (value === null) return $t('page.aiplatform.agentConfig.defaultValue');
  if (typeof value === 'boolean') return $t(value ? 'page.aiplatform.agentConfig.stateOn' : 'page.aiplatform.agentConfig.stateOff');
  return value;
}

/** 回滚＝把该次变更前 old 五值快照 PUT 写回（一次新变更、将留新痕）→ toast＋双卡刷新。 */
function handleRollback(trace: Api.Aiplatform.AgentConfigTrace) {
  window.$dialog?.warning({
    title: $t('page.aiplatform.agentConfig.traces.rollbackTitle'),
    content: $t('page.aiplatform.agentConfig.traces.rollbackTip'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error: err } = await fetchUpdateAiplatformAgentConfig(props.agentKey, {
        systemPrompt: trace.oldSystemPrompt,
        modelId: trace.oldModelId,
        webSearchEnabled: trace.oldWebSearchEnabled,
        fetchUrlEnabled: trace.oldFetchUrlEnabled,
        routingStrongModelId: trace.oldRoutingStrongModelId
      });
      if (!err) {
        window.$message?.success($t('page.aiplatform.agentConfig.traces.rolledBack'));
        load();
      }
    }
  });
}

onMounted(load);
</script>

<template>
  <div class="flex-col-stretch gap-12px">
    <!-- 编辑卡：覆盖标记＋默认预览＋清空即回落 -->
    <NCard :title="panelTitle" :bordered="false" size="small">
      <template #header-extra>
        <!-- 最近写者（契约字段直读；从未配置＝null 不渲染） -->
        <span v-if="config?.operatorName" class="text-12px text-gray-400">
          {{ $t('page.aiplatform.agentConfig.edit.lastWrite', { name: config.operatorName, time: formatDateTime(config.updatedAt) }) }}
        </span>
      </template>
      <div v-if="loading" class="flex-center min-h-200px">
        <NSpin />
      </div>
      <template v-else-if="config">
        <NForm label-placement="top" :show-feedback="false" class="flex-col-stretch gap-16px">
          <!-- NFormItem 默认槽容器是 flex row：多子元素会并排错位（textarea 曾被挤塌成一字一行竖条）——输入框＋提示必须包在单一 w-full 容器里上下堆叠 -->
          <NFormItem>
            <template #label>
              <span class="flex items-center gap-8px">
                {{ $t('page.aiplatform.agentConfig.edit.systemPrompt') }}
                <NTag size="small" :type="config.systemPromptOverridden ? 'warning' : 'default'">
                  {{ $t(config.systemPromptOverridden ? 'page.aiplatform.agentConfig.edit.overridden' : 'page.aiplatform.agentConfig.edit.defaultTag') }}
                </NTag>
              </span>
            </template>
            <div class="w-full flex-col-stretch gap-4px">
              <NInput
                v-model:value="form.systemPrompt"
                type="textarea"
                :autosize="{ minRows: 6, maxRows: 14 }"
                :placeholder="$t('page.aiplatform.agentConfig.edit.systemPromptPlaceholder')"
              />
              <!-- 回落提示短句＋「查看默认」弹层看全文（默认提示词很长，不再铺灰字长墙） -->
              <div class="flex items-center gap-8px text-12px text-gray-400">
                <span>{{ $t('page.aiplatform.agentConfig.edit.fallbackPrompt') }}</span>
                <NPopover trigger="click">
                  <template #trigger>
                    <span class="cursor-pointer text-primary">
                      {{ $t('page.aiplatform.agentConfig.edit.viewDefault') }}
                    </span>
                  </template>
                  <div class="max-h-360px w-400px overflow-auto whitespace-pre-wrap text-13px leading-relaxed">
                    {{ config.defaultSystemPrompt }}
                  </div>
                </NPopover>
              </div>
            </div>
          </NFormItem>
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
              <ModelTierSelect v-model:value="form.modelId" :tiers="modelTiers" :loading="tierLoading" />
              <div class="text-12px text-gray-400">
                {{ $t('page.aiplatform.agentConfig.edit.fallbackModel', { model: config.defaultModelId }) }}
              </div>
            </div>
          </NFormItem>
          <NFormItem>
            <template #label>
              <span class="flex items-center gap-8px">
                {{ $t('page.aiplatform.agentConfig.edit.routingStrongModelId') }}
                <NTag size="small" :type="config.routingStrongModelIdOverridden ? 'warning' : 'default'">
                  {{ $t(config.routingStrongModelIdOverridden ? 'page.aiplatform.agentConfig.edit.overridden' : 'page.aiplatform.agentConfig.edit.defaultTag') }}
                </NTag>
              </span>
            </template>
            <div class="w-full flex-col-stretch gap-4px">
              <ModelTierSelect v-model:value="form.routingStrongModelId" :tiers="modelTiers" :loading="tierLoading" />
              <div class="text-12px text-gray-400">
                {{ $t('page.aiplatform.agentConfig.edit.fallbackModel', { model: config.defaultRoutingStrongModelId }) }}
              </div>
            </div>
          </NFormItem>
        </NForm>
        <!-- update 权限码门控保存钮（无码不渲染——六域按钮门控范式） -->
        <div v-if="hasAuth(AGENT_CONFIG_UPDATE_AUTH)" class="mt-16px flex justify-end">
          <NButton type="primary" size="small" :loading="saving" @click="handleSave">
            {{ $t('page.aiplatform.agentConfig.edit.save') }}
          </NButton>
        </div>
      </template>
    </NCard>

    <!-- 留痕时间线卡：倒序、只渲染变化项、null 显（默认）、条目回滚 -->
    <NCard :title="$t('page.aiplatform.agentConfig.traces.title')" :bordered="false" size="small">
      <div v-if="loading" class="flex-center min-h-120px">
        <NSpin />
      </div>
      <div v-else-if="traces.length" class="pt-8px">
        <!-- 服务端倒序（最近先）——如实渲染 -->
        <NTimeline size="large">
          <NTimelineItem v-for="trace in traces" :key="trace.id" type="info" :time="formatDateTime(trace.operatedAt)">
            <div v-for="field in changedFields(trace)" :key="field.key" class="mt-2px text-13px">
              <span class="text-[var(--n-text-color-3)]">{{ $t(FIELD_LABEL[field.key]) }}：</span>
              <!-- 长文本截断悬浮全文（title 直显），null＝（默认） -->
              <span class="inline-block max-w-480px truncate align-middle font-mono" :title="String(field.from)">
                {{ formatFieldValue(field.from) }}
              </span>
              <span class="mx-4px">→</span>
              <span class="inline-block max-w-480px truncate align-middle font-mono" :title="String(field.to)">
                {{ formatFieldValue(field.to) }}
              </span>
            </div>
            <div class="mt-4px flex items-center justify-between">
              <span class="text-12px text-[var(--n-text-color-3)]">{{ trace.operatorName }}</span>
              <!-- 回滚与保存同 PUT 配置写——update 码同门控 -->
              <NButton v-if="hasAuth(AGENT_CONFIG_UPDATE_AUTH)" size="tiny" quaternary type="warning" @click="handleRollback(trace)">
                {{ $t('page.aiplatform.agentConfig.traces.rollback') }}
              </NButton>
            </div>
          </NTimelineItem>
        </NTimeline>
      </div>
      <div v-else class="flex-center min-h-120px text-14px text-gray-400">
        {{ $t('page.aiplatform.agentConfig.traces.empty') }}
      </div>
    </NCard>
  </div>
</template>
