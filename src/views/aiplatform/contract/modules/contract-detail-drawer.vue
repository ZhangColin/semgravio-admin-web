<script setup lang="ts">
/**
 * AI 平台合同详情抽屉（#87）——承接核对全量面，720 三段：
 * ① contract 全字段（六态＋needsUpdate「需更新」warning tag＋四预览字段未录入如实 -＋范围
 *    快照冻结三段＋冻结金额＋PRD/Demo 双版本引用＋双方签署位/落签时点＋版本/创建时点）；
 * ② prdSnapshot——PRD 确认版全文冗余拷贝（合同自含的依据面，pre 原样呈现）；
 * ③ transitions——动作留痕时间线（服务端新→旧直读，六类 actionName/basis/操作者两肢/时间）。
 *
 * 动作条置顶（双入口之二）：矩阵单点 `availableContractActions`（**详情带签署位 → 末边 3→4
 * 双签可观测门控**）∩ 逐写 hasAuth；emit 回父页收口（workspace 抽屉先例）。写回执是单段合同体
 * （非三段 detail）——父页成功后调 reload 二次回读。
 */
import { computed, ref, watch } from 'vue';
import { NButton, NDrawer, NDrawerContent, NSpin, NTag, NTimeline, NTimelineItem } from 'naive-ui';
import { availableContractActions, contractStatusTagColor, contractWriteAuth } from '@/constants/aiplatform';
import { fetchGetAiplatformContract } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { formatDateTime, formatMoney } from '@/utils/common';

defineOptions({ name: 'ContractDetailDrawer' });

const props = defineProps<{
  contractId: string;
}>();

const emit = defineEmits<{
  /** 请求六写之一（弹窗在父页挂载收口；emit 详情 contract 段——携四预览字段供 record 预填）。 */
  action: [action: Api.Aiplatform.ContractAction, contract: Api.Aiplatform.Contract];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { hasAuth } = useAuth();

const detail = ref<Api.Aiplatform.ContractDetail | null>(null);
const loading = ref(false);

async function loadDetail() {
  loading.value = true;
  const { data, error } = await fetchGetAiplatformContract(props.contractId);
  loading.value = false;
  if (!error) detail.value = data;
}

watch(visible, val => {
  if (val) {
    detail.value = null;
    loadDetail();
  }
});

/** 动作条＝矩阵（详情含签署位——末边双签门控在此可观测）∩ 逐写 hasAuth。 */
const availableActions = computed(() => {
  const c = detail.value?.contract;
  if (!c) return [];
  return availableContractActions({ status: c.status, partyASigned: c.partyASigned, partyBSigned: c.partyBSigned }).filter(action =>
    hasAuth(contractWriteAuth[action])
  );
});

/** 动作条按钮配色（语义：推进主色 / 签署·重录 info / 失败·撤回 warning / 作废 error）。 */
const ACTION_BUTTON_TYPE: Record<Api.Aiplatform.ContractAction, 'primary' | 'info' | 'warning' | 'error'> = {
  advance: 'primary',
  sign: 'info',
  record: 'info',
  fail: 'warning',
  withdraw: 'warning',
  void: 'error'
};

/** 时间线节点色（语义：推进 info / 撤回·失败 warning / 作废 error / 签署 success / 重录 info）。 */
const TRANSITION_TIMELINE_TYPE: Record<Api.Aiplatform.ContractTransitionAction, 'info' | 'success' | 'warning' | 'error'> = {
  1: 'info',
  2: 'warning',
  3: 'error',
  4: 'success',
  5: 'info',
  6: 'error'
};

defineExpose({
  /** 写成功后二次回读（回执是单段合同体非三段 detail，不消费）。 */
  reload: loadDetail
});
</script>

<template>
  <NDrawer v-model:show="visible" :width="720">
    <NDrawerContent :title="$t('page.aiplatform.contract.detailTitle')" closable>
      <div v-if="loading" class="flex-center min-h-300px">
        <NSpin />
      </div>
      <div v-else-if="detail?.contract" class="flex-col-stretch gap-16px">
        <!-- 动作条（双入口之二）：矩阵含末边双签可观测门控；逐写 hasAuth -->
        <div v-if="availableActions.length" class="action-row flex flex-wrap gap-8px">
          <NButton
            v-for="action in availableActions"
            :key="action"
            :type="ACTION_BUTTON_TYPE[action]"
            :ghost="action === 'sign' || action === 'record' || action === 'withdraw'"
            size="small"
            @click="emit('action', action, detail.contract)"
          >
            {{ $t(`page.aiplatform.contract.action.${action}`) }}
          </NButton>
        </div>

        <!-- 一、合同全字段（含 needsUpdate warning tag 与范围快照冻结面） -->
        <div>
          <div class="mb-8px font-600">{{ $t('page.aiplatform.contract.drawer.basic') }}</div>
          <div class="grid grid-cols-[120px_1fr] gap-x-16px gap-y-10px text-14px">
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.contractId') }}</span>
            <span class="break-all font-mono">{{ detail.contract.id }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.contractNo') }}</span>
            <span class="font-mono">{{ detail.contract.contractNo }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.orderId') }}</span>
            <span class="break-all font-mono">{{ detail.contract.orderId }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.status') }}</span>
            <span class="flex items-center gap-8px">
              <NTag :type="contractStatusTagColor[detail.contract.status]" size="small">{{ detail.contract.statusName }}</NTag>
              <!-- 「需更新」处置线索：改价/改范围后草稿待重录（record 即清零）——详情双现位 -->
              <NTag v-if="detail.contract.needsUpdate" type="warning" size="small">
                {{ $t('page.aiplatform.contract.needsUpdate') }}
              </NTag>
            </span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.version') }}</span>
            <span>{{ detail.contract.version }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.amount') }}</span>
            <span>{{ formatMoney(detail.contract.amount) }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.prdVersionNo') }}</span>
            <span>{{ detail.contract.prdVersionNo ?? '-' }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.demoVersionNo') }}</span>
            <span>{{ detail.contract.demoVersionNo ?? '-' }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.partyA') }}</span>
            <span>{{ detail.contract.partyA ?? '-' }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.partyB') }}</span>
            <span>{{ detail.contract.partyB ?? '-' }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.projectScope') }}</span>
            <span>{{ detail.contract.projectScope ?? '-' }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.paymentPlan') }}</span>
            <span>{{ detail.contract.paymentPlan ?? '-' }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.partyASigned') }}</span>
            <span>
              {{ detail.contract.partyASigned ? $t('page.aiplatform.contract.drawer.signedYes') : $t('page.aiplatform.contract.drawer.signedNo') }}
              <template v-if="detail.contract.partyASignedAt">（{{ formatDateTime(detail.contract.partyASignedAt) }}）</template>
            </span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.partyBSigned') }}</span>
            <span>
              {{ detail.contract.partyBSigned ? $t('page.aiplatform.contract.drawer.signedYes') : $t('page.aiplatform.contract.drawer.signedNo') }}
              <template v-if="detail.contract.partyBSignedAt">（{{ formatDateTime(detail.contract.partyBSignedAt) }}）</template>
            </span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.createdAt') }}</span>
            <span>{{ formatDateTime(detail.contract.createdAt) }}</span>
          </div>
        </div>

        <!-- 范围快照冻结三段（创建/重录时取订单范围文本定格，此后不漂移——冻结集非空直读） -->
        <div>
          <div class="mb-8px font-600">{{ $t('page.aiplatform.contract.drawer.scopeSnapshot') }}</div>
          <div class="grid grid-cols-[120px_1fr] gap-x-16px gap-y-10px text-14px">
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.scopeDeliverables') }}</span>
            <span class="whitespace-pre-wrap">{{ detail.contract.scopeDeliverables }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.scopeAcceptance') }}</span>
            <span class="whitespace-pre-wrap">{{ detail.contract.scopeAcceptance }}</span>
            <span class="text-right text-#999">{{ $t('page.aiplatform.contract.drawer.scopeTimeline') }}</span>
            <span class="whitespace-pre-wrap">{{ detail.contract.scopeTimeline }}</span>
          </div>
        </div>

        <!-- 二、PRD 确认版全文（冗余拷贝，报价/录内容的依据面） -->
        <div>
          <div class="mb-8px font-600">{{ $t('page.aiplatform.contract.drawer.prdSnapshot') }}</div>
          <pre class="max-h-320px overflow-auto whitespace-pre-wrap rounded-8px bg-#f5f5f5 p-12px text-13px leading-6">{{ detail.prdSnapshot }}</pre>
        </div>

        <!-- 三、动作留痕时间线（服务端新→旧直读；非迁移动作 from=to 如实呈现） -->
        <div>
          <div class="mb-8px font-600">{{ $t('page.aiplatform.contract.drawer.transitions') }}</div>
          <div v-if="detail.transitions.length" class="pt-8px">
            <NTimeline size="large">
              <NTimelineItem
                v-for="(trace, i) in detail.transitions"
                :key="`${trace.createdAt}-${i}`"
                :type="TRANSITION_TIMELINE_TYPE[trace.action]"
                :time="formatDateTime(trace.createdAt)"
              >
                <div class="flex items-center gap-8px">
                  <NTag size="small">{{ trace.actionName }}</NTag>
                  <span class="text-13px">{{ trace.fromStatusName }} → {{ trace.toStatusName }}</span>
                </div>
                <div class="mt-2px text-13px">{{ trace.basis }}</div>
                <div class="mt-2px text-12px text-gray-400">
                  {{ trace.operatorName }}
                  <span class="font-mono">{{ trace.operatorId }}</span>
                </div>
              </NTimelineItem>
            </NTimeline>
          </div>
          <span v-else class="text-13px text-gray-400">{{ $t('page.aiplatform.contract.drawer.transitionsEmpty') }}</span>
        </div>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
