/**
 * AI 平台领域常量（aiplatform，#56/#57/#58/#60/#61/#62/#63/#64/#67/#68/#69）——订单域 + 项目域 + 沙箱域 + 成本域 + 单价表域 + 素材域 + 技能域 + 指派域 + 智能体配置域。
 *
 * `status` 是 Integer code，响应带 `statusName` 中文名（ADR-0009 直读）——
 * 列表/详情/下拉标签文案直接用响应 `statusName` 原值（aiplatform 链路有 *Name，与 account 域
 * 无 *Name、需 record 映射不同，故本域无 statusRecord）；
 * 本文件只服务**筛选下拉选项与标签配色**（按钮门控用 `status` code：未支付=1|2 可报价/取消；3 已支付可重试归档）。
 * 整数枚举范式：手写 options、不走 transformRecordToOption（number 键运行时被压 string，破坏 NSelect）。
 */

/** 订单状态标签色（语义：待报价信息 / 已报价主色 / 已支付成功 / 终态灰 / 取消红）。 */
export const orderStatusTagColor: Record<Api.Aiplatform.OrderStatus, NaiveUI.ThemeColor> = {
  1: 'info',
  2: 'primary',
  3: 'success',
  4: 'default',
  5: 'error'
};

/**
 * 交付物类型标签色（#76：1=设计 info／2=系统 success／3=系统＋设计 warning）。
 * 文案走响应 deliverableTypeName 直读（ADR-0009，无端侧映射）——本 Record 只配色；
 * 取件端点亦按此 code 自适应（2=源码包实时打包；1/3=设计资产包下单冻结件，3 型统一部件容器）。
 */
export const orderDeliverableTypeTagColor: Record<Api.Aiplatform.OrderDeliverableType, NaiveUI.ThemeColor> = {
  1: 'info',
  2: 'success',
  3: 'warning'
};

/** 状态筛选下拉（多选；手写 number options，组件内渲染时翻译）。 */
export const orderStatusOptions: CommonType.Option<Api.Aiplatform.OrderStatus, App.I18n.I18nKey>[] = [
  { value: 1, label: 'page.aiplatform.order.statusEnum.pendingQuote' },
  { value: 2, label: 'page.aiplatform.order.statusEnum.quoted' },
  { value: 3, label: 'page.aiplatform.order.statusEnum.paid' },
  { value: 4, label: 'page.aiplatform.order.statusEnum.archived' },
  { value: 5, label: 'page.aiplatform.order.statusEnum.cancelled' }
];

/** 项目状态标签色（语义：进行中主色 / 已归档终态灰）。 */
export const projectStatusTagColor: Record<Api.Aiplatform.ProjectStatus, NaiveUI.ThemeColor> = {
  1: 'primary',
  3: 'default'
};

/**
 * 项目状态筛选三档单选（全部='all' 占位缺省不传参；与订单多选有意不同——provider 项目清单只收单值）。
 * 整数枚举手写 options 先例；「全部」用 'all' 哨兵字符串（NRadio value 不收 null）。
 */
export const projectStatusRadioOptions: { value: 'all' | Api.Aiplatform.ProjectStatus; label: App.I18n.I18nKey }[] = [
  { value: 'all', label: 'page.aiplatform.project.statusEnum.all' },
  { value: 1, label: 'page.aiplatform.project.statusEnum.inProgress' },
  { value: 3, label: 'page.aiplatform.project.statusEnum.archived' }
];

/**
 * 对话史 kind 标签色（语义：用户主色 / 智能体成功 / 问答卡 warning / 作答 info / 收尾卡红 /
 * 平台引导灰 / 报价卡主色——订单语义事件，与用户发言共用 primary 作金额类高亮）。
 */
export const conversationKindTagColor: Record<Api.Aiplatform.ConversationEntryKind, NaiveUI.ThemeColor> = {
  1: 'primary',
  2: 'success',
  3: 'warning',
  4: 'info',
  5: 'error',
  6: 'default',
  7: 'primary'
};

/* ---- 沙箱域（#60）---- */

/** 期望态筛选下拉（单选；手写 number options，组件内渲染时翻译；漂移清单=运行(1)+无容器(3) 组合）。 */
export const desiredStateOptions: CommonType.Option<Api.Aiplatform.WorkspaceDesiredState, App.I18n.I18nKey>[] = [
  { value: 1, label: 'page.aiplatform.workspace.desiredEnum.running' },
  { value: 2, label: 'page.aiplatform.workspace.desiredEnum.hibernated' },
  { value: 3, label: 'page.aiplatform.workspace.desiredEnum.sealed' }
];

/** 实态筛选下拉（单选；探查一瞥不落库——UNKNOWN 是诚实位，探查失败≠容器不在）。 */
export const containerStateOptions: CommonType.Option<Api.Aiplatform.WorkspaceContainerState, App.I18n.I18nKey>[] = [
  { value: 1, label: 'page.aiplatform.workspace.actualEnum.running' },
  { value: 2, label: 'page.aiplatform.workspace.actualEnum.stopped' },
  { value: 3, label: 'page.aiplatform.workspace.actualEnum.absent' },
  { value: 4, label: 'page.aiplatform.workspace.actualEnum.unknown' }
];

/** 置备状态标签色（语义：置备中 warning / 就绪成功 / 失败红）。 */
export const provisioningStatusTagColor: Record<Api.Aiplatform.WorkspaceProvisioningStatus, NaiveUI.ThemeColor> = {
  1: 'warning',
  2: 'success',
  3: 'error'
};

/** 期望态标签色（语义：运行主色 / 休眠 info / 封存终态灰——意图侧）。 */
export const desiredStateTagColor: Record<Api.Aiplatform.WorkspaceDesiredState, NaiveUI.ThemeColor> = {
  1: 'primary',
  2: 'info',
  3: 'default'
};

/** 实态标签色（语义：运行中成功 / 已停止 warning / 无容器红（期望运行时即漂移）/ 未知灰）。 */
export const containerStateTagColor: Record<Api.Aiplatform.WorkspaceContainerState, NaiveUI.ThemeColor> = {
  1: 'success',
  2: 'warning',
  3: 'error',
  4: 'default'
};

/**
 * 中间件资源 kind 端侧映射（1=PostgreSQL 2=Redis）——resources[].kind 契约**无 *Name 字段**
 * （区别于其余枚举 ADR-0009 直读）；两值是语言无关专有名词，端侧小映射不构成 i18n 负担。
 */
export const middlewareKindLabel: Record<1 | 2, string> = {
  1: 'PostgreSQL',
  2: 'Redis'
};

/**
 * 沙箱四写可用性（列表行下拉与详情抽屉共用单点，防两处门控漂移）。
 * 契约守卫链 WSP_001→007→015→009→017 的**可前置观测子集**（kind/status/desiredState 三要素）：
 * - 非 DEV（WSP_007）：四写全拒（v1 仅 DEV；TEST/PROD 纯运行不开放干预）——不可达操作不出现。
 * - 唤醒：无状态限制——封存态走深度唤醒、漂移/已死容器走幂等重建、run 在途不受限（不动数据面）。
 * - 休眠/重建/封存（重活三写同守卫 WSP_009）：置备中(1)/封存态(3) 拒——封存态卷已删（先唤醒）、
 *   置备在途不可打断。休眠对「已休眠」幂等成功（补删残留容器），照常给——期望休眠而实态运行
 *   的残留容器行正需要它。
 * run 在途(WSP_015)/收敛任务在途(WSP_017) 不在本函数可见字段内，留给服务端裁决走透传 toast。
 */
export function availableWorkspaceActions(meta: {
  kind: Api.Aiplatform.WorkspaceEnvKind;
  status: Api.Aiplatform.WorkspaceProvisioningStatus;
  desiredState: Api.Aiplatform.WorkspaceDesiredState;
}): Api.Aiplatform.WorkspaceAction[] {
  if (meta.kind !== 1) return [];
  const heavyAllowed = meta.status !== 1 && meta.desiredState !== 3;
  return heavyAllowed ? ['wake', 'hibernate', 'rebuild', 'seal'] : ['wake'];
}

/** 沙箱四写权限码（hasAuth 门控用；与门控 helper 同居单点——列表页与抽屉共用）。 */
export const workspaceWriteAuth: Record<Api.Aiplatform.WorkspaceAction, string> = {
  wake: 'admin:aiplatform:workspace:wake',
  hibernate: 'admin:aiplatform:workspace:hibernate',
  rebuild: 'admin:aiplatform:workspace:rebuild',
  seal: 'admin:aiplatform:workspace:seal'
};

/* ---- 成本域（#61）---- */

/** token 用量五档键序（stat tile / 柱状图系列 / 表格列统一顺序）。 */
export const TOKEN_TIER_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning'] as const;

export type TokenTierKey = (typeof TOKEN_TIER_KEYS)[number];

/** 五档档位名（i18n key；tile 标签与图表系列名共用单点）。 */
export const tokenTierLabel: Record<TokenTierKey, App.I18n.I18nKey> = {
  input: 'page.aiplatform.cost.tier.input',
  output: 'page.aiplatform.cost.tier.output',
  cacheRead: 'page.aiplatform.cost.tier.cacheRead',
  cacheWrite: 'page.aiplatform.cost.tier.cacheWrite',
  reasoning: 'page.aiplatform.cost.tier.reasoning'
};

/* ---- 单价表域（#62）---- */

/**
 * token 档位标签色（语义：输入 info / 输出主色 / 缓存读成功 / 缓存写 warning / 推理红 /
 * 按张灰——#77 第 6 档：图片生成按张计价，1–5 五色已占满、「非 token 档」灰系自成一档）。
 */
export const priceTokenKindTagColor: Record<Api.Aiplatform.PriceTokenKind, NaiveUI.ThemeColor> = {
  1: 'info',
  2: 'primary',
  3: 'success',
  4: 'warning',
  5: 'error',
  6: 'default'
};

/** 单价表两写动作（改价/停用；权限码 Record 的键约束）。 */
export type PriceEntryAction = 'reprice' | 'deactivate';

/** 单价表两写权限码（hasAuth 门控用；与沙箱域 workspaceWriteAuth 同型单点）。 */
export const priceEntryWriteAuth: Record<PriceEntryAction, string> = {
  reprice: 'admin:aiplatform:price-entry:reprice',
  deactivate: 'admin:aiplatform:price-entry:deactivate'
};

/* ---- 素材域（#63）---- */

/** 素材状态标签色（语义：启用成功（命中中）/ 停用终态灰（已退出命中））。 */
export const materialStatusTagColor: Record<Api.Aiplatform.MaterialStatus, NaiveUI.ThemeColor> = {
  1: 'success',
  2: 'default'
};

/** 素材状态筛选下拉（单选；手写 number options，组件内渲染时翻译；缺省＝全部）。 */
export const materialStatusOptions: CommonType.Option<Api.Aiplatform.MaterialStatus, App.I18n.I18nKey>[] = [
  { value: 1, label: 'page.aiplatform.material.statusEnum.enabled' },
  { value: 2, label: 'page.aiplatform.material.statusEnum.disabled' }
];

/** 素材三写权限码（hasAuth 门控用；与前两域同型单点——列表页与抽屉共用）。 */
export const materialWriteAuth: Record<Api.Aiplatform.MaterialAction, string> = {
  disable: 'admin:aiplatform:material:disable',
  enable: 'admin:aiplatform:material:enable',
  delete: 'admin:aiplatform:material:delete'
};

/* ---- 技能域（#67）---- */

/** 技能状态标签色（语义：启用成功（装配候选）/ 停用终态灰——与素材域同构）。 */
export const skillStatusTagColor: Record<Api.Aiplatform.SkillStatus, NaiveUI.ThemeColor> = {
  1: 'success',
  2: 'default'
};

/** 技能五写权限码（hasAuth 门控用；install 门控安装触发按钮、余四写门控操作下拉逐项）。 */
export const skillWriteAuth: Record<Api.Aiplatform.SkillAction, string> = {
  install: 'admin:aiplatform:skill:install',
  disable: 'admin:aiplatform:skill:disable',
  enable: 'admin:aiplatform:skill:enable',
  uninstall: 'admin:aiplatform:skill:uninstall',
  update: 'admin:aiplatform:skill:update'
};

/* ---- 草稿域（#71）---- */

/** 扫描判定标签色（语义：SAFE 安全 success / CAUTION 注意 warning——DANGEROUS 写入口拒收不可达）。 */
export const skillDraftScanVerdictTagColor: Record<Api.Aiplatform.SkillScanVerdict, NaiveUI.ThemeColor> = {
  SAFE: 'success',
  CAUTION: 'warning'
};

/** 扫描判定 label（端侧两值映射——响应无 *Name）。 */
export const skillDraftScanVerdictLabel: Record<Api.Aiplatform.SkillScanVerdict, App.I18n.I18nKey> = {
  SAFE: 'page.aiplatform.skillDraft.verdict.safe',
  CAUTION: 'page.aiplatform.skillDraft.verdict.caution'
};

/**
 * 草稿两审核写权限码（hasAuth 门控用）——行下拉与抽屉动作条双入口共用单点（workspaceWriteAuth
 * 先例：promote/reject 分别 `v-if`，审阅只读（read 码）无页内落点——菜单可见性归 RBAC/种子）。
 */
export const skillDraftWriteAuth: Record<Api.Aiplatform.SkillDraftAction, string> = {
  promote: 'admin:aiplatform:skill-draft:promote',
  reject: 'admin:aiplatform:skill-draft:reject'
};

/* ---- 指派域（#68）---- */

/**
 * 指派上下文状态标签色（与技能清单 skillStatusTagColor 有意不同）：停用行升级 warning
 * （「指派了但已停用」＝装配退化警示，终态语义——停用不解除指派）；启用 success 同技能清单。
 */
export const skillAssignmentStatusTagColor: Record<Api.Aiplatform.SkillStatus, NaiveUI.ThemeColor> = {
  1: 'success',
  2: 'warning'
};

/** 指派槽位三签（NTabs 顺序；路径段寻址，未知槽位 404 SKL_010——前端三槽固定不可达）。 */
export const SKILL_SLOTS: readonly Api.Aiplatform.SkillSlot[] = ['main', 'executor', 'subagent'];

/** 槽位签 label（端侧三值映射——响应无 slotName；签名与 toast 插值共用单点）。 */
export const skillSlotLabel: Record<Api.Aiplatform.SkillSlot, App.I18n.I18nKey> = {
  main: 'page.aiplatform.skillAssignment.slot.main',
  executor: 'page.aiplatform.skillAssignment.slot.executor',
  subagent: 'page.aiplatform.skillAssignment.slot.subagent'
};

/** 指派保存权限码（hasAuth 门控每签保存钮）。 */
export const SKILL_ASSIGN_AUTH = 'admin:aiplatform:skill:assign';

/* ---- 智能体配置域（#69）---- */

/** 配置座三键（NTabs 前三签顺序；路径段寻址，未知键 404 PRJ_033——前端三键固定不可达）。 */
export const AGENT_KEYS: readonly Api.Aiplatform.AgentKey[] = ['main', 'executor', 'designer'];

/** 配置座签 label（端侧三值映射——签渲染先于读面到手；读面到手后编辑卡题直读 agentName）。 */
export const agentKeyLabel: Record<Api.Aiplatform.AgentKey, App.I18n.I18nKey> = {
  main: 'page.aiplatform.agentConfig.agent.main',
  executor: 'page.aiplatform.agentConfig.agent.executor',
  designer: 'page.aiplatform.agentConfig.agent.designer'
};

/** 边缘调用点四键（合一签内纵排顺序；各点默认档全部 flash）。 */
export const EDGE_KEYS: readonly Api.Aiplatform.EdgeKey[] = ['naming', 'compaction', 'classification', 'precheck'];

/** 边缘点 label（响应 agentName 到手前的回落；与配置座签分 namespace 防混称）。 */
export const edgeKeyLabel: Record<Api.Aiplatform.EdgeKey, App.I18n.I18nKey> = {
  naming: 'page.aiplatform.agentConfig.edge.naming',
  compaction: 'page.aiplatform.agentConfig.edge.compaction',
  classification: 'page.aiplatform.agentConfig.edge.classification',
  precheck: 'page.aiplatform.agentConfig.edge.precheck'
};

/** 工具面类别端侧三值映射（kind string 裸值无 *Name——skillSlotLabel 先例：i18n key 单点）。 */
export const agentToolKindLabel: Record<Api.Aiplatform.AgentToolKind, App.I18n.I18nKey> = {
  SKELETON: 'page.aiplatform.agentConfig.tool.kindLabel.skeleton',
  ENHANCEMENT: 'page.aiplatform.agentConfig.tool.kindLabel.enhancement',
  HARNESS_BUILTIN: 'page.aiplatform.agentConfig.tool.kindLabel.builtin'
};

/** 工具面类别标签色（语义：骨架 info（编排链路）/ 增强 warning（唯一可开关位）/ 内建终态灰）。 */
export const agentToolKindTagColor: Record<Api.Aiplatform.AgentToolKind, NaiveUI.ThemeColor> = {
  SKELETON: 'info',
  ENHANCEMENT: 'warning',
  HARNESS_BUILTIN: 'default'
};

/** 配置读权限码（仅边缘调用点签显隐；三座与工具面签不设页内门控）。 */
export const AGENT_CONFIG_READ_AUTH = 'admin:aiplatform:agent-config:read';

/** 配置写权限码（门控编辑卡保存钮与留痕条目「回滚」——回滚＝PUT 配置写同码）。 */
export const AGENT_CONFIG_UPDATE_AUTH = 'admin:aiplatform:agent-config:update';

/** 工具开关权限码（门控增强工具 NSwitch 可操作；无码 disabled 呈现态）。 */
export const AGENT_TOOL_TOGGLE_AUTH = 'admin:aiplatform:agent-tool:toggle';

/* ---- 合同域（#87 A 批 T1——六态人工承接；门控矩阵单点＝workspace 先例）---- */

/**
 * 合同状态标签色（语义：准备中 info（新稿）/ 待核对与签署 primary（操作主位）/ 签署进行中
 * warning（等待外部签署）/ 签署完成 success / 失败或过期红 / 终态灰）。
 */
export const contractStatusTagColor: Record<Api.Aiplatform.ContractStatus, NaiveUI.ThemeColor> = {
  1: 'info',
  2: 'primary',
  3: 'warning',
  4: 'success',
  5: 'error',
  6: 'default'
};

/** 状态筛选下拉（多选；手写 number options，组件内渲染时翻译——同订单域多选逗号串）。 */
export const contractStatusOptions: CommonType.Option<Api.Aiplatform.ContractStatus, App.I18n.I18nKey>[] = [
  { value: 1, label: 'page.aiplatform.contract.statusEnum.preparing' },
  { value: 2, label: 'page.aiplatform.contract.statusEnum.pendingSign' },
  { value: 3, label: 'page.aiplatform.contract.statusEnum.signing' },
  { value: 4, label: 'page.aiplatform.contract.statusEnum.signed' },
  { value: 5, label: 'page.aiplatform.contract.statusEnum.failed' },
  { value: 6, label: 'page.aiplatform.contract.statusEnum.withdrawn' }
];

/**
 * 六态×七写门控矩阵（行下拉与抽屉动作条双入口共用单点，防两处门控漂移——workspace 先例）。
 * 守卫链全在 provider（ORD_021 无边等兜底透传），本函数只收**可前置观测子集**：
 * - 终态（4/5/6）：七写全拒（4 永不删、5/6 重建走订单抽屉创建口）。
 * - advance：线性单步 1→2→3；末边 3→4 须双方均签（ORD_027）——签署位仅详情可观测，
 *   **行清单 wire 无此字段 → 传 undefined 时 3 态不出推进**（保守门控，末边推进走抽屉）。
 * - fail：仅自 2/3 可达（用户放弃核对或超期未签）。
 * - sign：仅 3（签署进行中）可落签；已落签署位幂等拒（ORD_028 服务端裁决）。
 * - record：仅草稿态 1/2（「需更新」处置正路；3 起 ORD_031 变动走撤回/作废重建）。
 * - withdraw/void：自任何非终态可达（守卫同、留痕 action 分立可审计）。
 */
export function availableContractActions(meta: {
  status: Api.Aiplatform.ContractStatus;
  /** 末边双签门控观测位——行清单无签署位传 undefined（3 态不出推进）；抽屉传详情实值。 */
  partyASigned?: boolean;
  partyBSigned?: boolean;
}): Api.Aiplatform.ContractAction[] {
  const { status } = meta;
  if (status === 4 || status === 5 || status === 6) return [];
  const actions: Api.Aiplatform.ContractAction[] = [];
  if (status === 1 || status === 2) actions.push('advance');
  if (status === 3 && meta.partyASigned === true && meta.partyBSigned === true) actions.push('advance');
  if (status === 3) actions.push('sign');
  if (status === 1 || status === 2) actions.push('record');
  if (status === 2 || status === 3) actions.push('fail');
  actions.push('withdraw', 'void');
  return actions;
}

/** 合同六写权限码（hasAuth 逐写门控——读写分权、每写一码；创建重建第七写独立 `CONTRACT_CREATE_AUTH` 挂订单抽屉入口）。 */
export const contractWriteAuth: Record<Api.Aiplatform.ContractAction, string> = {
  advance: 'admin:aiplatform:contract:advance',
  fail: 'admin:aiplatform:contract:fail',
  withdraw: 'admin:aiplatform:contract:withdraw',
  void: 'admin:aiplatform:contract:void',
  sign: 'admin:aiplatform:contract:sign',
  record: 'admin:aiplatform:contract:record'
};

/** 创建/重建权限码（订单抽屉动作行「创建合同」入口常给门控——在场/可建由服务端 409 裁决透传）。 */
export const CONTRACT_CREATE_AUTH = 'admin:aiplatform:contract:create';

/* ---- 付款核验域（#89 A 批 T2——嵌订单抽屉「付款核验」签；读码门控签显隐、三写逐码 hasAuth）---- */

/**
 * 付款节点状态标签色（五态语义：待支付 info／支付处理中 warning（渠道在途）／支付失败或
 * 关闭 error（渠道终局）／线下转账待核验 primary（核验操作主位）／已到账 success）。
 * 文案走响应 statusName 直读（ADR-0009，无端侧映射）——本 Record 只配色；v1 只走 1→4→5，
 * 2/3 为渠道真接后的保留位（配色先行，渲染零分支）。
 */
export const paymentNodeStatusTagColor: Record<Api.Aiplatform.PaymentNodeStatus, NaiveUI.ThemeColor> = {
  1: 'info',
  2: 'warning',
  3: 'error',
  4: 'primary',
  5: 'success'
};

/** 付款核验读码（订单抽屉「付款核验」签显隐——无码不渲染签，account-profile 嵌件先例）。 */
export const PAYMENT_READ_AUTH = 'admin:aiplatform:payment:read';

/**
 * 付款三写权限码（hasAuth 逐写门控——读写分权、每写一码：财务可只授核验/打回不授节点录入）。
 * 录入/重录按钮常给（不预判重录窗口——ORD_044 服务端裁决）；核验/打回按钮另按节点 4 态门控。
 */
export const PAYMENT_NODES_AUTH = 'admin:aiplatform:payment:update-plan';
export const PAYMENT_VERIFY_AUTH = 'admin:aiplatform:payment:verify';
export const PAYMENT_REJECT_AUTH = 'admin:aiplatform:payment:reject';

/* ---- 模型供应商域（#88 B 批 T1——通道 CRUD/远端清单拉取对照/留痕；读写分权、每写一码）---- */

/** 通道三写动作（权限码 Record 的键约束；读面四端点共用 read 一码不逐项门控）。 */
export type ModelProviderAction = 'create' | 'update' | 'delete';

/** 通道三写权限码（hasAuth 门控——创建钮/编辑·删除下拉项/留痕回滚钮（回滚＝打开更新表单，update 码同门控））。 */
export const modelProviderWriteAuth: Record<ModelProviderAction, string> = {
  create: 'admin:aiplatform:model-provider:create',
  update: 'admin:aiplatform:model-provider:update',
  delete: 'admin:aiplatform:model-provider:delete'
};

/* ---- 模型档位域（#90 B 批 T2——档位 CRUD/停用态/留痕回滚；读写分权、每写一码）---- */

/** 档位三写动作（权限码 Record 的键约束；读面三端点共用 read 一码不逐项门控）。 */
export type ModelTierAction = 'create' | 'update' | 'delete';

/**
 * 档位三写权限码（hasAuth 门控——创建钮/编辑·删除下拉项/留痕回滚钮（回滚＝打开预填表单，
 * 行在走 PUT/行已删走创建重建，两路均 update 或 create 码——按目标形态分别门控））。
 * 供应商页对照 drawer 内嵌「入库」复用 create 键（跨域写口自然拦截）。
 */
export const modelTierWriteAuth: Record<ModelTierAction, string> = {
  create: 'admin:aiplatform:model-tier:create',
  update: 'admin:aiplatform:model-tier:update',
  delete: 'admin:aiplatform:model-tier:delete'
};
