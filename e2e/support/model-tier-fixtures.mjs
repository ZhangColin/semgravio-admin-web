/**
 * 模型档位域 E2E mock fixtures（#90，#80 B 批 T2）——字段形状派生自 admin HEAD DTO
 * `AiplatformModelTierResponse` / `AiplatformModelTierTraceResponse`（本地 :8081 未运行，
 * T8 口径读源码）。档位行与创建/更新回执同形；清单按 tierKey 序无分页。
 *
 * 样本矩阵：停用档（legacy-pro）＋null displayName（flash）＋种子行 operator null＋被绑定
 * 引用档（pro）。留痕时间倒序：更新痕 old/new 四件全量快照（含 displayName 清空回落）、
 * 创建痕 old 全 null；删除痕由 harness 删除时就地落（new 全 null，跨行存活）。
 */

/** 档位清单行（按语义键序预排；displayName null＝回落 tierKey，停用档如实呈现）。 */
export const TIER_ROWS = [
  {
    tierKey: 'doubao-flagship',
    providerKey: 'volcengine',
    modelName: 'doubao-seed-1-6-250615',
    displayName: '豆包旗舰',
    enabled: true,
    operatorId: null,
    operatorName: null,
    updatedAt: '2026-09-10T08:00:00'
  },
  {
    tierKey: 'flash',
    providerKey: 'deepseek',
    modelName: 'deepseek-v4-flash-ga-260731',
    displayName: null,
    enabled: true,
    operatorId: '3',
    operatorName: '陈运营',
    updatedAt: '2026-10-20T10:00:00'
  },
  {
    tierKey: 'legacy-pro',
    providerKey: 'volcengine',
    modelName: 'doubao-pro-1-250k-230615',
    displayName: '旧 Pro 档',
    enabled: false,
    operatorId: '5',
    operatorName: '林运维',
    updatedAt: '2026-10-25T16:30:00'
  },
  {
    tierKey: 'pro',
    providerKey: 'volcengine',
    modelName: 'doubao-seed-1-6-250615',
    displayName: '强模型档',
    enabled: true,
    operatorId: null,
    operatorName: null,
    updatedAt: '2026-09-10T08:00:00'
  }
];

/** 留痕行构造（时间倒序 unshift 用；old/new 缺省侧由调用方覆盖）。 */
function trace(id, oldPart, newPart, operatedAt, operatorName = '陈运营', operatorId = '3') {
  return {
    id,
    oldProviderKey: null,
    oldModelName: null,
    oldDisplayName: null,
    oldEnabled: null,
    newProviderKey: null,
    newModelName: null,
    newDisplayName: null,
    newEnabled: null,
    operatorId,
    operatorName,
    operatedAt,
    ...oldPart,
    ...newPart
  };
}

/**
 * 档位变更留痕（按 tierKey 索引，时间倒序；append-only 跨行存活）：
 * - flash：升模型版本＋清显示名痕 → 创建痕；回滚断言 PUT body＝该痕 old 四件。
 * - legacy-pro：停用痕 → 创建痕；删除后由 harness 追加删除痕（回滚＝按旧值重建）。
 * - pro/doubao-flagship：创建痕（种子脚本通道——留痕操作者与行最近写者口径独立）。
 */
export const TIER_TRACES = {
  'doubao-flagship': [
    trace(
      '7402260000000000101',
      {},
      {
        newProviderKey: 'volcengine',
        newModelName: 'doubao-seed-1-6-250615',
        newDisplayName: '豆包旗舰',
        newEnabled: true
      },
      '2026-09-10T08:00:00',
      '种子脚本',
      null
    )
  ],
  flash: [
    trace(
      '7402260000000000103',
      {
        oldProviderKey: 'deepseek',
        oldModelName: 'deepseek-v3-flash-250101',
        oldDisplayName: '旧快模型',
        oldEnabled: true
      },
      {
        newProviderKey: 'deepseek',
        newModelName: 'deepseek-v4-flash-ga-260731',
        newDisplayName: null,
        newEnabled: true
      },
      '2026-10-20T10:00:00'
    ),
    trace(
      '7402260000000000102',
      {},
      {
        newProviderKey: 'deepseek',
        newModelName: 'deepseek-v3-flash-250101',
        newDisplayName: '旧快模型',
        newEnabled: true
      },
      '2026-09-01T09:00:00'
    )
  ],
  'legacy-pro': [
    trace(
      '7402260000000000105',
      {
        oldProviderKey: 'volcengine',
        oldModelName: 'doubao-pro-1-250k-230615',
        oldDisplayName: '旧 Pro 档',
        oldEnabled: true
      },
      {
        newProviderKey: 'volcengine',
        newModelName: 'doubao-pro-1-250k-230615',
        newDisplayName: '旧 Pro 档',
        newEnabled: false
      },
      '2026-10-25T16:30:00',
      '林运维',
      '5'
    ),
    trace(
      '7402260000000000104',
      {},
      {
        newProviderKey: 'volcengine',
        newModelName: 'doubao-pro-1-250k-230615',
        newDisplayName: '旧 Pro 档',
        newEnabled: true
      },
      '2026-09-05T09:00:00',
      '林运维',
      '5'
    )
  ],
  pro: [
    trace(
      '7402260000000000106',
      {},
      {
        newProviderKey: 'volcengine',
        newModelName: 'doubao-seed-1-6-250615',
        newDisplayName: '强模型档',
        newEnabled: true
      },
      '2026-09-10T08:00:00',
      '种子脚本',
      null
    )
  ]
};

/** 删除引用守卫的自然裁决面（provider agent-configs 绑定键集——modelId/routingStrongModelId 任一命中即拒）。 */
export const BOUND_TIER_KEYS = ['pro'];

/** 创建/更新/删除成功回执的统一操作者与时刻（harness 变异落痕用——X-User 头 mock 等价）。 */
export const TIER_WRITE_AT = '2026-11-03T13:00:00';
export const TIER_WRITE_OPERATOR = { operatorId: '1', operatorName: 'E2E Mock' };
