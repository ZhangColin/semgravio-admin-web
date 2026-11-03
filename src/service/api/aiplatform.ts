/**
 * AI 平台管理 API（#56/#57/#58/#61）——admin BFF `/api/admin/aiplatform/**`（前端只调 admin 后端，不直连 provider）。
 *
 * 订单域（T1 tracer bullet，6 端点）。契约正本 = admin :8081 `/v3/api-docs`：
 * - 分页全链 1-based（ADR-0012）：`page` 直传零 ±1。
 * - `status` 多选：逗号分隔单值（`status=1,5`——BFF 拼串透传 provider 签名协议，
 *   `status=1&status=2` 重复键会被 provider 签名丢弃，故不能交给 axios 默认数组序列化）。
 * - 写操作身份不进 body——经 admin 出站 `X-User-Id`/`X-User-Name` 自动注入，provider 落操作者列。
 * - 三写成功回执 `OrderWriteAck`（前端不回读此体，自行回详情 + 刷列表）。
 * - 源码包 = tar.gz 二进制流（**无 ApiResponse 信封**）：`responseType: 'blob'`，
 *   失败信封（content-type json）由 @sa/axios 自动 blob→json 走 onError 统一 toast。
 *
 * 项目域（T2，6 读端点）。与订单域有意不同：status **三档单选单值直传**（全部/进行中/已归档，
 * 无逗号拼接）；四 tab 数据各自独立端点、抽屉内按 tab 懒加载；对话史/PRD/版本无分页（全量数组）。
 *
 * 项目交付物文件区（T3，3 端点）：文件树只列文件（目录由前端按路径段合成）、内容点读、
 * 文件包 tar.gz 二进制流（同订单源码包——无信封 `responseType: 'blob'`）。文件区挂项目不挂订单：
 * 未下单项目可浏览、归档项目照读。
 *
 * 沙箱域（T4，6 端点）：期望态/实态两列如实分示（漂移=期望运行而实态无容器，actual=3 即捞漂移清单）；
 * 四写均无 body、响应＝动作后的观测详情（WorkspaceDetail）——区别于订单 OrderWriteAck，
 * 响应即新事实，前端直接回填抽屉免二次回读 + 刷列表。实态/卷大小逐行现场探查（docker 子进程）。
 *
 * 成本域（T5，4 读端点）：时间窗 from/to 必填（ISO-8601 Instant UTC 带 Z，半开 [from,to)）——
 * BFF 不设默认窗口、缺参 400，前端显式传窗（默认最近 30 天、变更即重查）。五档 token 为
 * primitive long → JSON 数字（区别于金额 Long-string 口径）；cost{} 暂缓渲染（REQ-20 #75）。
 *
 * 单价表域（T6，3 端点）：清单（现行+历史行全量，provider/model 精确等值过滤）+ 原子改价（同事务
 * 关当前行开新行，effectiveFrom 可未来时点=预发布）+ 停用（即时关行不接新行）。无「开行」端点——
 * 种子脚本通道不暴露，web 改价只走原子 reprice。unitPrice 响应 string / 请求 number（REQ-20 #75）。
 *
 * 素材域（T7，5 端点）：知识治理面——清单（status 单选/沉淀时间闭区间 Instant UTC/来源项目 id 精确）
 * + 详情（元数据 + content＝块按 seq 空行拼接全文）+ 停用⇄启用（可逆开关、重复幂等）+ 删除
 * （不可逆治理移除、不动来源项目；回执＝删除前终态）。三写回执是 summary（区别于沙箱域回执＝
 * 观测详情——summary 无 content，抽屉开着须二次回读详情）。kind 为 string 裸值（v1 恒 "PRD"）。
 *
 * 账号域（#56 收口，1 端点）：有码无页——订单/项目详情抽屉嵌件按 externalId 查极简档案认交易对手。
 * 详情响应不带 externalId（契约如此），嵌件由列表页 externalId 筛选值驱动（过渡——REQ-21/admin#76
 * 落地 detail 补 ownerExternalId 后迁锚点至详情响应）。
 *
 * 技能域（#67 技能管理，技能线 8 端点）：git 仓库快照安装治理面——清单（内置＋安装同权、不分页、
 * 内置在前）+ 详情（frontmatter 全量＋正文全文＝审核面）+ 安装/卸载/停用⇄启用/显式更新/更新留痕。
 * id 为 opaque 串两形制（builtin: 前缀 / TSID 十进制串）路径段直传；安装命令无 tag/ref（版本恒＝
 * 装时 HEAD）；updateAvailable 展示性标记不门控更新；回执三形（install＝条目数组 / 卸载·启停＝
 * 单个 summary / update＝from→to＋移除名单＋终态行集）。
 *
 * 指派域（#68 指派配置，技能线 assignments 2 端点）：每职能槽位一个 GET/PUT——PUT 整包替换
 * （清单即终态、空＝清空），回执＝替换后读面（含停用行，「指派了但已停用」实态）；前端 toast＋
 * 回读刷新。装配生效＝动态查库（变更后下一轮自然生效）。
 *
 * 智能体配置域（#69 智能体配置，技能线 agent-configs 3 + agent-tools 2 端点）：两座智能体
 *   （main/executor）systemPrompt/模型档位覆盖态编辑＋变更留痕时间线（回滚＝old* 快照写回，
 *   无专用端点）；工具面按三槽位列挂载工具。保存四字段全量回传（两工具 flag 以 GET 回显原值
 *   透传——契约「缺省＝true 开」，防静默误开）；工具开关独走 tool 端点（agent-tool:toggle 码），
 *   config 表单不动两 flag。
 *
 * 合同域（#87 A 批 T1，9 端点）：六态人工承接（1 准备中→2 待核对与签署→3 签署进行中→4 签署
 *   完成，末边须双方均签；旁落 5/旁支 6 终态不删、重建换新号）。清单四维检索同订单域形制
 *   （status 多选逗号单值/createdFrom·To 本地串/orderId/contractNo）；详情三段＝contract 全
 *   字段（needsUpdate 派生标志＋范围快照冻结三段＋双方签署位/落签时点）＋PRD 全文＋transitions
 *   新→旧。七写守卫全在 provider（ORD_02x 透传不判码）；七写回执均＝单段合同体（非三段
 *   detail）——前端不消费：toast＋详情回读＋列表刷新。创建重建无请求体（冻结集取现值）。
 *
 * 模型供应商域（#88 B 批 T1，通道 6＋档位入库 1 端点）：通道（providerKey＝协议路由前缀）
 *   CRUD/远端清单拉取对照/变更留痕——清单无分页全量直灌（技能页先例）；apiKey 全链只写
 *   不读明文（读面/留痕恒掩码尾 4 位，null＝未配置）；更新缺省肢＝保持现值（apiKey 留空＝
 *   保持的 round-trip 安全语义）；远端拉取每次全量真拉无缓存、对照目录驱动「勾选入库」
 *   （复用档位创建写口 POST /model-tiers——跨域码 model-tier:create）。
 */
import { request } from '../request';

/** GET /aiplatform/orders——订单清单（四维检索：status 多选/创建时间区间/externalId/orderId 精确）。 */
export function fetchGetAiplatformOrderList(params: Api.Aiplatform.OrderSearchParams) {
  const serialized: Record<string, unknown> = { ...params };
  if (params.status?.length) {
    serialized.status = params.status.join(',');
  } else {
    delete serialized.status;
  }
  return request<Api.Common.PageResponse<Api.Aiplatform.OrderSummary>>({
    url: '/aiplatform/orders',
    method: 'get',
    params: serialized
  });
}

/** GET /aiplatform/orders/{id}——订单详情（价目史 append-only 全量新→旧 + PRD 快照）。 */
export function fetchGetAiplatformOrder(id: string) {
  return request<Api.Aiplatform.OrderDetail>({ url: `/aiplatform/orders/${id}`, method: 'get' });
}

/** POST /aiplatform/orders/{id}/quote——提交报价（已报价态重复提交＝改价）。 */
export function fetchQuoteAiplatformOrder(id: string, data: Api.Aiplatform.QuoteOrderCommand) {
  return request<Api.Aiplatform.OrderWriteAck>({ url: `/aiplatform/orders/${id}/quote`, method: 'post', data });
}

/** POST /aiplatform/orders/{id}/cancel——运营取消（限未支付态，reason 必填）。 */
export function fetchCancelAiplatformOrder(id: string, data: Api.Aiplatform.CancelOrderCommand) {
  return request<Api.Aiplatform.OrderWriteAck>({ url: `/aiplatform/orders/${id}/cancel`, method: 'post', data });
}

/** POST /aiplatform/orders/{id}/retry-archive——重试归档（已支付未归档卡单补归档）。 */
export function fetchRetryArchiveAiplatformOrder(id: string) {
  return request<Api.Aiplatform.OrderWriteAck>({ url: `/aiplatform/orders/${id}/retry-archive`, method: 'post' });
}

/** GET /aiplatform/orders/{id}/source-package——源码包 tar.gz 二进制流（无信封，成功返回 Blob）。 */
export function fetchDownloadOrderSourcePackage(id: string) {
  return request<Blob, 'blob'>({ url: `/aiplatform/orders/${id}/source-package`, method: 'get', responseType: 'blob' });
}

/** GET /aiplatform/orders/{id}/design-package——设计资产包 tar.gz 二进制流（无信封；下单冻结件，1/3 型单取此包）。 */
export function fetchDownloadOrderDesignPackage(id: string) {
  return request<Blob, 'blob'>({ url: `/aiplatform/orders/${id}/design-package`, method: 'get', responseType: 'blob' });
}

/** GET /aiplatform/projects——项目清单（四维检索：status 三档单选/创建时间区间/externalId/projectId 精确）。 */
export function fetchGetAiplatformProjectList(params: Api.Aiplatform.ProjectSearchParams) {
  return request<Api.Common.PageResponse<Api.Aiplatform.ProjectSummary>>({
    url: '/aiplatform/projects',
    method: 'get',
    params
  });
}

/** GET /aiplatform/projects/{id}——项目详情（订单引用双档 active/latest + 成本指针 + 工作区引用）。 */
export function fetchGetAiplatformProject(id: string) {
  return request<Api.Aiplatform.ProjectDetail>({ url: `/aiplatform/projects/${id}`, method: 'get' });
}

/** GET /aiplatform/projects/{id}/conversation——对话史（全量同序 id 升序=对话序；REQ-20 载荷跳过只渲染 text/kind/answered/at）。 */
export function fetchGetAiplatformProjectConversation(id: string) {
  return request<Api.Aiplatform.ConversationEntry[]>({ url: `/aiplatform/projects/${id}/conversation`, method: 'get' });
}

/** GET /aiplatform/projects/{id}/prd——PRD 全文（工作区直读；未产出 404 PRJ_015 走 onError 透传 toast）。 */
export function fetchGetAiplatformProjectPrd(id: string) {
  return request<Api.Aiplatform.PrdContent>({ url: `/aiplatform/projects/${id}/prd`, method: 'get' });
}

/** GET /aiplatform/projects/{id}/versions——版本列表（git log 新→旧；零版本=空列表非错误）。 */
export function fetchGetAiplatformProjectVersions(id: string) {
  return request<Api.Aiplatform.VersionSummary[]>({ url: `/aiplatform/projects/${id}/versions`, method: 'get' });
}

/** GET /aiplatform/projects/{id}/versions/{ref}——版本详情（锚定收尾卡 closing，可空兜底）。 */
export function fetchGetAiplatformProjectVersionDetail(id: string, ref: string) {
  return request<Api.Aiplatform.VersionDetail>({ url: `/aiplatform/projects/${id}/versions/${ref}`, method: 'get' });
}

/** GET /aiplatform/projects/{id}/files——文件树（[{path,size}] 只列文件，目录由前端按路径段合成；归档项目照读）。 */
export function fetchGetAiplatformProjectFiles(id: string) {
  return request<Api.Aiplatform.ProjectFiles>({ url: `/aiplatform/projects/${id}/files`, method: 'get' });
}

/** GET /aiplatform/projects/{id}/files/content?path=——文本文件内容（path 为文件树条目原样回传；机密/超 1MiB/非文本拒读由 provider 全裁决，HTTP 非 2xx）。 */
export function fetchGetAiplatformProjectFileContent(id: string, path: string) {
  return request<Api.Aiplatform.FileContent>({
    url: `/aiplatform/projects/${id}/files/content`,
    method: 'get',
    params: { path }
  });
}

/** GET /aiplatform/projects/{id}/files/package——文件包 tar.gz 二进制流（无信封，成功返回 Blob；sealed=-archive/未封存=-source 文件名由 provider 经 Content-Disposition 透传）。 */
export function fetchDownloadProjectFilesPackage(id: string) {
  return request<Blob, 'blob'>({ url: `/aiplatform/projects/${id}/files/package`, method: 'get', responseType: 'blob' });
}

/** GET /aiplatform/workspaces——沙箱清单（desired/actual 单选可组合；分页 1-based，size 上界 100——实态逐行探查，观测页不必贪大）。 */
export function fetchGetAiplatformWorkspaceList(params: Api.Aiplatform.WorkspaceSearchParams) {
  return request<Api.Common.PageResponse<Api.Aiplatform.WorkspaceSummary>>({
    url: '/aiplatform/workspaces',
    method: 'get',
    params
  });
}

/** GET /aiplatform/workspaces/{id}——沙箱详情（清单行超集：网络名/置备失败原因/封存包寻址键/审计列/中间件资源）。 */
export function fetchGetAiplatformWorkspace(id: string) {
  return request<Api.Aiplatform.WorkspaceDetail>({ url: `/aiplatform/workspaces/${id}`, method: 'get' });
}

/* 四写（均无 body；响应＝动作后的观测详情——前端回填抽屉 + 刷列表，不二次回读）。 */

/** POST /aiplatform/workspaces/{id}/wake——唤醒（等就绪；封存态走深度唤醒，漂移行幂等重建）。 */
export function fetchWakeAiplatformWorkspace(id: string) {
  return request<Api.Aiplatform.WorkspaceDetail>({ url: `/aiplatform/workspaces/${id}/wake`, method: 'post' });
}

/** POST /aiplatform/workspaces/{id}/hibernate——强制休眠（立即删容器保卷；已休眠幂等成功）。 */
export function fetchHibernateAiplatformWorkspace(id: string) {
  return request<Api.Aiplatform.WorkspaceDetail>({ url: `/aiplatform/workspaces/${id}/hibernate`, method: 'post' });
}

/** POST /aiplatform/workspaces/{id}/rebuild——强制重建（rm＋幂等重建，卷保留数据不动）。 */
export function fetchRebuildAiplatformWorkspace(id: string) {
  return request<Api.Aiplatform.WorkspaceDetail>({ url: `/aiplatform/workspaces/${id}/rebuild`, method: 'post' });
}

/** POST /aiplatform/workspaces/{id}/seal——封存（产物同自动封存：打包落存储＋删卷）。 */
export function fetchSealAiplatformWorkspace(id: string) {
  return request<Api.Aiplatform.WorkspaceDetail>({ url: `/aiplatform/workspaces/${id}/seal`, method: 'post' });
}

/* ---- 成本域（T5，4 读端点；from/to 必填——BFF 不设默认窗口，缺参 400 框架信封）。 */

/** GET /aiplatform/costs/overview——平台成本全局总览（时间窗；五档总量 + 分模型/分智能体两分解；cost{} 暂缓渲染）。 */
export function fetchGetAiplatformCostOverview(params: Api.Aiplatform.CostWindowParams) {
  return request<Api.Aiplatform.CostOverview>({ url: '/aiplatform/costs/overview', method: 'get', params });
}

/** GET /aiplatform/costs/unpriced——unpriced 全局警示（用量驱动；空窗/无未配价用量=空 items 非错误）。 */
export function fetchGetAiplatformCostUnpriced(params: Api.Aiplatform.CostWindowParams) {
  return request<Api.Aiplatform.UnpricedUsage>({ url: '/aiplatform/costs/unpriced', method: 'get', params });
}

/** GET /aiplatform/costs/projects——项目成本清单（窗口聚合；排序服务端定死成本降序、全未配价排后；分页 1-based）。 */
export function fetchGetAiplatformProjectCostList(params: Api.Aiplatform.CostProjectSearchParams) {
  return request<Api.Common.PageResponse<Api.Aiplatform.ProjectCost>>({
    url: '/aiplatform/costs/projects',
    method: 'get',
    params
  });
}

/** GET /aiplatform/costs/projects/{projectId}——单项目成本下钻（byModel/byAgentKind 分解 + unpriced 档位清单；查无=全零空态非 404）。 */
export function fetchGetAiplatformProjectCostDetail(projectId: string, params: Api.Aiplatform.CostWindowParams) {
  return request<Api.Aiplatform.ProjectCostDetail>({ url: `/aiplatform/costs/projects/${projectId}`, method: 'get', params });
}

/* ---- 单价表域（T6，3 端点；无「开行」端点——种子脚本通道不暴露，web 改价只走原子 reprice）。 */

/** GET /aiplatform/price-entries——单价行清单（现行+历史全量=价史全貌；provider/model 精确等值过滤；排序服务端定死生效起点倒序）。 */
export function fetchGetAiplatformPriceEntryList(params: Api.Aiplatform.PriceEntrySearchParams) {
  return request<Api.Common.PageResponse<Api.Aiplatform.UnitPriceEntry>>({
    url: '/aiplatform/price-entries',
    method: 'get',
    params
  });
}

/** POST /aiplatform/price-entries/{id}/reprice——原子改价（同事务关当前行+开新行；effectiveFrom 未来时点=预发布，重叠校验 provider 裁决）。回执 closed/opened 两行库内事实。 */
export function fetchRepriceAiplatformPriceEntry(id: string, data: Api.Aiplatform.RepriceCommand) {
  return request<Api.Aiplatform.RepriceReceipt>({ url: `/aiplatform/price-entries/${id}/reprice`, method: 'post', data });
}

/** POST /aiplatform/price-entries/{id}/deactivate——停用（即时生效关行不接新行；此后该匹配键用量进成本 unpriced 警示）。 */
export function fetchDeactivateAiplatformPriceEntry(id: string) {
  return request<Api.Aiplatform.UnitPriceEntry>({ url: `/aiplatform/price-entries/${id}/deactivate`, method: 'post' });
}

/* ---- 素材域（T7，5 端点；三写回执＝summary——无 content，抽屉开着须二次回读详情）。 */

/** GET /aiplatform/materials——知识素材清单（三维过滤：status 单选/沉淀时间闭区间 Instant UTC/来源项目 id 精确；排序沉淀倒序服务端定死）。 */
export function fetchGetAiplatformMaterialList(params: Api.Aiplatform.MaterialSearchParams) {
  return request<Api.Common.PageResponse<Api.Aiplatform.MaterialSummary>>({
    url: '/aiplatform/materials',
    method: 'get',
    params
  });
}

/** GET /aiplatform/materials/{id}——素材详情（元数据 + content＝块按 seq 空行拼接的素材全文；查无 404 KNW_005）。 */
export function fetchGetAiplatformMaterial(id: string) {
  return request<Api.Aiplatform.MaterialDetail>({ url: `/aiplatform/materials/${id}`, method: 'get' });
}

/** POST /aiplatform/materials/{id}/disable——停用素材（可逆开关：全部块退出生成命中；重复停用幂等、操作者留最近一次）。 */
export function fetchDisableAiplatformMaterial(id: string) {
  return request<Api.Aiplatform.MaterialSummary>({ url: `/aiplatform/materials/${id}/disable`, method: 'post' });
}

/** POST /aiplatform/materials/{id}/enable——启用素材（停用的可逆侧：全部块恢复参与生成命中；重复启用幂等）。 */
export function fetchEnableAiplatformMaterial(id: string) {
  return request<Api.Aiplatform.MaterialSummary>({ url: `/aiplatform/materials/${id}/enable`, method: 'post' });
}

/** DELETE /aiplatform/materials/{id}——删除素材（治理移除登记行与全部块、不动来源项目、不可逆；回执＝删除前终态 summary）。 */
export function fetchDeleteAiplatformMaterial(id: string) {
  return request<Api.Aiplatform.MaterialSummary>({ url: `/aiplatform/materials/${id}`, method: 'delete' });
}

/* ---- 技能域（#67 技能管理，技能线 8 端点；清单无分页、id＝opaque 串两形制透传）。 */

/** GET /aiplatform/skills——技能清单（内置＋安装同权、不分页；服务端排序内置在前）。 */
export function fetchGetAiplatformSkillList() {
  return request<Api.Aiplatform.SkillSummary[]>({ url: '/aiplatform/skills', method: 'get' });
}

/** GET /aiplatform/skills/{id}——技能详情（frontmatter 全量 + 正文全文＝安装审核面；查无 404 SKL_001）。 */
export function fetchGetAiplatformSkill(id: string) {
  return request<Api.Aiplatform.SkillDetail>({ url: `/aiplatform/skills/${id}`, method: 'get' });
}

/** POST /aiplatform/skills/install——安装技能包（git 快照固化；clone 走网络可能慢）。回执＝本次装入条目。 */
export function fetchInstallAiplatformSkill(data: Api.Aiplatform.InstallSkillCommand) {
  return request<Api.Aiplatform.SkillSummary[]>({ url: '/aiplatform/skills/install', method: 'post', data });
}

/** DELETE /aiplatform/skills/{id}——卸载技能（库行删除不可逆；有指派在身 409 SKL_008 先解绑）。回执＝删除前终态。 */
export function fetchUninstallAiplatformSkill(id: string) {
  return request<Api.Aiplatform.SkillSummary>({ url: `/aiplatform/skills/${id}`, method: 'delete' });
}

/** POST /aiplatform/skills/{id}/disable——停用技能（可逆开关；对内置行可达与否归 provider 裁决透传）。 */
export function fetchDisableAiplatformSkill(id: string) {
  return request<Api.Aiplatform.SkillSummary>({ url: `/aiplatform/skills/${id}/disable`, method: 'post' });
}

/** POST /aiplatform/skills/{id}/enable——启用技能（停用的可逆侧；重复启用幂等）。 */
export function fetchEnableAiplatformSkill(id: string) {
  return request<Api.Aiplatform.SkillSummary>({ url: `/aiplatform/skills/${id}/enable`, method: 'post' });
}

/** POST /aiplatform/skills/update——显式更新技能包（重拉快照＋版本留痕；远端已删且有指派 409 SKL_013 整体拒绝）。 */
export function fetchUpdateAiplatformSkill(data: Api.Aiplatform.UpdateSkillCommand) {
  return request<Api.Aiplatform.SkillUpdateReceipt>({ url: '/aiplatform/skills/update', method: 'post', data });
}

/** GET /aiplatform/skills/update-traces?sourcePackage=——更新留痕（按来源包必传；倒序 append-only、卸载不删痕）。 */
export function fetchGetAiplatformSkillUpdateTraces(sourcePackage: string) {
  return request<Api.Aiplatform.SkillUpdateTrace[]>({
    url: '/aiplatform/skills/update-traces',
    method: 'get',
    params: { sourcePackage }
  });
}

/* ---- 草稿域（#71 草稿审核，技能线 drafts 4 端点；清单＝在途活跃面不分页、id＝TSID 串透传）。 ---- */

/** GET /aiplatform/skills/drafts——在途草稿清单（跨项目全部在途、自荐时间倒序、不分页；终态不列活跃面）。 */
export function fetchGetAiplatformSkillDraftList() {
  return request<Api.Aiplatform.SkillDraftSummary[]>({ url: '/aiplatform/skills/drafts', method: 'get' });
}

/** GET /aiplatform/skills/drafts/{id}——草稿详情（正文全文＋scanFindings＋终态留痕＝人审判读面；任意状态可查，查无 404 SKL_015）。 */
export function fetchGetAiplatformSkillDraft(id: string) {
  return request<Api.Aiplatform.SkillDraftDetail>({ url: `/aiplatform/skills/drafts/${id}`, method: 'get' });
}

/**
 * POST /aiplatform/skills/drafts/{id}/promote——晋升入池（无 body、操作者 X-User 头）。回执＝技能库
 * 清单行（含新技能 id）；撞名 409 SKL_016 / 已审结 409 SKL_017（错误不判码：透传 toast＋无条件刷新）。
 */
export function fetchPromoteAiplatformSkillDraft(id: string) {
  return request<Api.Aiplatform.SkillSummary>({ url: `/aiplatform/skills/drafts/${id}/promote`, method: 'post' });
}

/**
 * POST /aiplatform/skills/drafts/{id}/reject——拒绝草稿（终态留档不复活；空白理由 400 SKL_018 兜底）。
 * 回执＝终态草稿详情（留痕直读——唯一终态留痕呈现面）。
 */
export function fetchRejectAiplatformSkillDraft(id: string, data: Api.Aiplatform.RejectSkillDraftCommand) {
  return request<Api.Aiplatform.SkillDraftDetail>({ url: `/aiplatform/skills/drafts/${id}/reject`, method: 'post', data });
}

/* ---- 指派域（#68 指派配置＋#72 预检，技能线 assignments 2＋precheck 1 端点；slot 路径段三值寻址）。 ---- */

/** GET /aiplatform/skills/assignments/{slot}——槽位指派读面（含停用行——「指派了但已停用」实态；未知槽位 404 SKL_010）。 */
export function fetchGetAiplatformSkillAssignments(slot: Api.Aiplatform.SkillSlot) {
  return request<Api.Aiplatform.SlotAssignment>({ url: `/aiplatform/skills/assignments/${slot}`, method: 'get' });
}

/** PUT /aiplatform/skills/assignments/{slot}——槽位指派整包替换（清单即终态、空＝清空；builtin 柄 400 SKL_011）。回执＝替换后读面（前端 toast＋回读刷新，不消费此体）。 */
export function fetchAssignAiplatformSkills(slot: Api.Aiplatform.SkillSlot, data: Api.Aiplatform.SkillAssignCommand) {
  return request<Api.Aiplatform.SlotAssignment>({ url: `/aiplatform/skills/assignments/${slot}`, method: 'put', data });
}

/**
 * POST /aiplatform/skills/assignments/{slot}/precheck——指派双头预检（#72；body 与 PUT 指派
 * 同形＝发起时勾选快照）。模型判定 15s 档、executed=false＝未执行降级态（不自动重试）——
 * 客户端超时覆写 30s（默认 10s 会先于后端自身超时掐断，抢走降级态回执）；非阻断：结果不拦
 * 指派提交，调用失败走 onError 信封透传。
 */
export function fetchPrecheckAiplatformSkillAssignment(slot: Api.Aiplatform.SkillSlot, data: Api.Aiplatform.SkillAssignCommand) {
  return request<Api.Aiplatform.SkillAssignmentPrecheck>({
    url: `/aiplatform/skills/assignments/${slot}/precheck`,
    method: 'post',
    data,
    timeout: 30 * 1000
  });
}

/* ---- 智能体配置域（#69，技能线 agent-configs 3 + agent-tools 2 端点；保存四字段全量回传——
 * 两工具 flag 以 GET 回显原值透传（契约「缺省＝true 开」，防静默误开）。 ---- */

/** GET /aiplatform/agent-configs/{agentKey}——配置读面（生效值＋覆盖标记＋默认预览＋两增强工具开关＋最近写者；未知键 404 PRJ_033＝4033）。 */
export function fetchGetAiplatformAgentConfig(agentKey: Api.Aiplatform.AgentKey) {
  return request<Api.Aiplatform.AgentConfig>({ url: `/aiplatform/agent-configs/${agentKey}`, method: 'get' });
}

/** PUT /aiplatform/agent-configs/{agentKey}——配置全量写（覆盖态终态＋变更留痕；systemPrompt/modelId null/缺省/纯空白＝清覆盖回落默认，值面无动＝幂等回执零写入）。回执与 GET 同形（前端 toast＋回读刷新，不消费此体）。 */
export function fetchUpdateAiplatformAgentConfig(agentKey: Api.Aiplatform.AgentKey, data: Api.Aiplatform.AgentConfigUpdateCommand) {
  return request<Api.Aiplatform.AgentConfig>({ url: `/aiplatform/agent-configs/${agentKey}`, method: 'put', data });
}

/** GET /aiplatform/agent-configs/{agentKey}/traces——配置变更留痕（operatedAt 倒序＝最近先，服务端定死；回滚依据）。 */
export function fetchGetAiplatformAgentConfigTraces(agentKey: Api.Aiplatform.AgentKey) {
  return request<Api.Aiplatform.AgentConfigTrace[]>({ url: `/aiplatform/agent-configs/${agentKey}/traces`, method: 'get' });
}

/** GET /aiplatform/agent-tools——工具面清单（按职能槽位列当前挂载工具；呈现序＝平台资产在前、harness 内建在后）。 */
export function fetchGetAiplatformAgentTools() {
  return request<Api.Aiplatform.AgentToolSlot[]>({ url: '/aiplatform/agent-tools', method: 'get' });
}

/** PUT /aiplatform/agent-tools/{toolName}——增强工具开关（窄幅写口：关即退出槽位装配面、开即回归；挂 main 行开关列与配置写共表共留痕）。骨架/内建 403 PRJ_036、enabled 缺省 400 PRJ_037。回执＝工具行新事实（前端 toast＋清单回读）。 */
export function fetchToggleAiplatformAgentTool(toolName: string, data: Api.Aiplatform.AgentToolToggleCommand) {
  return request<Api.Aiplatform.AgentTool>({ url: `/aiplatform/agent-tools/${toolName}`, method: 'put', data });
}

/* ---- 账号域（#56 收口，1 端点；有码无页——嵌订单/项目详情抽屉，无独立页面）。 */

/** GET /aiplatform/accounts/{externalId}——账号极简档案（id/externalId/displayName/createdAt；未命中 404 IDN_004→6004 走 onError 透传 toast）。 */
export function fetchGetAiplatformAccountProfile(externalId: string) {
  return request<Api.Aiplatform.AccountProfile>({ url: `/aiplatform/accounts/${externalId}`, method: 'get' });
}

/* ---- 合同域（#87 A 批 T1，9 端点：读 2＋创建重建 1＋六写口；六态人工承接，守卫全在
 * provider（ORD_02x 数字码透传不判码）。七写回执均＝单段合同体（非三段 detail）——前端
 * 不消费此体：toast＋详情回读＋列表刷新。 ---- */

/** GET /aiplatform/contracts——合同清单（四维检索：status 多选/创建时间区间/orderId/contractNo 精确；新在前 TSID 倒序服务端定死，分页 1-based）。 */
export function fetchGetAiplatformContractList(params: Api.Aiplatform.ContractSearchParams) {
  const serialized: Record<string, unknown> = { ...params };
  if (params.status?.length) {
    serialized.status = params.status.join(',');
  } else {
    delete serialized.status;
  }
  return request<Api.Common.PageResponse<Api.Aiplatform.ContractSummary>>({
    url: '/aiplatform/contracts',
    method: 'get',
    params: serialized
  });
}

/** GET /aiplatform/contracts/{id}——合同详情三段（contract 全字段含 needsUpdate/范围快照冻结三段/双方签署位＋落签时点；PRD 确认版全文；transitions 动作留痕新→旧）。 */
export function fetchGetAiplatformContract(id: string) {
  return request<Api.Aiplatform.ContractDetail>({ url: `/aiplatform/contracts/${id}`, method: 'get' });
}

/**
 * POST /aiplatform/contracts/orders/{orderId}——创建/重建合同（无请求体：冻结集由 provider
 * 取订单现值落）。前置门全在 provider 透传（404 ORD_001 / 409 ORD_025 无报价 / ORD_026 范围
 * 未录 / ORD_024 已有活跃合同 / ORD_021 已签关门）。回执＝新合同体（不消费——成功不跳转）。
 */
export function fetchCreateAiplatformContractForOrder(orderId: string) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/orders/${orderId}`, method: 'post' });
}

/** POST /aiplatform/contracts/{id}/advance——推进合同（线性单步；末边 3→4 须双方均签 409 ORD_027 兜底竞态；依据必填 ≤1000）。回执＝动作后合同现值（不消费）。 */
export function fetchAdvanceAiplatformContract(id: string, data: Api.Aiplatform.ContractActionCommand) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/${id}/advance`, method: 'post', data });
}

/** POST /aiplatform/contracts/{id}/fail——旁落「签署失败或过期」终态（仅自 2/3 可达）。回执＝终态现值（不消费）。 */
export function fetchFailAiplatformContract(id: string, data: Api.Aiplatform.ContractActionCommand) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/${id}/fail`, method: 'post', data });
}

/** POST /aiplatform/contracts/{id}/withdraw——撤回（自任何非终态；此后换新号重建）。回执＝终态现值（不消费）。 */
export function fetchWithdrawAiplatformContract(id: string, data: Api.Aiplatform.ContractActionCommand) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/${id}/withdraw`, method: 'post', data });
}

/** POST /aiplatform/contracts/{id}/void——作废（守卫与去向同撤回，留痕 action 分立可审计）。回执＝终态现值（不消费）。 */
export function fetchVoidAiplatformContract(id: string, data: Api.Aiplatform.ContractActionCommand) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/${id}/void`, method: 'post', data });
}

/** POST /aiplatform/contracts/{id}/sign——落一方签署位（party 1=甲方 2=乙方；不自动迁移状态；已落签幂等拒 409 ORD_028）。回执＝签署位落定后现值（不消费）。 */
export function fetchSignAiplatformContract(id: string, data: Api.Aiplatform.ContractSignCommand) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/${id}/sign`, method: 'post', data });
}

/** POST /aiplatform/contracts/{id}/record——草稿重录五肢整组（仅草稿态 1/2；version+1、needsUpdate 清零、冻结集重取现值）。回执＝重录后现值（不消费）。 */
export function fetchRecordAiplatformContract(id: string, data: Api.Aiplatform.ContractRecordCommand) {
  return request<Api.Aiplatform.Contract>({ url: `/aiplatform/contracts/${id}/record`, method: 'post', data });
}

/* ---- 模型供应商域（#88 B 批 T1，通道 6 端点＋档位入库 1 跨域写口）：providerKey＝协议路由
 * 前缀路径段寻址（无 id）；清单无分页全量直灌（技能页先例）。apiKey 全链只写不读明文（铁律）
 * ——读面/留痕一律掩码（尾 4 位，null＝未配置），写面唯一明文口＝创建/更新表单。单行 GET 与
 * 清单行同形（清单即全量）故不另设调用面；换 key/baseUrl 即时生效不重启（模型实例缓存键含
 * 通道指纹）。写回执＝通道行（apiKeyMasked，不消费：toast＋刷新）；DELETE 回 data=null。---- */

/** GET /aiplatform/model-providers——通道清单（无分页全量、按键序；apiKey 只出掩码形）。 */
export function fetchGetAiplatformModelProviderList() {
  return request<Api.Aiplatform.ModelProvider[]>({ url: '/aiplatform/model-providers', method: 'get' });
}

/** POST /aiplatform/model-providers——创建通道（apiKey 收全量值＝写面唯一明文口；null/空白＝暂不配置）。键撞 409 PRJ_067、baseUrl 缺 400 PRJ_069。回执＝新通道行（掩码形，不消费）。 */
export function fetchCreateAiplatformModelProvider(data: Api.Aiplatform.ModelProviderCreateCommand) {
  return request<Api.Aiplatform.ModelProvider>({ url: '/aiplatform/model-providers', method: 'post', data });
}

/** PUT /aiplatform/model-providers/{providerKey}——通道更新（baseUrl 终态替换；apiKey/enabled 缺省＝保持现值——留空＝保持的表单语义对应命令体 null）。回执＝更新后行（不消费）。 */
export function fetchUpdateAiplatformModelProvider(providerKey: string, data: Api.Aiplatform.ModelProviderUpdateCommand) {
  return request<Api.Aiplatform.ModelProvider>({ url: `/aiplatform/model-providers/${providerKey}`, method: 'put', data });
}

/** DELETE /aiplatform/model-providers/{providerKey}——删除通道（仍被档位引用 409 PRJ_072 透传；删成落删除痕、留痕跨行存活）。回执 data＝null（信封即回执）。 */
export function fetchDeleteAiplatformModelProvider(providerKey: string) {
  return request<null>({ url: `/aiplatform/model-providers/${providerKey}`, method: 'delete' });
}

/** POST /aiplatform/model-providers/{providerKey}/remote-models——远端模型清单手动拉取（每次全量真拉无缓存；对照库内档位：trackedTierKeys 空＝建议入库、staleTiers＝已过时）。上游不可用 502 PRJ_077 明确报错不静默；key 空 400 PRJ_076。 */
export function fetchPullAiplatformRemoteModels(providerKey: string) {
  return request<Api.Aiplatform.RemoteModelCatalog>({
    url: `/aiplatform/model-providers/${providerKey}/remote-models`,
    method: 'post'
  });
}

/** GET /aiplatform/model-providers/{providerKey}/traces——通道变更留痕（operatedAt 倒序＝最近先；apiKey 快照恒掩码；append-only 跨行存活）。 */
export function fetchGetAiplatformModelProviderTraces(providerKey: string) {
  return request<Api.Aiplatform.ModelProviderTrace[]>({ url: `/aiplatform/model-providers/${providerKey}/traces`, method: 'get' });
}

/** POST /aiplatform/model-tiers——档位创建（对照 drawer 内嵌入库复用此写口：providerKey＝本通道、modelName＝所选条目 modelId；hasAuth model-tier:create 跨域码）。撞名 409 PRJ_068、通道不存在 400 PRJ_071。回执＝档位行（不消费：toast＋本地对照态更新）。 */
export function fetchCreateAiplatformModelTier(data: Api.Aiplatform.ModelTierCreateCommand) {
  return request<Api.Aiplatform.ModelTier>({ url: '/aiplatform/model-tiers', method: 'post', data });
}
