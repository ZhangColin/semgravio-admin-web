/**
 * 模型供应商域 E2E mock fixtures（#88，#80 B 批 T1）——字段形状派生自 admin HEAD DTO `@Schema`
 * （本地 :8081 未运行，T8 口径读源码）：
 * - `AiplatformModelProviderResponse`（通道行：providerKey/baseUrl/apiKeyMasked/enabled/
 *   operatorId·operatorName/updatedAt——GET 清单·单行、POST 创建、PUT 更新回执同形）
 * - `AiplatformModelProviderTraceResponse`（留痕行：old/new baseUrl·apiKeyMasked·enabled 三件对
 *   ＋操作者两肢＋operatedAt——创建痕 old 全 null、删除痕 new 全 null、append-only 跨行存活）
 * - `AiplatformRemoteModelCatalogResponse`（对照目录：remoteModels[] modelId/name/status/domain/
 *   trackedTierKeys＋staleTiers[] tierKey/modelName/displayName/enabled）
 * - `AiplatformModelTierResponse`（档位行——对照 drawer 内嵌入库复用档位创建写口的回执形）
 *
 * 契约要点：providerKey＝协议路由前缀（路径段寻址，无 id）；apiKeyMasked 尾 4 位掩码
 * （**null＝未配置**——读面零明文 key，全链铁律：harness 变异只存掩码、明文即入即掩）；
 * enabled 原生 boolean（行恒在场）；留痕 old/new enabled 为 Boolean 装箱（创建/删除痕对应侧
 * null）。清单按键序服务端定死——fixtures 预排 deepseek < moonshot < volcengine。
 */

/**
 * 掩码单点（provider ModelProvider#maskApiKey 镜像）：尾 4 位；空白/过短全掩——
 * harness 对写命令 apiKey **即入即掩**，明文不落任何 fixture（铁律钉子）。
 */
export function maskApiKey(plain) {
  const s = String(plain ?? '');
  return s.length >= 4 ? `****${s.slice(-4)}` : '****';
}

/** 通道清单行（按键序；掩码/未配置两态＋启停两态＋种子行 operator null 态全覆盖）。 */
export const PROVIDER_ROWS = [
  {
    providerKey: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyMasked: '****cd34',
    enabled: true,
    operatorId: null,
    operatorName: null,
    updatedAt: '2026-09-01T09:00:00'
  },
  {
    providerKey: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyMasked: null,
    enabled: false,
    operatorId: '5',
    operatorName: '林运维',
    updatedAt: '2026-10-25T16:30:00'
  },
  {
    providerKey: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyMasked: '****ab12',
    enabled: true,
    operatorId: '3',
    operatorName: '陈运营',
    updatedAt: '2026-10-20T10:00:00'
  }
];

/** 留痕行构造（时间倒序 unshift 用；创建痕 old 三件全 null）。 */
function trace(id, oldPart, newPart, operatedAt, operatorName = '陈运营', operatorId = '3') {
  return {
    id,
    oldBaseUrl: null,
    oldApiKeyMasked: null,
    oldEnabled: null,
    newBaseUrl: null,
    newApiKeyMasked: null,
    newEnabled: null,
    operatorId,
    operatorName,
    operatedAt,
    ...oldPart,
    ...newPart
  };
}

/**
 * 通道变更留痕（按 providerKey 索引，时间倒序；apiKey 快照恒掩码——铁律）：
 * - volcengine：换 key＋换地址痕（掩码尾 4 分化锚）→ 创建痕（old 全 null）
 * - deepseek：创建痕单条（种子行 operator null 但留痕带操作者——种子脚本通道口径）
 * - moonshot：停用痕（enabled true→false；换 key 痕变体掩码 null→非 null）
 */
export const PROVIDER_TRACES = {
  volcengine: [
    trace(
      '7402250000000000103',
      { oldBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3-beta', oldApiKeyMasked: '****ef56', oldEnabled: true },
      { newBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', newApiKeyMasked: '****ab12', newEnabled: true },
      '2026-10-20T10:00:00'
    ),
    trace(
      '7402250000000000102',
      {},
      { newBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3-beta', newApiKeyMasked: '****ef56', newEnabled: true },
      '2026-09-15T09:00:00'
    )
  ],
  deepseek: [
    trace(
      '7402250000000000101',
      {},
      { newBaseUrl: 'https://api.deepseek.com/v1', newApiKeyMasked: '****cd34', newEnabled: true },
      '2026-09-01T09:00:00',
      '种子脚本',
      null
    )
  ],
  moonshot: [
    trace(
      '7402250000000000104',
      { oldBaseUrl: 'https://api.moonshot.cn/v1', oldApiKeyMasked: null, oldEnabled: true },
      { newBaseUrl: 'https://api.moonshot.cn/v1', newApiKeyMasked: null, newEnabled: false },
      '2026-10-25T16:30:00',
      '林运维',
      '5'
    )
  ]
};

/**
 * 远端清单对照目录（按 providerKey 索引；每次拉取全量真拉无缓存——mock 回副本）。
 * volcengine 样本矩阵：已入库两档（含带 domain）/建议入库活跃/建议入库 Shutdown（status
 * 如实转述锚）/staleTiers 两行（displayName null 回落 tierKey＋停用档）。
 */
export const REMOTE_CATALOGS = {
  volcengine: {
    providerKey: 'volcengine',
    pulledAt: '2026-11-03T10:00:00',
    remoteModels: [
      {
        modelId: 'doubao-embedding-240715',
        name: 'Doubao-Embedding',
        status: null,
        domain: 'embedding',
        trackedTierKeys: ['volc-embed']
      },
      {
        modelId: 'doubao-pro-32k-241215',
        name: 'Doubao-Pro-32k',
        status: 'Shutdown',
        domain: null,
        trackedTierKeys: []
      },
      {
        modelId: 'doubao-seed-1-6-250615',
        name: 'Doubao-Seed-1.6',
        status: null,
        domain: null,
        trackedTierKeys: ['volc-main-pro']
      },
      {
        modelId: 'doubao-seed-2-1-flash-250615',
        name: 'Doubao-Seed-2.1-Flash',
        status: null,
        domain: null,
        trackedTierKeys: []
      }
    ],
    staleTiers: [
      { tierKey: 'volc-legacy-pro', modelName: 'doubao-pro-1-250k-230615', displayName: null, enabled: false },
      { tierKey: 'volc-old-lite', modelName: 'doubao-lite-4-16k-240315', displayName: '豆包旧轻量', enabled: true }
    ]
  },
  deepseek: {
    providerKey: 'deepseek',
    pulledAt: '2026-11-03T10:00:00',
    remoteModels: [
      { modelId: 'deepseek-chat', name: 'DeepSeek Chat', status: null, domain: null, trackedTierKeys: [] },
      { modelId: 'deepseek-reasoner', name: 'DeepSeek Reasoner', status: null, domain: null, trackedTierKeys: [] }
    ],
    staleTiers: []
  }
};

/**
 * 档位行（最小集——对照 drawer 入库守卫与 trackedTierKeys 单一事实源；T2 档位页全量消费另扩）。
 * 与 REMOTE_CATALOGS.trackedTierKeys 同源对齐（已入库档位键集）。
 */
export const TIER_ROWS = [
  {
    tierKey: 'volc-embed',
    providerKey: 'volcengine',
    modelName: 'doubao-embedding-240715',
    displayName: '豆包向量',
    enabled: true,
    operatorId: null,
    operatorName: null,
    updatedAt: '2026-09-10T08:00:00'
  },
  {
    tierKey: 'volc-main-pro',
    providerKey: 'volcengine',
    modelName: 'doubao-seed-1-6-250615',
    displayName: null,
    enabled: true,
    operatorId: null,
    operatorName: null,
    updatedAt: '2026-09-10T08:00:00'
  }
];

/** 创建/更新成功回执的统一操作者与时刻（harness 变异落痕用——X-User 头 mock 等价）。 */
export const PROVIDER_WRITE_AT = '2026-11-03T12:00:00';
export const PROVIDER_WRITE_OPERATOR = { operatorId: '1', operatorName: 'E2E Mock' };
