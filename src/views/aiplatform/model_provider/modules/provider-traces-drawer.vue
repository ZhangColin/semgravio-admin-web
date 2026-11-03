<script setup lang="tsx">
/**
 * 通道变更留痕抽屉（#88）——GET /{providerKey}/traces 时间倒序（服务端定死 operatedAt 倒序
 * ＝最近先，如实渲染）：一次实际变更的前后全量值快照，条目**只渲染变化项**（agent-config
 * 时间线先例）；**apiKey 快照恒掩码**（尾 4 位——留痕不是密钥找回面，铁律）。
 *
 * 创建痕（old 三件全 null）标「创建」、删除痕（new 三件全 null）标「删除」（append-only
 * 跨行存活——行删后留痕仍可读，入口挂行、行删入口自然消失）。per-trace「回滚」＝
 * **打开预填表单非直接 PUT**（apiKey 除外须重输全量——留痕只有掩码）：emit 回父页开更新
 * modal 按 old* 快照预填（＝一次新变更、将留新痕）；创建/删除痕无旧态可回不给回滚。
 */
import { ref, watch } from 'vue';
import { NSpin, NDrawer, NDrawerContent, NTag, NTimeline, NTimelineItem } from 'naive-ui';
import { modelProviderWriteAuth } from '@/constants/aiplatform';
import { fetchGetAiplatformModelProviderTraces } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/common';

defineOptions({ name: 'ProviderTracesDrawer' });

const props = defineProps<{
  /** 留痕主体通道（providerKey 寻址；回滚预填需行在场——入口挂行天然保证）。 */
  provider: Api.Aiplatform.ModelProvider | null;
}>();

const emit = defineEmits<{
  /** 按该痕旧值打开更新表单（父页收口 openUpdate 预填；apiKey 恒不预填）。 */
  rollback: [trace: Api.Aiplatform.ModelProviderTrace];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { hasAuth } = useAuth();

const loading = ref(false);
const traces = ref<Api.Aiplatform.ModelProviderTrace[]>([]);

async function load() {
  if (!props.provider) return;
  loading.value = true;
  const { data, error } = await fetchGetAiplatformModelProviderTraces(props.provider.providerKey);
  loading.value = false;
  if (!error) traces.value = data ?? [];
}

/** 回滚后父页刷新读面时同步回读留痕（modal 叠 drawer 之上，写成功两处都要新事实）。 */
defineExpose({ reload: load });

watch(visible, val => {
  if (!val) return;
  traces.value = [];
  load();
});

/** 留痕值面三件键（old/new 对的字段名——变化项投影与 label 映射共用）。 */
type TraceFieldKey = 'baseUrl' | 'apiKeyMasked' | 'enabled';

interface TraceFieldChange {
  key: TraceFieldKey;
  from: string | boolean | null;
  to: string | boolean | null;
}

/** 变化项 label（i18n key 单点）。 */
const FIELD_LABEL: Record<TraceFieldKey, App.I18n.I18nKey> = {
  baseUrl: 'page.aiplatform.modelProvider.tracesDrawer.field.baseUrl',
  apiKeyMasked: 'page.aiplatform.modelProvider.tracesDrawer.field.apiKey',
  enabled: 'page.aiplatform.modelProvider.tracesDrawer.field.enabled'
};

function changedFields(trace: Api.Aiplatform.ModelProviderTrace): TraceFieldChange[] {
  const pairs: TraceFieldChange[] = [
    { key: 'baseUrl', from: trace.oldBaseUrl, to: trace.newBaseUrl },
    { key: 'apiKeyMasked', from: trace.oldApiKeyMasked, to: trace.newApiKeyMasked },
    { key: 'enabled', from: trace.oldEnabled, to: trace.newEnabled }
  ];
  return pairs.filter(pair => pair.from !== pair.to);
}

/** 变化值呈现：null＝痕侧缺位（掩码列另显「未配置」义）；boolean＝启用/停用；字符串原样。 */
function formatField(key: TraceFieldKey, value: string | boolean | null): string {
  if (value === null) {
    return key === 'apiKeyMasked' ? $t('page.aiplatform.modelProvider.tracesDrawer.notConfigured') : '—';
  }
  if (typeof value === 'boolean') {
    return $t(value ? 'page.aiplatform.modelProvider.enabledOn' : 'page.aiplatform.modelProvider.enabledOff');
  }
  return value;
}

/** 创建痕＝old 三件全 null（行此前不存在）；删除痕＝new 三件全 null（行已不存在）。 */
function isCreateTrace(trace: Api.Aiplatform.ModelProviderTrace): boolean {
  return trace.oldBaseUrl === null && trace.oldApiKeyMasked === null && trace.oldEnabled === null;
}
function isDeleteTrace(trace: Api.Aiplatform.ModelProviderTrace): boolean {
  return trace.newBaseUrl === null && trace.newApiKeyMasked === null && trace.newEnabled === null;
}

/** 回滚可达＝更新痕（有旧态可回）；创建痕无旧态、删除痕行已不在——均不给。 */
function canRollback(trace: Api.Aiplatform.ModelProviderTrace): boolean {
  return !isCreateTrace(trace) && !isDeleteTrace(trace) && trace.oldBaseUrl !== null;
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="620">
    <NDrawerContent :title="$t('page.aiplatform.modelProvider.tracesDrawer.title')" closable>
      <div v-if="loading" class="flex-center min-h-300px">
        <NSpin />
      </div>
      <div v-else-if="traces.length" class="pt-8px">
        <!-- 服务端倒序（最近先）——如实渲染；掩码值 mono 直读 -->
        <NTimeline size="large">
          <NTimelineItem v-for="trace in traces" :key="trace.id" type="info" :time="formatDateTime(trace.operatedAt)">
            <div class="flex items-center gap-8px">
              <NTag v-if="isCreateTrace(trace)" size="small" type="success">
                {{ $t('page.aiplatform.modelProvider.tracesDrawer.createTag') }}
              </NTag>
              <NTag v-else-if="isDeleteTrace(trace)" size="small" type="error">
                {{ $t('page.aiplatform.modelProvider.tracesDrawer.deleteTag') }}
              </NTag>
              <span v-for="field in changedFields(trace)" :key="field.key" class="mt-2px text-13px">
                <span class="text-[var(--n-text-color-3)]">{{ $t(FIELD_LABEL[field.key]) }}：</span>
                <span class="break-all font-mono" :title="String(field.from)">{{ formatField(field.key, field.from) }}</span>
                <span class="mx-4px">→</span>
                <span class="break-all font-mono" :title="String(field.to)">{{ formatField(field.key, field.to) }}</span>
              </span>
            </div>
            <div class="mt-4px flex items-center justify-between">
              <span class="text-12px text-[var(--n-text-color-3)]">{{ trace.operatorName }}</span>
              <!-- 回滚＝按旧值快照打开预填表单（update 码门控；apiKey 须重输全量） -->
              <NButton
                v-if="canRollback(trace) && hasAuth(modelProviderWriteAuth.update)"
                size="tiny"
                quaternary
                type="warning"
                :title="$t('page.aiplatform.modelProvider.tracesDrawer.rollbackTip')"
                @click="emit('rollback', trace)"
              >
                {{ $t('page.aiplatform.modelProvider.tracesDrawer.rollback') }}
              </NButton>
            </div>
          </NTimelineItem>
        </NTimeline>
      </div>
      <div v-else class="flex-center min-h-300px text-14px text-gray-400">
        {{ $t('page.aiplatform.modelProvider.tracesDrawer.empty') }}
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
