<script setup lang="tsx">
/**
 * 档位创建/更新共用弹窗（#90）——升模型版本/换供应商＝改指向而绑定自动跟上的维护入口。
 *
 * 创建：tierKey＋providerKey（**先建通道再挂档位**——通道不存在 400 PRJ_071 透传）＋modelName
 * ＋displayName（可空＝回落语义键）＋enabled（缺省开）。更新三肢**不同语义**：tierKey 固定显
 * （寻址键不可改）、providerKey/modelName **终态替换预填**、displayName **空＝清空回落**
 * （表单明示——与通道 apiKey「留空＝保持」有意不同：清空无副作用）、enabled 开关**预填显式传**
 * （停用档换指向不被意外复启）。回滚入口＝按留痕旧值快照预填（行在＝本表单编辑、行已删＝
 * 本表单创建按旧值重建——档位域无 apiKey 肢，旧值四件全可恢复）。回执不消费：成功关窗 emit
 * 回父页（toast＋刷新）；失败保持弹窗可修正重试（onError 已统一透传——PRJ_066/068/070/071
 * 不判码）。
 */
import { computed, reactive, ref, watch } from 'vue';
import { NForm, NFormItem, NInput, NModal, NSwitch } from 'naive-ui';
import { fetchCreateAiplatformModelTier, fetchUpdateAiplatformModelTier } from '@/service/api';
import { $t } from '@/locales';

defineOptions({ name: 'TierFormModal' });

/** 表单预填形（行现值或留痕旧值快照——index.vue TierPrefill 同构）。 */
interface TierPrefill {
  providerKey: string;
  modelName: string;
  displayName: string | null;
  enabled: boolean;
}

const props = defineProps<{
  /** 表单模式：create＝空表单（或回滚重建预填）；update＝按 prefill 预填（可为留痕回滚旧值）。 */
  mode: 'create' | 'update';
  /** 寻址键（update＝行 tierKey 固定显；create＝回滚重建时的痕主体 tierKey，常规创建 null）。 */
  target: { tierKey: string } | null;
  /** 预填源（行现值或留痕旧值快照；null＝常规创建空表单）。 */
  prefill: TierPrefill | null;
}>();

const emit = defineEmits<{
  /** 创建/更新成功（父页 toast＋刷新；回执行不消费）。 */
  success: [mode: 'create' | 'update'];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const model = reactive({
  tierKey: '',
  providerKey: '',
  modelName: '',
  displayName: '',
  enabled: true
});
const submitting = ref(false);

watch(visible, val => {
  if (!val) return;
  // 预填源三态：回滚重建（tierKey＋四肢旧值）/ 常规创建（空）/ 编辑或回滚编辑（target＋prefill）
  model.tierKey = props.target?.tierKey ?? '';
  model.providerKey = props.prefill?.providerKey ?? '';
  model.modelName = props.prefill?.modelName ?? '';
  model.displayName = props.prefill?.displayName ?? '';
  model.enabled = props.prefill?.enabled ?? true;
});

/** tierKey（仅常规创建可输）/providerKey/modelName 必填非空白（PRJ_068/070/071 前端先行拦截，服务端兜底）；displayName 可空（清空回落语义）。 */
const isValid = computed(() => {
  const base = model.providerKey.trim().length > 0 && model.modelName.trim().length > 0;
  return props.target ? base : base && model.tierKey.trim().length > 0;
});

/** 空白归一 null（displayName null＝清空回落语义键，创建/更新同义；不依赖服务端归一）。 */
function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

async function handleConfirm() {
  if (!isValid.value) return false;
  submitting.value = true;
  const { error } =
    props.mode === 'create'
      ? await fetchCreateAiplatformModelTier({
          tierKey: (props.target?.tierKey ?? model.tierKey).trim(),
          providerKey: model.providerKey.trim(),
          modelName: model.modelName.trim(),
          displayName: trimmedOrNull(model.displayName),
          enabled: model.enabled
        })
      : await fetchUpdateAiplatformModelTier(props.target!.tierKey, {
          providerKey: model.providerKey.trim(),
          modelName: model.modelName.trim(),
          displayName: trimmedOrNull(model.displayName),
          enabled: model.enabled
        });
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success', props.mode);
    return true;
  }
  // 失败保持弹窗（onError 已统一透传 toast——PRJ_066/068/070/071 不判码）
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t(mode === 'create' ? 'page.aiplatform.modelTier.form.createTitle' : 'page.aiplatform.modelTier.form.updateTitle')"
    preset="dialog"
    :positive-text="$t(mode === 'create' ? 'page.aiplatform.modelTier.form.createConfirm' : 'page.aiplatform.modelTier.form.updateConfirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting }"
    @positive-click="handleConfirm"
  >
    <NForm label-placement="top" :show-feedback="false" class="flex-col-stretch gap-12px pt-8px">
      <NFormItem v-if="mode === 'create' && !target" :label="$t('page.aiplatform.modelTier.form.tierKey')" required>
        <NInput
          v-model:value="model.tierKey"
          :placeholder="$t('page.aiplatform.modelTier.form.tierKeyPlaceholder')"
          class="w-full"
        />
      </NFormItem>
      <NFormItem v-else :label="$t('page.aiplatform.modelTier.form.tierKey')">
        <!-- 寻址键不可改（PUT 挂路径段；回滚重建＝痕主体键定格）——固定显 mono 直读 -->
        <span class="break-all font-mono">{{ model.tierKey }}</span>
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelTier.form.providerKey')" required>
        <div class="w-full flex-col-stretch gap-4px">
          <NInput
            v-model:value="model.providerKey"
            :placeholder="$t('page.aiplatform.modelTier.form.providerKeyPlaceholder')"
            class="w-full"
          />
          <div class="text-12px text-gray-400">{{ $t('page.aiplatform.modelTier.form.providerKeyTip') }}</div>
        </div>
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelTier.form.modelName')" required>
        <NInput
          v-model:value="model.modelName"
          :placeholder="$t('page.aiplatform.modelTier.form.modelNamePlaceholder')"
          class="w-full"
        />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelTier.form.displayName')">
        <div class="w-full flex-col-stretch gap-4px">
          <NInput
            v-model:value="model.displayName"
            :placeholder="$t('page.aiplatform.modelTier.form.displayNamePlaceholder')"
            class="w-full"
          />
          <div class="text-12px text-gray-400">{{ $t('page.aiplatform.modelTier.form.displayNameTip') }}</div>
        </div>
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelTier.form.enabled')">
        <div class="w-full flex-col-stretch gap-4px">
          <NSwitch v-model:value="model.enabled" />
          <!-- 停用档语义呈现（story 16）：不可作新绑定、既有引用保留——页内文案注 -->
          <div class="text-12px text-gray-400">{{ $t('page.aiplatform.modelTier.form.disableTip') }}</div>
        </div>
      </NFormItem>
    </NForm>
  </NModal>
</template>
