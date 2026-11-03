<script setup lang="ts">
/**
 * AI 平台合同筛选条（#87）——四维检索，字段平铺不折叠（照订单筛选条先例）。
 *
 * 契约参数（admin HEAD `GET /aiplatform/contracts`）：status（Integer code 多选，提交拼逗号
 * 单值 status=1,5——同订单域 BFF 签名协议）/ createdFrom·createdTo（ISO-8601 本地串，含两端）/
 * orderId（所属订单精确）/ contractNo（合同号精确，SG- 串）。
 */
import { computed, reactive } from 'vue';
import { NButton, NDatePicker, NForm, NFormItemGi, NGrid, NInput, NSelect } from 'naive-ui';
import { contractStatusOptions } from '@/constants/aiplatform';
import { $t } from '@/locales';
import { tsToIsoLocal } from '@/utils/common';

defineOptions({ name: 'AiplatformContractSearch' });

const emit = defineEmits<{
  search: [filter: Api.Aiplatform.ContractFilter];
}>();

interface LocalFilter {
  /** 状态多选（NSelect multiple；六态） */
  status: Api.Aiplatform.ContractStatus[] | null;
  createdRange: [number, number] | null;
  orderId: string | null;
  contractNo: string | null;
}

const model = reactive<LocalFilter>({
  status: null,
  createdRange: null,
  orderId: null,
  contractNo: null
});

/** NSelect 选项渲染时翻译（语言切换可响应；number 值不走 translateOptions）。 */
const statusSelectOptions = computed(() => contractStatusOptions.map(o => ({ ...o, label: $t(o.label) })));

function buildFilter(): Api.Aiplatform.ContractFilter {
  const filter: Api.Aiplatform.ContractFilter = {};
  if (model.status?.length) filter.status = model.status;
  if (model.createdRange) {
    filter.createdFrom = tsToIsoLocal(model.createdRange[0]);
    filter.createdTo = tsToIsoLocal(model.createdRange[1]);
  }
  if (model.orderId?.trim()) filter.orderId = model.orderId.trim();
  if (model.contractNo?.trim()) filter.contractNo = model.contractNo.trim();
  return filter;
}

function handleSubmit() {
  emit('search', buildFilter());
}

function handleReset() {
  model.status = null;
  model.createdRange = null;
  model.orderId = null;
  model.contractNo = null;
  emit('search', {});
}
</script>

<template>
  <NCard :title="$t('page.aiplatform.contract.title')" :bordered="false" size="small" class="card-wrapper">
    <NForm label-placement="left" :show-feedback="false">
      <NGrid x-gap="12px" y-gap="12px" item-responsive responsive="screen" cols="1 s:2 m:3">
        <NFormItemGi span="1" :label="$t('page.aiplatform.contract.status')" path="status">
          <NSelect
            v-model:value="model.status"
            multiple
            :options="statusSelectOptions"
            :placeholder="$t('page.aiplatform.contract.form.status')"
            clearable
          />
        </NFormItemGi>
        <NFormItemGi span="1" :label="$t('page.aiplatform.contract.form.createdRange')" path="createdRange">
          <NDatePicker v-model:value="model.createdRange" type="datetimerange" clearable class="w-full" />
        </NFormItemGi>
        <NFormItemGi span="1" :label="$t('page.aiplatform.contract.orderId')" path="orderId">
          <NInput v-model:value="model.orderId" :placeholder="$t('page.aiplatform.contract.form.orderId')" clearable />
        </NFormItemGi>
        <NFormItemGi span="1" :label="$t('page.aiplatform.contract.contractNo')" path="contractNo">
          <NInput v-model:value="model.contractNo" :placeholder="$t('page.aiplatform.contract.form.contractNo')" clearable />
        </NFormItemGi>
        <NFormItemGi span="1" class="flex justify-end">
          <NButton type="primary" ghost @click="handleSubmit">
            {{ $t('common.search') }}
          </NButton>
          <NButton quaternary class="ml-12px" @click="handleReset">
            {{ $t('common.reset') }}
          </NButton>
        </NFormItemGi>
      </NGrid>
    </NForm>
  </NCard>
</template>
