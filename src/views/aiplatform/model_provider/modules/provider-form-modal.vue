<script setup lang="tsx">
/**
 * 通道创建/更新共用弹窗（#88）——apiKey 全量明文输入＝**写面唯一明文口**（读面/留痕一律掩码，
 * 全链铁律；无「显示明文」交互是设计而非缺陷）。
 *
 * 创建：providerKey＋baseUrl＋apiKey（null/空白＝暂不配置）＋enabled（缺省开）；更新：
 * providerKey 固定显（寻址键不可改）、baseUrl **预填终态替换**、apiKey 留空＝保持现值
 * （placeholder 明示——掩码回显的必然对偶，防「读一次即丢 key」）、enabled 开关**预填显式传**
 * （停用通道换 key 不被意外复启）。回滚入口＝按留痕旧值快照预填（apiKey 除外——留痕只有
 * 掩码须重输全量，表单 placeholder 明示）。回执不消费：成功关窗 emit 回父页（toast＋刷新）；
 * 失败保持弹窗可修正重试（onError 已统一透传——PRJ_067/069 不判码）。换 key/地址即时生效
 * 不重启（模型实例缓存键含通道指纹）。
 */
import { computed, reactive, ref, watch } from 'vue';
import { NForm, NFormItem, NInput, NModal, NSwitch } from 'naive-ui';
import { fetchCreateAiplatformModelProvider, fetchUpdateAiplatformModelProvider } from '@/service/api';
import { $t } from '@/locales';

defineOptions({ name: 'ProviderFormModal' });

const props = defineProps<{
  /** 表单模式：create＝空表单四肢；update＝按 target 预填（target.baseUrl/enabled 可为留痕回滚旧值）。 */
  mode: 'create' | 'update';
  /** 更新目标（providerKey 寻址＋baseUrl/enabled 预填源；创建传 null）。 */
  target: { providerKey: string; baseUrl: string; enabled: boolean } | null;
}>();

const emit = defineEmits<{
  /** 创建/更新成功（父页 toast＋刷新；回执掩码行不消费）。 */
  success: [mode: 'create' | 'update'];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const model = reactive({
  providerKey: '',
  baseUrl: '',
  apiKey: '',
  enabled: true
});
const submitting = ref(false);

watch(visible, val => {
  if (!val) return;
  if (props.mode === 'update') {
    // 预填终态替换；apiKey 恒不预填（留空＝保持现值——掩码值的 round-trip 安全对偶）
    model.providerKey = props.target?.providerKey ?? '';
    model.baseUrl = props.target?.baseUrl ?? '';
    model.apiKey = '';
    model.enabled = props.target?.enabled ?? true;
  } else {
    model.providerKey = '';
    model.baseUrl = '';
    model.apiKey = '';
    model.enabled = true;
  }
});

/** providerKey/baseUrl 必填非空白（PRJ_069 前端先行拦截，服务端兜底）；apiKey 可空（缺省语义见 placeholder）。 */
const isValid = computed(() => {
  const base = model.baseUrl.trim().length > 0;
  return props.mode === 'create' ? base && model.providerKey.trim().length > 0 : base;
});

/** 空白归一 null（apiKey null＝暂不配置/保持现值，按模式落语义；不依赖服务端归一）。 */
function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

async function handleConfirm() {
  if (!isValid.value) return false;
  submitting.value = true;
  const { error } =
    props.mode === 'create'
      ? await fetchCreateAiplatformModelProvider({
          providerKey: model.providerKey.trim(),
          baseUrl: model.baseUrl.trim(),
          apiKey: trimmedOrNull(model.apiKey),
          enabled: model.enabled
        })
      : await fetchUpdateAiplatformModelProvider(props.target!.providerKey, {
          baseUrl: model.baseUrl.trim(),
          apiKey: trimmedOrNull(model.apiKey),
          enabled: model.enabled
        });
  submitting.value = false;
  if (!error) {
    visible.value = false;
    emit('success', props.mode);
    return true;
  }
  // 失败保持弹窗（onError 已统一透传 toast——PRJ_067/069 不判码）
  return false;
}
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="$t(mode === 'create' ? 'page.aiplatform.modelProvider.form.createTitle' : 'page.aiplatform.modelProvider.form.updateTitle')"
    preset="dialog"
    :positive-text="$t(mode === 'create' ? 'page.aiplatform.modelProvider.form.createConfirm' : 'page.aiplatform.modelProvider.form.updateConfirm')"
    :negative-text="$t('common.cancel')"
    :positive-button-props="{ disabled: !isValid, loading: submitting }"
    @positive-click="handleConfirm"
  >
    <NForm label-placement="top" :show-feedback="false" class="flex-col-stretch gap-12px pt-8px">
      <NFormItem v-if="mode === 'create'" :label="$t('page.aiplatform.modelProvider.form.providerKey')" required>
        <NInput
          v-model:value="model.providerKey"
          :placeholder="$t('page.aiplatform.modelProvider.form.providerKeyPlaceholder')"
          class="w-full"
        />
      </NFormItem>
      <NFormItem v-else :label="$t('page.aiplatform.modelProvider.form.providerKey')">
        <!-- 寻址键不可改（PUT 挂路径段）——固定显 mono 直读 -->
        <span class="break-all font-mono">{{ model.providerKey }}</span>
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelProvider.form.baseUrl')" required>
        <NInput
          v-model:value="model.baseUrl"
          :placeholder="$t('page.aiplatform.modelProvider.form.baseUrlPlaceholder')"
          class="w-full"
        />
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelProvider.form.apiKey')">
        <div class="w-full flex-col-stretch gap-4px">
          <NInput
            v-model:value="model.apiKey"
            :placeholder="$t(mode === 'create' ? 'page.aiplatform.modelProvider.form.apiKeyCreatePlaceholder' : 'page.aiplatform.modelProvider.form.apiKeyUpdatePlaceholder')"
            class="w-full"
          />
          <div class="text-12px text-gray-400">{{ $t('page.aiplatform.modelProvider.form.effectTip') }}</div>
        </div>
      </NFormItem>
      <NFormItem :label="$t('page.aiplatform.modelProvider.form.enabled')">
        <NSwitch v-model:value="model.enabled" />
      </NFormItem>
    </NForm>
  </NModal>
</template>
