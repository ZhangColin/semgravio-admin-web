<script setup lang="ts">
/** 模型档位绑定下拉（#91）：停用档如实呈现但不可新选；已绑定停用档保留现值并旁挂警示。 */
import { computed, h } from 'vue';
import type { VNode } from 'vue';
import { NTag } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { $t } from '@/locales';

interface TierOption extends SelectOption {
  tier: Api.Aiplatform.ModelTier;
}

const props = withDefaults(
  defineProps<{
    value: string | null;
    tiers: Api.Aiplatform.ModelTier[];
    loading?: boolean;
  }>(),
  { loading: false }
);

const emit = defineEmits<{
  'update:value': [value: string | null];
}>();

const options = computed<TierOption[]>(() =>
  props.tiers.map(tier => ({
    value: tier.tierKey,
    label: tier.displayName ?? tier.tierKey,
    disabled: !tier.enabled,
    tier
  }))
);

function renderLabel(option: SelectOption) {
  const tier = (option as TierOption).tier as Api.Aiplatform.ModelTier | undefined;
  // 配置先于共享清单返回时，Naive 会用原始 value 临时合成选中项；先如实显示，清单到后再补档位元信息。
  if (!tier) return String(option.label ?? option.value ?? '');
  return h('div', { class: 'flex items-center gap-6px' }, [
    h('span', String(option.label ?? tier.tierKey)),
    tier.enabled ? null : h(NTag, { size: 'small', type: 'warning' }, { default: () => $t('page.aiplatform.agentConfig.edit.tierDisabled') })
  ]);
}

function renderOption({ node, option }: { node: VNode; option: SelectOption }) {
  const { tier } = option as TierOption;
  return h('div', { class: 'min-w-0 py-2px' }, [
    node,
    h('div', { class: 'truncate text-12px text-gray-400 font-mono' }, tier.modelName)
  ]);
}
</script>

<template>
  <div class="w-full">
    <NSelect
      class="w-full"
      :value="value"
      :options="options"
      :loading="loading"
      :render-label="renderLabel"
      :render-option="renderOption"
      clearable
      :placeholder="$t('page.aiplatform.agentConfig.edit.modelIdPlaceholder')"
      @update:value="emit('update:value', $event)"
    />
  </div>
</template>
