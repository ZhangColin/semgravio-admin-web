/**
 * 技能域 E2E mock fixtures（#67）——字段形状派生自 admin :8081 `/v3/api-docs`：
 * - `AiplatformSkillSummaryResponse`（列表行 = install 回执条目 = update 终态行集，同 schema）：
 *   id/name/description/source·sourceName/sourcePackage/version/status·statusName/
 *   operatorId/operatorName/updateAvailable/loadCount·lastLoadedAt
 * - `AiplatformSkillDetailResponse`（清单行超集 + frontmatter 自由 map + content 正文 + resources）
 * - `AiplatformSkillUpdateTraceResponse`（from/to/operator 两列/operatedAt）
 * - #68 指派：`AiplatformSlotAssignmentResponse` / `AiplatformSkillAssignCommand`
 * - #69 智能体配置：`AiplatformAgentConfigResponse` / `AiplatformAgentConfigUpdateCommand` /
 *   `AiplatformAgentConfigTraceResponse` / `AiplatformAgentToolResponse` /
 *   `AiplatformAgentToolSlotResponse` / `AiplatformAgentToolToggleCommand`
 * - #71 草稿域：`AiplatformSkillDraftSummaryResponse` / `AiplatformSkillDraftDetailResponse` /
 *   `AiplatformSkillDraftRejectCommand`（drafts 4 端点——admin #92 源码核实）
 *
 * 契约要点（api-docs 实读，2026-09-24；#71 扩展 2026-09-29）：id 为 **opaque 串两形制**
 * （内置＝`builtin:<技能名>` / 安装＝TSID 十进制串——一律 string，勿做数值假设）；source
 * 1=内置 2=安装 3=自产、status 1=启用 2=停用（内置恒 1）＋`*Name` 中文名随行直读；
 * sourcePackage/version 内置为 null、**自产＝固定虚拟值 `self`**；updateAvailable 为来源包级
 * 标记（true=远端 HEAD≠装时版本 / null=未检查过——按包统一才符合「包级」语义）。
 * 清单无分页、服务端排序内置在前（fixtures 预排：内置 3 行在前，安装行随后，自产行末）。
 *
 * 观测面（#71）：`loadCount` **JSON string 三态**（"5"/"0"/null——null＝内置不适用、
 * "0"＝从未加载，口径＝load 实际发生）；`lastLoadedAt` null＝从未加载。`resources`
 * `Map<String,String>` **仅 Detail**（无 scripts/内置恒空对象 `{}`）。
 *
 * 覆盖矩阵：内置 ×3（下拉仅停用——更新/卸载/留痕不可达；loadCount null＝内置不适用靶）；
 * 安装三包——PACK_A ×3（禁用行＝启用靶 + 可更新 true + 更新靶：from→to 翻新两行/移除
 * sql-helper/新增 diagram-draw；a1 loadCount "12345"＝千分位靶 + resources 1 文件靶）、
 * PACK_B ×1（装者留痕、可更新 false、卸载靶）、PACK_C ×1（可更新 null＝未检查、no-op 更新靶
 * from==to；loadCount "0"＝从未加载靶）；自产 ×1（source=3、sourcePackage/version=self、
 * 下拉仅停用——更新/卸载/留痕不可达、resources {} 无 scripts、详情 self 如实直读靶）。
 * frontmatter 四型值（string/number/array/object）钉泛型键值格式化分派。
 *
 * 草稿覆盖矩阵：在途 ×3（自荐倒序预排）——d1 SAFE/findings 空/executor＝晋升靶（回执＝
 * 技能库自产新行）/ d2 CAUTION/findings 两条（七键全 + 缺键样本＝投影缺键跳过靶）/subagent＝
 * 拒绝靶（从抽屉动作条发起——双入口＋同目标抽屉随行关闭断言）/ d3 SAFE/main＝抽屉只读靶。
 * 拒绝留痕回填（status 3 + operator/reviewedAt/rejectReason）＝终态回执呈现靶。
 */

/** 停用靶：PACK_A 行 a1（启用态、可更新 true——抽屉停用链 + 更新入口同包）。 */
export const DISABLE_ID = '740223456789000101';

/** 启用靶：PACK_A 行 a2（停用态、陈运营停用痕）。 */
export const ENABLE_ID = '740223456789000102';

/** 卸载靶：PACK_B 行 b1（装者王建设留痕、可更新 false）。 */
export const UNINSTALL_ID = '740223456789000201';

/** 更新移除靶：PACK_A 行 a3（启用态——真更新后被移除，removedSkillNames 断言锚）。 */
export const REMOVED_ID = '740223456789000103';

/** 更新靶（真更新 from→to + 移除 + 新增）/ 留痕靶（预排 2 条 + 更新后 3 条）。 */
export const PACK_A = 'https://github.com/acme/skill-pack-a';

/** no-op 更新靶（远端未前进 from==to，未落痕——留痕恒空态）。 */
export const PACK_C = 'https://github.com/acme/skill-pack-c';

/** 安装命令靶（install mock 按此 repoUrl 装入 2 行）。 */
export const INSTALL_REPO_URL = 'https://github.com/acme/e2e-new-pack';

/** PACK_A 装时版本（更新前）/ 更新后版本（远端 HEAD 前进）。 */
export const PACK_A_FROM = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
export const PACK_A_TO = '0b9a8f7e6d5c4b3a29180f7e6d5c4b3a2918076e';

/** 自产行 id（#71 观测扩展靶：source=3、self 虚拟值、无 scripts、loadCount "5"）。 */
export const SELF_SKILL_ID = '740223456789000601';

/** 草稿三靶 id（#71）：d1 晋升 / d2 拒绝（抽屉动作条发起）/ d3 抽屉只读。 */
export const PROMOTE_DRAFT_ID = '3852400001111111';
export const REJECT_DRAFT_ID = '3852400001111112';
export const DRAWER_DRAFT_ID = '3852400001111113';

/** 晋升回执新技能 id（回执态 modal「新技能行 id mono」断言锚）。 */
export const PROMOTED_SKILL_ID = '740223456789000701';

/** 草稿正文断言锚点（详情三节·判读主体）。 */
export const DRAFT_CONTENT_MARK = 'E2E-DRAFT-CONTENT-ANCHOR';

/** 拒绝理由提交值（回执留痕原文直读断言锚）。 */
export const REJECT_REASON = '正文与现有技能 prd-writing 方法论重叠，解消方向不明';

/** 正文全文锚点（frontmatter 剥离后的 SKILL.md 原文断言用）。 */
export const CONTENT_MARK = 'E2E-SKILL-CONTENT-ANCHOR';

/** 内置行（服务端排序内置在前——fixtures 预排前三）。 */
const BUILTIN_ROWS = [
  {
    id: 'builtin:web-search',
    name: 'web-search',
    description: '联网搜索增强工具技能（平台内置）',
    source: 1,
    sourceName: '内置',
    sourcePackage: null,
    version: null,
    status: 1,
    statusName: '启用',
    operatorId: null,
    operatorName: null,
    updateAvailable: null,
    loadCount: null,
    lastLoadedAt: null
  },
  {
    id: 'builtin:fetch-url',
    name: 'fetch-url',
    description: '网页抓取增强工具技能（平台内置）',
    source: 1,
    sourceName: '内置',
    sourcePackage: null,
    version: null,
    status: 1,
    statusName: '启用',
    operatorId: null,
    operatorName: null,
    updateAvailable: null,
    loadCount: null,
    lastLoadedAt: null
  },
  {
    id: 'builtin:project-context',
    name: 'project-context',
    description: '项目事实只读件技能（平台内置）',
    source: 1,
    sourceName: '内置',
    sourcePackage: null,
    version: null,
    status: 1,
    statusName: '启用',
    operatorId: null,
    operatorName: null,
    updateAvailable: null,
    loadCount: null,
    lastLoadedAt: null
  }
];

/** 安装行（PACK_A 可更新 true / PACK_B false / PACK_C null——包级统一）。 */
const INSTALLED_ROWS = [
  {
    id: DISABLE_ID,
    name: 'pdf-export',
    description: '将项目交付文档导出为 PDF 并打包下载',
    source: 2,
    sourceName: '安装',
    sourcePackage: PACK_A,
    version: PACK_A_FROM,
    status: 1,
    statusName: '启用',
    operatorId: '1',
    operatorName: '王建设',
    updateAvailable: true,
    loadCount: '12345',
    lastLoadedAt: '2026-09-21T06:40:00'
  },
  {
    id: ENABLE_ID,
    name: 'csv-analyzer',
    description: '解析 CSV 数据并生成统计摘要',
    source: 2,
    sourceName: '安装',
    sourcePackage: PACK_A,
    version: PACK_A_FROM,
    status: 2,
    statusName: '停用',
    operatorId: '3',
    operatorName: '陈运营',
    updateAvailable: true,
    loadCount: '0',
    lastLoadedAt: null
  },
  {
    id: REMOVED_ID,
    name: 'sql-helper',
    description: '辅助编写与校验 SQL 查询',
    source: 2,
    sourceName: '安装',
    sourcePackage: PACK_A,
    version: PACK_A_FROM,
    status: 1,
    statusName: '启用',
    operatorId: '1',
    operatorName: '王建设',
    updateAvailable: true,
    loadCount: '7',
    lastLoadedAt: '2026-09-18T03:20:00'
  },
  {
    id: UNINSTALL_ID,
    name: 'seo-audit',
    description: '对站点做 SEO 基线审计并出报告',
    source: 2,
    sourceName: '安装',
    sourcePackage: 'https://github.com/acme/skill-pack-b',
    version: '112233445566778899aabbccddeeff0011223344',
    status: 1,
    statusName: '启用',
    operatorId: '1',
    operatorName: '王建设',
    updateAvailable: false,
    loadCount: '3',
    lastLoadedAt: '2026-09-20T08:11:00'
  },
  {
    id: '740223456789000301',
    name: 'doc-writer',
    description: '按模板撰写技术文档初稿',
    source: 2,
    sourceName: '安装',
    sourcePackage: PACK_C,
    version: 'ccdd00112233445566778899aabbccddeeff0011',
    status: 1,
    statusName: '启用',
    operatorId: null,
    operatorName: null,
    updateAvailable: null,
    loadCount: '0',
    lastLoadedAt: null
  }
];

/** 自产行（#71）：source=3、sourcePackage/version＝虚拟值 self、无 scripts（resources {}）、loadCount "5"。 */
const SELF_ROW = {
  id: SELF_SKILL_ID,
  name: 'api-doc-gen',
  description: '按项目事实生成 API 文档初稿（自产晋升入池）',
  source: 3,
  sourceName: '自产',
  sourcePackage: 'self',
  version: 'self',
  status: 1,
  statusName: '启用',
  operatorId: '700200',
  operatorName: '运营·技能管理员',
  updateAvailable: null,
  loadCount: '5',
  lastLoadedAt: '2026-09-22T02:15:00'
};

/** 技能清单（harness 写变异就地改；内置在前预排、安装随后、自产收尾）。 */
export const SKILL_ROWS = [...BUILTIN_ROWS, ...INSTALLED_ROWS, SELF_ROW];

/** 造 SKILL.md 正文（frontmatter 剥离后原文，多段 + 断言锚点）。 */
function skillContent(id) {
  return [
    `# ${id}`,
    '',
    `## 职能`,
    `${CONTENT_MARK} 本技能按指令执行其专职动作，输入输出遵循 SKILL.md 约定。`,
    '',
    '## 使用约束',
    '仅在明确指令下调用；失败时如实回报，不静默重试。',
    '',
    '## 参考',
    '详见来源仓库 README。'
  ].join('\n');
}

/**
 * 详情（清单行超集 + frontmatter 自由 map + content + resources）。安装行 frontmatter 四型值
 * （string/number/array/object）钉泛型键值格式化分派；内置行极简两键；resources 仅 a1 带
 * 1 文件（NCollapse 靶——E2E-RESOURCE-ANCHOR）、其余恒空对象 {}（无 scripts/内置契约形）。
 */
export const SKILL_DETAILS = {
  [DISABLE_ID]: {
    ...INSTALLED_ROWS[0],
    frontmatter: {
      name: 'pdf-export',
      description: 'PDF 导出技能（acme 技能包）',
      version: 2,
      license: 'MIT',
      'allowed-tools': ['Read', 'Write', 'Bash'],
      strict: true,
      metadata: { owner: 'acme', tier: 'gold' }
    },
    content: skillContent('pdf-export'),
    resources: {
      'scripts/export.sh': '#!/usr/bin/env bash\n# E2E-RESOURCE-ANCHOR 打包导出 PDF\nset -euo pipefail\nnpm run export -- --out "$1"\n'
    }
  },
  [ENABLE_ID]: { ...INSTALLED_ROWS[1], frontmatter: { name: 'csv-analyzer', license: 'Apache-2.0' }, content: skillContent('csv-analyzer'), resources: {} },
  [REMOVED_ID]: { ...INSTALLED_ROWS[2], frontmatter: { name: 'sql-helper' }, content: skillContent('sql-helper'), resources: {} },
  [UNINSTALL_ID]: {
    ...INSTALLED_ROWS[3],
    frontmatter: { name: 'seo-audit', description: 'SEO 审计技能', version: 1 },
    content: skillContent('seo-audit'),
    resources: {}
  },
  '740223456789000301': {
    ...INSTALLED_ROWS[4],
    frontmatter: { name: 'doc-writer' },
    content: skillContent('doc-writer'),
    resources: {}
  },
  'builtin:web-search': {
    ...BUILTIN_ROWS[0],
    frontmatter: { name: 'web-search', description: '内置联网搜索技能' },
    content: skillContent('builtin:web-search'),
    resources: {}
  },
  'builtin:fetch-url': { ...BUILTIN_ROWS[1], frontmatter: { name: 'fetch-url' }, content: skillContent('builtin:fetch-url'), resources: {} },
  'builtin:project-context': {
    ...BUILTIN_ROWS[2],
    frontmatter: { name: 'project-context' },
    content: skillContent('builtin:project-context'),
    resources: {}
  },
  [SELF_SKILL_ID]: {
    ...SELF_ROW,
    frontmatter: { name: 'api-doc-gen', license: 'Internal' },
    content: skillContent('api-doc-gen'),
    resources: {}
  }
};

/** 更新留痕（按来源包；倒序预排——最近在前。harness 真更新后 unshift 第三条）。 */
export const UPDATE_TRACES = {
  [PACK_A]: [
    {
      sourcePackage: PACK_A,
      fromVersion: '9988776655443322110099aabbccddeeff001122',
      toVersion: PACK_A_FROM,
      operatorId: '1',
      operatorName: '王建设',
      operatedAt: '2026-09-10T08:00:00Z'
    },
    {
      sourcePackage: PACK_A,
      fromVersion: '556677889900112233445566778899aabbccdde0',
      toVersion: '9988776655443322110099aabbccddeeff001122',
      operatorId: '3',
      operatorName: '陈运营',
      operatedAt: '2026-09-03T06:30:00Z'
    }
  ]
};

/** install mock 装入条目（e2e-new-pack 2 行——版本＝装时 HEAD）。 */
export const INSTALL_ROWS = [
  {
    id: '740223456789000401',
    name: 'chart-render',
    description: '将数据表渲染为图表组件',
    source: 2,
    sourceName: '安装',
    sourcePackage: INSTALL_REPO_URL,
    version: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    status: 1,
    statusName: '启用',
    operatorId: '1',
    operatorName: 'E2E Mock',
    updateAvailable: null,
    loadCount: '0',
    lastLoadedAt: null
  },
  {
    id: '740223456789000402',
    name: 'slide-builder',
    description: '按大纲生成演示幻灯片',
    source: 2,
    sourceName: '安装',
    sourcePackage: INSTALL_REPO_URL,
    version: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    status: 1,
    statusName: '启用',
    operatorId: '1',
    operatorName: 'E2E Mock',
    updateAvailable: null
  }
];

/** 真更新后 PACK_A 新增行（同名行原地翻新、消失行移除之外的新插入行）。 */
export const UPDATE_ADDED_ROW = {
  id: '740223456789000501',
  name: 'diagram-draw',
  description: '绘制架构图与流程图',
  source: 2,
  sourceName: '安装',
  sourcePackage: PACK_A,
  version: PACK_A_TO,
  status: 1,
  statusName: '启用',
  operatorId: '1',
  operatorName: 'E2E Mock',
  updateAvailable: false
};

/* ---- 指派域（#68；`AiplatformSlotAssignmentResponse`={slot, skills[]} 与 PUT 回执同形、
 * `AiplatformSkillAssignCommand`={skillIds[]}——api-docs 实读）。初始态覆盖三签用例靶：
 * main 两项含停用行 csv-analyzer（「指派了但已停用」warning 呈现靶）/ executor 一项（清空靶）/
 * subagent 空（空→非空靶）。PUT 由 harness 就地整包替换（回读如实）。 ---- */

/** 指派槽位三键（路径段寻址；mock 对未知槽位回 404 SKL_010=7010）。 */
export const ASSIGN_SLOTS = ['main', 'executor', 'subagent'];

/** 初始指派态（安装行 TSID id 数组——GET 时映射 SKILL_ROWS 行）。 */
export const SKILL_ASSIGNMENTS = {
  main: [DISABLE_ID, ENABLE_ID],
  executor: [UNINSTALL_ID],
  subagent: []
};

/** subagent 空→非空靶（doc-writer 行 id——PUT body 断言锚）。 */
export const EMPTY_SLOT_ROW_ID = '740223456789000301';

/* ---- 智能体配置域（#69 初建；#91 档位化＋designer＋边缘四点）。契约要点：
 * 三座默认档 main/executor=flash、designer=pro，强档默认均 pro；边缘四点默认均 flash；
 * PUT 五字段全量终态（null/缺省/纯空白＝清覆盖回落默认、两 flag 缺省＝true 开）；
 * 工具开关窄幅写口挂 **main 行开关列**，main 槽增强件挂载态由 harness 按 main 配置 flag 派生。
 * 覆盖矩阵：main＝prompt/主档/强档三覆盖（主档 legacy-pro 已停用、fetchUrl 关）/executor、
 * designer＝全默认；边缘 naming=pro 覆盖，其余默认。留痕覆盖变化项过滤＋null「（默认）」。
 * ---- */

/** main 座枚举默认 prompt（覆盖预览/回落落点断言锚——清空覆盖即回此值）。 */
export const MAIN_DEFAULT_PROMPT = '你是主智能体：负责需求梳理、答询与迭代受理，永不读写沙箱代码。（E2E 默认 prompt 锚）';

/** main 座覆盖 prompt（编辑态预填/回滚写回断言锚）。 */
export const MAIN_OVERRIDE_PROMPT = '定制版主智能体提示词：聚焦电商交付话术。（E2E 覆盖 prompt 锚）';

/** executor 座枚举默认 prompt（全默认靶——生效值＝默认原文）。 */
export const EXECUTOR_DEFAULT_PROMPT = '你是 run 执行体：负责生成/更新 run 的执行侧读写。（E2E 默认 prompt 锚）';

/** main 座覆盖模型档位（已绑定后遭停用的警示靶；回滚 PUT body 断言锚）。 */
export const MAIN_OVERRIDE_MODEL = 'legacy-pro';

/** 配置读面（harness 写变异就地改；executor 无覆盖行＝写者 null 全回落）。 */
export const AGENT_CONFIGS = {
  main: {
    agentKey: 'main',
    agentName: '主智能体',
    systemPrompt: MAIN_OVERRIDE_PROMPT,
    modelId: MAIN_OVERRIDE_MODEL,
    systemPromptOverridden: true,
    modelIdOverridden: true,
    defaultSystemPrompt: MAIN_DEFAULT_PROMPT,
    defaultModelId: 'flash',
    webSearchEnabled: true,
    fetchUrlEnabled: false,
    routingStrongModelId: 'doubao-flagship',
    routingStrongModelIdOverridden: true,
    defaultRoutingStrongModelId: 'pro',
    operatorId: '700200',
    operatorName: '运营·技能管理员',
    updatedAt: '2026-09-20T09:30:00Z'
  },
  executor: {
    agentKey: 'executor',
    agentName: 'run 执行体',
    systemPrompt: EXECUTOR_DEFAULT_PROMPT,
    modelId: 'flash',
    systemPromptOverridden: false,
    modelIdOverridden: false,
    defaultSystemPrompt: EXECUTOR_DEFAULT_PROMPT,
    defaultModelId: 'flash',
    webSearchEnabled: true,
    fetchUrlEnabled: true,
    routingStrongModelId: 'pro',
    routingStrongModelIdOverridden: false,
    defaultRoutingStrongModelId: 'pro',
    operatorId: null,
    operatorName: null,
    updatedAt: null
  },
  designer: {
    agentKey: 'designer',
    agentName: '设计执行体',
    systemPrompt: '你是设计执行体：负责页面与视觉方案产出。（E2E 默认 prompt 锚）',
    modelId: 'pro',
    systemPromptOverridden: false,
    modelIdOverridden: false,
    defaultSystemPrompt: '你是设计执行体：负责页面与视觉方案产出。（E2E 默认 prompt 锚）',
    defaultModelId: 'pro',
    webSearchEnabled: true,
    fetchUrlEnabled: true,
    routingStrongModelId: 'pro',
    routingStrongModelIdOverridden: false,
    defaultRoutingStrongModelId: 'pro',
    operatorId: null,
    operatorName: null,
    updatedAt: null
  }
};

/** 配置座三键（路径段寻址；mock 对未知键 404 PRJ_033＝4033）。 */
export const AGENT_KEYS = ['main', 'executor', 'designer'];

/**
 * 配置变更留痕（operatedAt 倒序预排——最近在前；harness 写变异 unshift 新痕）。
 * t2（新）＝仅 fetchUrl 关——「只渲染变化项」靶；t1（旧）＝prompt+主档+强档三覆盖——
 * 多字段变化＋null 显「（默认）」靶（两 flag 未动不显）。
 */
export const AGENT_TRACES = {
  main: [
    {
      id: '740224000000000002',
      oldSystemPrompt: MAIN_OVERRIDE_PROMPT,
      oldModelId: MAIN_OVERRIDE_MODEL,
      oldWebSearchEnabled: true,
      oldFetchUrlEnabled: true,
      oldRoutingStrongModelId: 'doubao-flagship',
      newSystemPrompt: MAIN_OVERRIDE_PROMPT,
      newModelId: MAIN_OVERRIDE_MODEL,
      newWebSearchEnabled: true,
      newFetchUrlEnabled: false,
      newRoutingStrongModelId: 'doubao-flagship',
      operatorId: '700200',
      operatorName: '运营·技能管理员',
      operatedAt: '2026-09-20T09:30:00Z'
    },
    {
      id: '740224000000000001',
      oldSystemPrompt: null,
      oldModelId: null,
      oldWebSearchEnabled: true,
      oldFetchUrlEnabled: true,
      oldRoutingStrongModelId: null,
      newSystemPrompt: MAIN_OVERRIDE_PROMPT,
      newModelId: MAIN_OVERRIDE_MODEL,
      newWebSearchEnabled: true,
      newFetchUrlEnabled: true,
      newRoutingStrongModelId: 'doubao-flagship',
      operatorId: '1',
      operatorName: '王建设',
      operatedAt: '2026-09-10T08:00:00Z'
    }
  ],
  executor: [],
  designer: []
};

/** 边缘调用点四键（值面仅 modelId；缺省全部 flash）。 */
export const EDGE_KEYS = ['naming', 'compaction', 'classification', 'precheck'];

/** 边缘四点读面：naming=pro 覆盖靶，其余三点全默认。 */
export const EDGE_CONFIGS = {
  naming: {
    agentKey: 'naming',
    agentName: '项目取名',
    modelId: 'pro',
    modelIdOverridden: true,
    defaultModelId: 'flash',
    operatorId: '700210',
    operatorName: '运营·智能体管理员',
    updatedAt: '2026-10-20T10:00:00Z'
  },
  compaction: {
    agentKey: 'compaction',
    agentName: '上下文压缩',
    modelId: 'flash',
    modelIdOverridden: false,
    defaultModelId: 'flash',
    operatorId: null,
    operatorName: null,
    updatedAt: null
  },
  classification: {
    agentKey: 'classification',
    agentName: '入口分类',
    modelId: 'flash',
    modelIdOverridden: false,
    defaultModelId: 'flash',
    operatorId: null,
    operatorName: null,
    updatedAt: null
  },
  precheck: {
    agentKey: 'precheck',
    agentName: '技能预检',
    modelId: 'flash',
    modelIdOverridden: false,
    defaultModelId: 'flash',
    operatorId: null,
    operatorName: null,
    updatedAt: null
  }
};

/** 边缘留痕与三座同 DTO；非档位快照件恒缺省态。 */
export const EDGE_TRACES = {
  naming: [
    {
      id: '740224000000000101',
      oldSystemPrompt: null,
      oldModelId: null,
      oldWebSearchEnabled: true,
      oldFetchUrlEnabled: true,
      oldRoutingStrongModelId: null,
      newSystemPrompt: null,
      newModelId: 'pro',
      newWebSearchEnabled: true,
      newFetchUrlEnabled: true,
      newRoutingStrongModelId: null,
      operatorId: '700210',
      operatorName: '运营·智能体管理员',
      operatedAt: '2026-10-20T10:00:00Z'
    }
  ],
  compaction: [],
  classification: [],
  precheck: []
};

/**
 * 工具面三槽位（`AiplatformAgentToolSlotResponse` 形状——slotName 契约直读；呈现序＝平台资产
 * 在前、harness 内建在后）。main 槽两增强件 enabled 为占位——harness 读面按 main 配置 flag
 * 派生（同源不漂移）；骨架/harness 内建恒 true 锁死（PRJ_036）。
 */
export const AGENT_TOOL_SLOTS = [
  {
    slot: 'main',
    slotName: '主智能体',
    tools: [
      { name: 'ask_user', kind: 'SKELETON', enabled: true, description: '每轮一问的澄清工具（问答挂起的唯一起源——编排链路）' },
      { name: 'savePrd', kind: 'SKELETON', enabled: true, description: 'PRD 产出/修订落盘＋业务登记（编排链路）' },
      { name: 'saveBuildPlan', kind: 'SKELETON', enabled: true, description: '切片计划事实登记（生成编排的切片输入——编排链路）' },
      { name: 'list_workspace_files', kind: 'SKELETON', enabled: true, description: '工作区文件清单（答询查证只读件）' },
      { name: 'read_workspace_file', kind: 'SKELETON', enabled: true, description: '读工作区文件内容（答询查证只读件）' },
      { name: 'query_project_facts', kind: 'SKELETON', enabled: true, description: '查项目事实含系统访问地址（答询查证只读件）' },
      { name: 'fetch_url', kind: 'ENHANCEMENT', enabled: true, description: '读用户贴的 http/https 地址内容（增强可关）' },
      { name: 'web_search', kind: 'ENHANCEMENT', enabled: true, description: '自主搜索调研补缺口（增强可关——成本与滥用可控）' }
    ]
  },
  {
    slot: 'executor',
    slotName: 'run 执行体',
    tools: [
      { name: 'finish_edit', kind: 'SKELETON', enabled: true, description: '更新收口结束工具（编排链路）' },
      { name: 'update_plan', kind: 'SKELETON', enabled: true, description: 'run 级步骤清单的全量快照（编排链路）' },
      { name: 'read_file', kind: 'HARNESS_BUILTIN', enabled: true, description: 'harness 内建：读文件（呈现口径，不可开关）' },
      { name: 'execute', kind: 'HARNESS_BUILTIN', enabled: true, description: 'harness 内建：执行命令（呈现口径，不可开关）' }
    ]
  },
  {
    slot: 'subagent',
    slotName: '子智能体',
    tools: [
      { name: 'read_file', kind: 'HARNESS_BUILTIN', enabled: true, description: 'self-test 子智能体声明工具面（只读交付代码＋跑测试＋报告写隔离根）' },
      { name: 'execute', kind: 'HARNESS_BUILTIN', enabled: true, description: 'self-test 子智能体声明工具面（只读交付代码＋跑测试＋报告写隔离根）' }
    ]
  }
];

/* ---- 草稿域（#71；`AiplatformSkillDraftSummaryResponse`＝10 字段清单行 /
 * `AiplatformSkillDraftDetailResponse`＝16 字段（+content/scanFindings untyped map/留痕 4 件）/
 * `AiplatformSkillDraftRejectCommand`={reason}——admin #92 源码核实）。契约要点：清单＝在途
 * 活跃面恒 status 1、**不分页**自荐倒序；id TSID 十进制串透传；slot 三值稳定键（无 slotName
 * ——端侧映射）；scanVerdict SAFE/CAUTION 两值（DANGEROUS 写入口拒收不落库）；留痕 4 件
 * 在途恒 null（终态留档——harness 写后回填）；promote 回执＝技能库清单行（自产形状）、
 * reject 回执＝终态草稿详情。覆盖矩阵：d1 SAFE/findings 空/executor＝晋升靶、d2 CAUTION/
 * findings 两条（七键全 + 缺键样本＝投影缺键跳过靶）/subagent＝拒绝靶（抽屉动作条发起）、
 * d3 SAFE/main＝抽屉只读靶。血统三件覆盖三槽位。 ---- */

/** 在途草稿清单（自荐倒序预排——d1 最近在前；harness 写后移除＝终态不列活跃面）。 */
export const SKILL_DRAFT_ROWS = [
  {
    id: PROMOTE_DRAFT_ID,
    name: 'prd-review-checklist',
    description: '按 PRD 评审清单逐项核对需求完整性',
    slot: 'executor',
    projectId: '7395120209080100101',
    runId: 'run-20260928-0342',
    scanVerdict: 'SAFE',
    status: 1,
    statusName: '在途',
    createdAt: '2026-09-28T15:42:10'
  },
  {
    id: REJECT_DRAFT_ID,
    name: 'competitor-sniff',
    description: '抓取竞品定价页并生成对比摘要',
    slot: 'subagent',
    projectId: '7395120209080100102',
    runId: 'run-20260927-0918',
    scanVerdict: 'CAUTION',
    status: 1,
    statusName: '在途',
    createdAt: '2026-09-27T11:18:33'
  },
  {
    id: DRAWER_DRAFT_ID,
    name: 'meeting-notes-distill',
    description: '把会议记录蒸馏为决议与待办清单',
    slot: 'main',
    projectId: '7395120209080100101',
    runId: 'run-20260926-0077',
    scanVerdict: 'SAFE',
    status: 1,
    statusName: '在途',
    createdAt: '2026-09-26T09:03:45'
  }
];

/** 造草稿正文（自产 a-only 无 scripts；判读主体，多段 + 断言锚点）。 */
function draftContent(name) {
  return [
    `# ${name}`,
    '',
    `## 职能`,
    `${DRAFT_CONTENT_MARK} 本技能按自荐时的会话上下文履行其专职动作，输入输出约定如下。`,
    '',
    '## 使用约束',
    '仅在明确指令下调用；失败时如实回报，不静默重试。',
    '',
    '## 参考',
    '无外部资料接触（血统可溯——来源 run 全程站内）。'
  ].join('\n');
}

/**
 * 在途终态留痕四件恒 null（契约形）。d2 findings 两条：第一条七键全（file:line/代码块靶）、
 * 第二条缺 category/line/description（投影缺键跳过靶）。
 */
export const SKILL_DRAFT_DETAILS = {
  [PROMOTE_DRAFT_ID]: {
    ...SKILL_DRAFT_ROWS[0],
    content: draftContent('prd-review-checklist'),
    scanFindings: [],
    operatorId: null,
    operatorName: null,
    reviewedAt: null,
    rejectReason: null
  },
  [REJECT_DRAFT_ID]: {
    ...SKILL_DRAFT_ROWS[1],
    content: draftContent('competitor-sniff'),
    scanFindings: [
      {
        patternId: 'external-fetch',
        severity: 'HIGH',
        category: 'network',
        file: 'SKILL.md',
        line: 12,
        matchText: '抓取 https://competitor.example.com/pricing',
        description: '正文含外部抓取指令——外部资料接触史必查'
      },
      {
        patternId: 'shell-exec',
        severity: 'MEDIUM',
        file: 'SKILL.md',
        line: 18,
        matchText: 'curl -sL "$url" | head -200'
      }
    ],
    operatorId: null,
    operatorName: null,
    reviewedAt: null,
    rejectReason: null
  },
  [DRAWER_DRAFT_ID]: {
    ...SKILL_DRAFT_ROWS[2],
    content: draftContent('meeting-notes-distill'),
    scanFindings: [
      {
        patternId: 'pii-mention',
        severity: 'LOW',
        category: 'privacy',
        file: 'SKILL.md',
        line: 7,
        matchText: '记录参会人手机号',
        description: '正文提及个人信息字段——确认不落盘'
      }
    ],
    operatorId: null,
    operatorName: null,
    reviewedAt: null,
    rejectReason: null
  }
};

/* ---- 指派预检（#72；`AiplatformSkillAssignPrecheckResponse`={executed, hints[]} /
 * `PrecheckHint`={skills[], counterpart?, overlap?, resolution?}——三 String 可 null＝模型输出
 * 解析态——api-docs 实读（admin #90）。契约要点：`skills` 是**技能名清单**（非柄）；
 * executed=false 时 hints 恒空（未执行降级态——不得伪装成无重叠）。SKILL_PRECHECK 由 e2e
 * 就地切态：mode 'overlap'（两 hints——第一条四字段全·counterpart＝「工作协议」形、第二条
 * 三字段全 null＝「—」占位靶）/ 'clean'（executed=true hints 空）/ 'notExecuted'（降级态靶）；
 * delayMs 模拟模型判定延迟（预检钮 loading 态靶）。 ---- */

/** overlap 态 hints 样本（断言锚＝四字段标签 + 值原文直读）。 */
export const PRECHECK_HINTS = [
  {
    skills: ['doc-writer', 'prd-writing'],
    counterpart: '工作协议',
    overlap: '都在 PRD 产出环节做结构化写作，方法论高度重叠',
    resolution: '二选一或收窄 description'
  },
  {
    skills: ['doc-writer'],
    counterpart: null,
    overlap: null,
    resolution: null
  }
];

/** 预检 mock 态（e2e 就地切：mode 三态 + delayMs 判定延迟 ms）。 */
export const SKILL_PRECHECK = { mode: 'overlap', delayMs: 0 };
