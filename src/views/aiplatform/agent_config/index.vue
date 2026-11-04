<script setup lang="ts">
/**
 * AI 平台智能体配置页（#69 初建；#91 扩 designer＋档位化＋边缘四点）。
 *
 * NTabs 五签：main / executor / designer 三座（各含编辑卡＋留痕时间线卡，面板自管）＋
 * 边缘调用点（四点窄面板，agent-config:read 门控）＋工具面。档位清单页面级拉一次共享；
 * 三座保存五字段全量回传，两工具 flag 以 GET 原值透传；边缘写体仅 modelId。
 */
import { onMounted, ref } from 'vue';
import { AGENT_CONFIG_READ_AUTH, AGENT_KEYS, EDGE_KEYS, agentKeyLabel } from '@/constants/aiplatform';
import { fetchGetAiplatformModelTierList } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import AgentConfigPanel from './modules/agent-config-panel.vue';
import EdgeModelPanel from './modules/edge-model-panel.vue';
import ToolInventoryPanel from './modules/tool-inventory-panel.vue';

defineOptions({ name: 'AiplatformAgentConfig' });

const { hasAuth } = useAuth();
const canReadEdge = hasAuth(AGENT_CONFIG_READ_AUTH);

/** 档位清单页面级拉一次，共享三座与边缘四点；绑定写不反向改档位行，无需重拉。 */
const modelTiers = ref<Api.Aiplatform.ModelTier[]>([]);
const tierLoading = ref(false);

async function loadModelTiers() {
  tierLoading.value = true;
  const { data, error } = await fetchGetAiplatformModelTierList();
  if (!error) modelTiers.value = data ?? [];
  tierLoading.value = false;
}

onMounted(loadModelTiers);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :title="$t('page.aiplatform.agentConfig.title')" :bordered="false" size="small" class="card-wrapper">
      <!-- display-directive 缺省 if：切签卸载重挂＝进入/切签即加载对应座读面（T2 指派页同款） -->
      <NTabs type="line">
        <NTabPane v-for="key in AGENT_KEYS" :key="key" :name="key" :tab="$t(agentKeyLabel[key])">
          <AgentConfigPanel :agent-key="key" :model-tiers="modelTiers" :tier-loading="tierLoading" />
        </NTabPane>
        <NTabPane v-if="canReadEdge" name="edge" :tab="$t('page.aiplatform.agentConfig.tab.edge')">
          <div class="flex-col-stretch gap-12px">
            <EdgeModelPanel
              v-for="key in EDGE_KEYS"
              :key="key"
              :edge-key="key"
              :model-tiers="modelTiers"
              :tier-loading="tierLoading"
            />
          </div>
        </NTabPane>
        <NTabPane name="tools" :tab="$t('page.aiplatform.agentConfig.tab.tools')">
          <ToolInventoryPanel />
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>
