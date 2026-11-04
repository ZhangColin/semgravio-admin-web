<script setup lang="ts">
/**
 * 项目详情抽屉（#58/#59，#64 成本指针币种桶点亮，#92 生产承接第六签）——六 tab：基本信息（订单引用双档/成本指针/工作区引用）/ 对话史 / PRD / 版本 / 交付文件 / 生产承接。
 *
 * 项目域纯读、各 tab 数据各自独立端点——除基本信息外均「v-if 按 tab 挂载即加载」
 * （切 tab 卸载重挂，天然重置；抽屉每次打开 activeTab 回 basic）。对话史/PRD/版本/交付文件
 * 归档项目照读（工作区保留）。
 */
import { ref, watch } from 'vue';
import { NTag } from 'naive-ui';
import { fetchGetAiplatformProject } from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { PRODUCTION_READ_AUTH, projectStatusTagColor, orderStatusTagColor } from '@/constants/aiplatform';
import { formatDateTime } from '@/utils/common';
import ConversationPane from './conversation-pane.vue';
import FilesPane from './files-pane.vue';
import PrdPane from './prd-pane.vue';
import VersionsPane from './versions-pane.vue';
import ProductionHandoffPane from './production-handoff-pane.vue';
import CostBuckets from '../../cost/modules/cost-buckets.vue';
import AccountProfile from '../../modules/account-profile.vue';

defineOptions({ name: 'ProjectDetailDrawer' });

const props = defineProps<{
  projectId: string;
  /** 列表页 externalId 筛选值——账号档案嵌件查询锚（详情响应不带 externalId，契约如此）。 */
  externalId?: string | null;
}>();

const visible = defineModel<boolean>('visible', { default: false });

const detail = ref<Api.Aiplatform.ProjectDetail | null>(null);
const loading = ref(false);

async function loadDetail() {
  loading.value = true;
  const { data, error } = await fetchGetAiplatformProject(props.projectId);
  loading.value = false;
  if (!error) detail.value = data;
}

const activeTab = ref<'basic' | 'conversation' | 'prd' | 'versions' | 'files' | 'production'>('basic');
const canReadProduction = useAuth().hasAuth(PRODUCTION_READ_AUTH);
// 承接读面无盖帽布尔：null＝未知；仅保留本抽屉内已确认目标值，切签重挂不丢。
const productionSupplementRequired = ref<boolean | null>(null);

watch(visible, val => {
  if (val) {
    detail.value = null;
    activeTab.value = 'basic';
    productionSupplementRequired.value = null;
    loadDetail();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" :width="720">
    <NDrawerContent :title="$t('page.aiplatform.project.detailTitle')" closable>
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- 基本信息：清单字段全量 + 订单引用双档 + 成本指针 + 工作区引用 -->
        <NTabPane name="basic" :tab="$t('page.aiplatform.project.drawer.tabs.basic')">
          <div v-if="loading" class="flex-center min-h-300px">
            <NSpin />
          </div>
          <div v-else-if="detail" class="desc-table">
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.projectId') }}</div>
              <div class="desc-value"><span class="font-mono text-14px">{{ detail.id }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.name') }}</div>
              <div class="desc-value"><span class="text-14px">{{ detail.name }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.owner') }}</div>
              <div class="desc-value"><span class="text-14px">{{ detail.ownerDisplayName ?? '-' }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.type') }}</div>
              <div class="desc-value"><span class="text-14px">{{ detail.typeName }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.status') }}</div>
              <div class="desc-value">
                <NTag :type="projectStatusTagColor[detail.status]" size="small">{{ detail.statusName }}</NTag>
              </div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.archived') }}</div>
              <div class="desc-value">
                <span class="text-14px">{{ detail.archived ? $t('page.aiplatform.project.archivedYes') : $t('page.aiplatform.project.archivedNo') }}</span>
              </div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.drawer.workspaceId') }}</div>
              <div class="desc-value"><span class="font-mono text-14px">{{ detail.workspaceId }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.drawer.activeOrder') }}</div>
              <div class="desc-value">
                <span v-if="detail.activeOrder" class="flex items-center gap-8px">
                  <span class="font-mono text-14px">{{ detail.activeOrder.id }}</span>
                  <NTag :type="orderStatusTagColor[detail.activeOrder.status]" size="small">{{ detail.activeOrder.statusName }}</NTag>
                </span>
                <span v-else class="text-14px text-#999">{{ $t('page.aiplatform.project.drawer.noActiveOrder') }}</span>
              </div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.drawer.latestOrder') }}</div>
              <div class="desc-value">
                <span v-if="detail.latestOrder" class="flex items-center gap-8px">
                  <span class="font-mono text-14px">{{ detail.latestOrder.id }}</span>
                  <NTag :type="orderStatusTagColor[detail.latestOrder.status]" size="small">{{ detail.latestOrder.statusName }}</NTag>
                </span>
                <span v-else class="text-14px text-#999">{{ $t('page.aiplatform.project.drawer.noOrder') }}</span>
              </div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.drawer.costSummary') }}</div>
              <div class="desc-value">
                <!-- 币种桶（admin#75 点亮：金额直读不折算；空对象＝空态文案不伪装 0）+ unpriced 完整性标记 -->
                <div class="flex flex-wrap items-center gap-6px">
                  <CostBuckets :cost="detail.costSummary.cost" />
                  <NTag v-if="detail.costSummary.unpriced" type="warning" size="small">
                    {{ $t('page.aiplatform.project.drawer.costUnpriced') }}
                  </NTag>
                  <NTag v-else type="success" size="small">{{ $t('page.aiplatform.project.drawer.costComplete') }}</NTag>
                </div>
              </div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.drawer.prdProducedAt') }}</div>
              <div class="desc-value"><span class="text-14px">{{ formatDateTime(detail.prdProducedAt) }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.drawer.generatedAt') }}</div>
              <div class="desc-value"><span class="text-14px">{{ formatDateTime(detail.generatedAt) }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.createdAt') }}</div>
              <div class="desc-value"><span class="text-14px">{{ formatDateTime(detail.createdAt) }}</span></div>
            </div>
            <div class="desc-row">
              <div class="desc-label">{{ $t('page.aiplatform.project.updatedAt') }}</div>
              <div class="desc-value"><span class="text-14px">{{ formatDateTime(detail.updatedAt) }}</span></div>
            </div>
          </div>

          <NEmpty v-else :description="$t('common.noData')" />

          <!-- 账号档案（externalId 筛选驱动；筛选缺省/无读码不渲染；加载/空态分支外恒可挂） -->
          <AccountProfile v-if="detail" class="mt-16px" :external-id="externalId" />
        </NTabPane>

        <!-- 对话史（全量同序；v-if 挂载即加载） -->
        <NTabPane name="conversation" :tab="$t('page.aiplatform.project.drawer.tabs.conversation')">
          <ConversationPane v-if="activeTab === 'conversation'" :project-id="projectId" />
        </NTabPane>

        <!-- PRD 全文（v-if 挂载即加载；未产出 404 PRJ_015 走 onError 透传 toast） -->
        <NTabPane name="prd" :tab="$t('page.aiplatform.project.drawer.tabs.prd')">
          <PrdPane v-if="activeTab === 'prd'" :project-id="projectId" />
        </NTabPane>

        <!-- 版本列表/详情（新→旧，锚定收尾卡；v-if 挂载即加载） -->
        <NTabPane name="versions" :tab="$t('page.aiplatform.project.drawer.tabs.versions')">
          <VersionsPane v-if="activeTab === 'versions'" :project-id="projectId" />
        </NTabPane>

        <!-- 交付文件（文件树 + 文本查看器 + 下载文件包；v-if 挂载即加载） -->
        <NTabPane name="files" :tab="$t('page.aiplatform.project.drawer.tabs.files')">
          <FilesPane v-if="activeTab === 'files'" :project-id="projectId" />
        </NTabPane>

        <!-- 生产承接（#92：production:read 门控显隐；v-if 切签挂载即加载） -->
        <NTabPane v-if="canReadProduction" name="production" :tab="$t('page.aiplatform.production.tab')">
          <ProductionHandoffPane
            v-if="activeTab === 'production'"
            v-model:supplement-required="productionSupplementRequired"
            :project-id="projectId"
          />
        </NTabPane>
      </NTabs>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.desc-table {
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
}
.desc-row {
  display: flex;
  border-bottom: 1px solid var(--n-border-color);
}
.desc-row:last-child {
  border-bottom: none;
}
.desc-label {
  flex-shrink: 0;
  width: 120px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--n-text-color-3);
  background: var(--n-color-embedded);
  border-right: 1px solid var(--n-border-color);
}
.desc-value {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  display: flex;
  align-items: center;
}

@media (max-width: 639px) {
  .desc-row {
    flex-direction: column;
  }
  .desc-label {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--n-border-color);
  }
}
</style>
