<script setup lang="tsx">
/**
 * 档位变更留痕抽屉（#90）——GET /{tierKey}/traces 时间倒序（服务端定死 operatedAt 倒序＝最近
 * 先，如实渲染）：一次实际变更的前后全量值快照，条目**只渲染变化项**（agent-config 时间线
 * 先例）；newDisplayName null＝本次清空回落语义键（终态替换语义的如实呈现）。
 *
 * 创建痕（old 四件全 null）标「创建」、删除痕（new 四件全 null）标「删除」（append-only 跨行
 * 存活——行删后留痕仍可读，入口挂行、行删入口自然消失）。per-trace「回滚」＝**打开预填表单
 * 非直接 PUT**：emit 回父页按行在/行删分流（行在＝编辑预填旧值、行已删＝创建按旧值预填重建
 * ——皆一次新变更、将留新痕）；创建痕无旧态可回不给回滚（删除痕有 old 四件终值，回滚＝重建，
 * 与供应商页「删除痕不给回滚」有意不同——本域有创建重建路）。
 */
import { ref, watch } from 'vue';
import { NSpin, NDrawer, NDrawerContent, NTag, NTimeline, NTimelineItem } from 'naive-ui';
import { modelTierWriteAuth } from '@/constants/aiplatform';
import { fetchGetAiplatformModelTierTraces } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/common';

defineOptions({ name: 'TierTracesDrawer' });

const props = defineProps<{
  /** 留痕主体档位（tierKey 寻址；行删后对象成陈旧引用仍足寻址——留痕跨行存活回滚重建的入口位）。 */
  tier: Api.Aiplatform.ModelTier | null;
  /** 主体行是否仍在清单现值——父页单点判定；回滚行在走 PUT（update 码）、行删走 POST（create 码）。 */
  rowExists: boolean;
}>();

const emit = defineEmits<{
  /** 按该痕旧值打开预填表单（父页收口：行在＝编辑预填、行已删＝创建重建预填）。 */
  rollback: [trace: Api.Aiplatform.ModelTierTrace];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { hasAuth } = useAuth();

const loading = ref(false);
const traces = ref<Api.Aiplatform.ModelTierTrace[]>([]);

async function load() {
  if (!props.tier) return;
  loading.value = true;
  const { data, error } = await fetchGetAiplatformModelTierTraces(props.tier.tierKey);
  loading.value = false;
  if (!error) traces.value = data ?? [];
}

/** 回滚/删除后父页刷新读面时同步回读留痕（modal 叠 drawer 之上，写成功两处都要新事实）。 */
defineExpose({ reload: load });

watch(visible, val => {
  if (!val) return;
  traces.value = [];
  load();
});

/** 留痕值面四件键（old/new 对的字段名——变化项投影与 label 映射共用）。 */
type TraceFieldKey = 'providerKey' | 'modelName' | 'displayName' | 'enabled';

interface TraceFieldChange {
  key: TraceFieldKey;
  from: string | boolean | null;
  to: string | boolean | null;
}

/** 变化项 label（i18n key 单点）。 */
const FIELD_LABEL: Record<TraceFieldKey, App.I18n.I18nKey> = {
  providerKey: 'page.aiplatform.modelTier.tracesDrawer.field.providerKey',
  modelName: 'page.aiplatform.modelTier.tracesDrawer.field.modelName',
  displayName: 'page.aiplatform.modelTier.tracesDrawer.field.displayName',
  enabled: 'page.aiplatform.modelTier.tracesDrawer.field.enabled'
};

function changedFields(trace: Api.Aiplatform.ModelTierTrace): TraceFieldChange[] {
  const pairs: TraceFieldChange[] = [
    { key: 'providerKey', from: trace.oldProviderKey, to: trace.newProviderKey },
    { key: 'modelName', from: trace.oldModelName, to: trace.newModelName },
    { key: 'displayName', from: trace.oldDisplayName, to: trace.newDisplayName },
    { key: 'enabled', from: trace.oldEnabled, to: trace.newEnabled }
  ];
  return pairs.filter(pair => pair.from !== pair.to);
}

/** 变化值呈现：null＝痕侧缺位（创建痕侧/清空回落侧显「（无）」义）；boolean＝启用/停用；字符串原样。 */
function formatField(value: string | boolean | null): string {
  if (value === null) {
    return $t('page.aiplatform.modelTier.tracesDrawer.nullValue');
  }
  if (typeof value === 'boolean') {
    return $t(value ? 'page.aiplatform.modelTier.enabledOn' : 'page.aiplatform.modelTier.enabledOff');
  }
  return value;
}

/** 创建痕＝old 四件全 null（行此前不存在）；删除痕＝new 四件全 null（行已不存在）。 */
function isCreateTrace(trace: Api.Aiplatform.ModelTierTrace): boolean {
  return trace.oldProviderKey === null && trace.oldModelName === null && trace.oldDisplayName === null && trace.oldEnabled === null;
}
function isDeleteTrace(trace: Api.Aiplatform.ModelTierTrace): boolean {
  return trace.newProviderKey === null && trace.newModelName === null && trace.newDisplayName === null && trace.newEnabled === null;
}

/** 回滚可达＝有旧态可回（非创建痕）——删除痕 old 四件＝删除前终值，回滚＝按旧值重建（父页分流）。 */
function canRollback(trace: Api.Aiplatform.ModelTierTrace): boolean {
  return !isCreateTrace(trace);
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="620">
    <NDrawerContent :title="$t('page.aiplatform.modelTier.tracesDrawer.title')" closable>
      <div v-if="loading" class="flex-center min-h-300px">
        <NSpin />
      </div>
      <div v-else-if="traces.length" class="pt-8px">
        <!-- 服务端倒序（最近先）——如实渲染；模型名/键 mono 直读 -->
        <NTimeline size="large">
          <NTimelineItem v-for="trace in traces" :key="trace.id" type="info" :time="formatDateTime(trace.operatedAt)">
            <div class="flex items-center gap-8px">
              <NTag v-if="isCreateTrace(trace)" size="small" type="success">
                {{ $t('page.aiplatform.modelTier.tracesDrawer.createTag') }}
              </NTag>
              <NTag v-else-if="isDeleteTrace(trace)" size="small" type="error">
                {{ $t('page.aiplatform.modelTier.tracesDrawer.deleteTag') }}
              </NTag>
              <span v-for="field in changedFields(trace)" :key="field.key" class="mt-2px text-13px">
                <span class="text-[var(--n-text-color-3)]">{{ $t(FIELD_LABEL[field.key]) }}：</span>
                <span class="break-all font-mono" :title="String(field.from)">{{ formatField(field.from) }}</span>
                <span class="mx-4px">→</span>
                <span class="break-all font-mono" :title="String(field.to)">{{ formatField(field.to) }}</span>
              </span>
            </div>
            <div class="mt-4px flex items-center justify-between">
              <span class="text-12px text-[var(--n-text-color-3)]">{{ trace.operatorName }}</span>
              <!-- 回滚按实际写口逐码门控：行在＝PUT/update，行已删＝POST/create；打开预填表单非直接写回 -->
              <NButton
                v-if="canRollback(trace) && hasAuth(rowExists ? modelTierWriteAuth.update : modelTierWriteAuth.create)"
                size="tiny"
                quaternary
                type="warning"
                :title="$t('page.aiplatform.modelTier.tracesDrawer.rollbackTip')"
                @click="emit('rollback', trace)"
              >
                {{ $t('page.aiplatform.modelTier.tracesDrawer.rollback') }}
              </NButton>
            </div>
          </NTimelineItem>
        </NTimeline>
      </div>
      <div v-else class="flex-center min-h-300px text-14px text-gray-400">
        {{ $t('page.aiplatform.modelTier.tracesDrawer.empty') }}
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
