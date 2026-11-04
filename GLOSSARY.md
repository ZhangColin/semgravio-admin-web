# GLOSSARY.md — semgravio-admin-web（语义引力）

统一后台前端（admin-web）：企业内部运营聚合入口的 SPA。对前端而言，`semgravio-admin` 后端就是它的 BFF——前端**只调** admin 后端，**禁止**直连各能力域。

> 平台级 ubiquitous language 与架构决策在兄弟仓库 `../semgravio-architecture/CONTEXT.md` 与 `docs/architecture.md`（§5.3 平台自带应用、§6.15 财务上下文）。本文件只记 admin-web 视角的对接契约与本仓库自己的决策。

> **实现栈（2026-07-31，Soybean 重写后）**：Soybean Admin v2.2 — Vue3 + Vite8 + NaiveUI + Pinia3 + UnoCSS + `@elegant-router`。早期 Next.js/React 版与中途探索的 Ant Design Pro v6 路线**均废弃**（旧 spec #1、map #6 已关闭 superseded；Soybean 脚手架见 #9）。下文凡 Next.js 专项（middleware 守卫 / cookie 镜像 / `useCan`·`<HasPermission>` React hooks / `next.config` 反代）**作废**，以 Soybean 视角决策为准。

---

## 参考资源（开发参考，务必遵守）

做功能时**只**参考以下来源，**禁止随意 web 搜索**（Soybean 迭代快，搜到的内容可能与我们的版本完全不匹配）：

| 来源 | 地址 | 用途 |
|------|------|------|
| Soybean 官方文档 | https://docs.soybeanjs.cn/zh/guide/intro | 框架用法（路由/请求/权限/主题/国际化） |
| Soybean 源码 + example 分支 | https://github.com/soybeanjs/soybean-admin | 源码与完整 demo（`example` 分支 = 预览地址内容；本地已配 `soybean` remote，v2.2.0）。⚠️ **`example` 是 Soybean 上游分支、非本项目分支——只读引用**（`git show soybean/example:<path>` 抄具体页面/用法），**绝不 `merge` 进本项目** |
| Naive UI 中文官网 | https://www.naiveui.com/zh-CN/os-theme | 组件库文档与组件 API（DataTable/Form/Modal/Tree 等，v2.44.1） |
| Pro Naive UI 中文官网 | https://naive-ui.pro-components.cn/zh-CN/os-theme | 基于 Naive UI 的中后台二次封装组件（ProTable 等，v3.2.3，**非官方**） |

**可读性（2026-07-31 已核）**：4 站点首页/文档页 webReader MCP 可读；Naive UI 两个站点的**组件文档页是客户端渲染 SPA，静态抓取只拿到外壳**——用真浏览器（Chrome MCP，需 ≥30s 超时）能完整渲染（实测 data-table 组件页 27KB 正文含 props/示例）。WebFetch 被本环境网络策略拦截，改用 webReader MCP 或 Chrome MCP。

**与 upstream `main` 保持可升级（重要约束）**：Soybean 更新快，做功能时**最小化对框架文件的分叉改动**——优先在 `src/views`、`src/service/api`、`src/store/modules`、`src/typings` 等业务层扩展，**避免大改 `@sa/*` 内部包与 `src/router/elegant/*` 生成产物**；需要时从 `soybean/main` 同步更新。目标：我们做完功能后仍能平滑跟 main。

---

## Glossary（术语表）

| 术语 | 定义 |
|------|------|
| **admin-web** | 统一后台前端，Soybean（Vue3）SPA，应用层·平台自带应用的一半 |
| **admin 后端 (`semgravio-admin`)** | 统一后台后端，运行在 `localhost:8081`；对前端即 BFF |
| **Operator（运营用户）** | 后台使用者；认证 + 角色/部门/岗位/RBAC 归 admin 自有，不在用户域/IdP，本地登录（非 SSO） |
| **BFF 边界** | 前端 → 只调 admin 后端（经前端反代 `/api/*`，dev 走 Vite proxy）；admin 后端 → 经 `cartisan-openapi` 签名调各能力域 |
| **Sa-Token** | admin 后端的鉴权机制；token 是 UUID 字符串，走 `Authorization: Bearer <uuid>` header（**不是** JWT、**不走** cookie） |
| **统一响应 (`ApiResponse<T>`)** | 后端所有接口返回 `{ code, message, data, requestId, errors }`；`code` = HTTP 状态码本身（200/400/401/403…），**非**业务码。**例外（aiplatform 透传域）**：忠实透传 provider 时，错误信封 `code` = provider 数字业务码（域码×1000＋序号，如 IDN_004→6004）、HTTP 状态独立照抄 |
| **分页 (`PageResponse<T>`)** | `{ items, total, page, size }`；**全链 1-based**（请求与响应 `page` 均 1-based、首页=1、无 ±1——admin ADR-0012 / #73 收口）。旧「请求 0-based」条目作废 |
| **权限三件套** | `AdminUser` / `AdminRole` / `AdminMenu` + 关联表；前端拿到 `roleCodes[]` / `permissions[]` / `menus[]` 做指令级控制 |
| **permissions / roleCodes** | 登录时 `/auth/current` 拉取的权限码数组（如 `admin:user:read`）与角色编码数组（如 `SUPER_ADMIN`）；超管靠后端 bypass 放行 |
| **财务上下文** | admin 内的只读限界上下文（非独立域）；从各能力域只读取数做收入确认/冲销——**后端尚未实现** |
| **应用 (`App`)** | 平台接入的应用（第三方或自有）；admin 后端 `/apps` 管理。每个应用可附带可选的 ApiKey（API 鉴权）与 SsoClient（OIDC 接入），各自独立状态 |
| **SsoClient** | 应用的 OIDC 客户端记录。四要素互相独立：身份（`clientId`，终身稳定）、密钥（`clientSecret`，仅一次性明文可见）、配置（`redirectUris`/`postLogoutRedirectUris`/`scopes`/`grants`）、状态（启用/禁用） |
| **开通 (Provision)** | 首次创建某应用的 SsoClient——生成终身稳定的 `clientId` 与第一份 `clientSecret`（凭证端点的首次调用，无 body） |
| **重置密钥 (Rotate secret)** | 凭证端点的后续调用；轮换 `clientSecret`，`clientId` 不变；旧密钥立即失效。与「开通」共用同一端点，区别仅在是否首次 |
| **配置 (SsoClient Configuration)** | SsoClient 可变的 URI/权限/授权类型集合，整份替换；与凭证、状态三者互相独立。`redirectUris` 与 `postLogoutRedirectUris` 均必填非空 |
| **启停用 (SsoClient Lifecycle)** | SsoClient 的启用/禁用切换，与所属应用的启停用相互独立 |
| **postLogoutRedirectUris** | OIDC RP-Initiated Logout 的登出回跳白名单，与 `redirectUris` 平级、必填非空 |
| **支付管理上下文 (payment admin BFF)** | admin 内新增的 `payment` 子包（≠ 财务上下文）；admin 作 BFF 调 payment、对前端暴露 `/api/admin/payment/**`。运营写操作 + 运营看板，不持业务逻辑/不记业务审计 |
| **支付订单 (PaymentOrder)** | 业务系统发起的一笔支付，以 `paymentOrderNo` 标识。admin 只读 + 通知重发，**不**创建/取消/预下单（业务系统职责） |
| **退款订单 (RefundOrder)** | 针对某支付订单的退款，以 `refundOrderNo` 标识。admin 可**审核**（approve/reject），**不**创建 |
| **通道交互日志 (PaymentLog)** | payment 与银行/通道网关的**机机**交互留痕（logType / bankInterface / returnCode / success）。_Avoid_: 操作记录 |
| **订单操作记录 (OperationLog)** | 行为者（人/系统）**对订单**的操作留痕；操作审计的**权威源**，admin 不本地记账。_Avoid_: 通道日志 |
| **退款审核 (audit)** | 对退款 approve/reject 的**决议**（写操作，落 `auditType=MANUAL`/`auditorId`）。_Avoid_: 审计日志（= OperationLog）、审计字段（已废 REQ-12）——三者不同 |
| **通知重发 (notification resend)** | 补发支付/退款结果通知给业务系统，**不改订单状态**（仅补投递） |
| **主动查行 (bank query)** | 触发 payment 向银行查真相并同步本地状态；条件性暴露（payment 提供端点则做，admin#46 / T9） |
| **订单生命周期 (lifecycle)** | 按时间合并某单的 PaymentLog + OperationLog 的端到端追溯视图；详情抽屉内一个 tab，不种菜单 |
| **Account（终端用户账号）** | 平台终端用户的账号，归 identity 域，以 `userId`(TSID) 标识，email/phone 均可空。与 **Operator（运营用户）** 对举：「账号管理」管 Account，**不**管 Operator（后台员工走系统管理>用户管理）。_Avoid_: 把两者混称「用户」 |
| **封号 / 解封 (disable / activate)** | 管理员对 Account 的手动停用与恢复（status: ACTIVE↔DISABLED），带 reason（封号必填 ≤500）。封号时 identity 自动踢全部会话；解封**不**恢复会话（用户须重新登录） |
| **系统锁定 (locked)** | 登录失败累计等触发的**自动**锁，布尔字段、独立于封号轴（临时锁 vs 永久停用语义不同）。解除走 unlock：只把 locked 置 false，不改 status、不动会话 |
| **强制下线 (revoke sessions)** | 一键撤销某 Account 全部会话——只踢人，不改状态、不动锁。无会话列表视图，仅此一个按钮 |
| **AI 平台（aiplatform）** | 平台自带的应用域；运营在统一后台监管其交易与交付。admin 作 BFF **忠实透传** provider `/api/backoffice/**` 契约（零加戏），前端只调 admin `/api/admin/aiplatform/**`（六域页面 + 账号档案嵌件 34 端点 + 技能线 20 端点 + 设计线 1 端点（design-package，#74）已消费——技能/指派/配置 15＋草稿 4（#71）＋预检 1（#72）；swagger 共 55 全触达） |
| **AI 订单 (Order)** | aiplatform 的一笔交易，以 `id` 标识；含 append-only 报价史 `priceEntries` 与生命周期（quote→pay→archive / cancel）。_Avoid_: 支付管理域的「支付订单 PaymentOrder」——不同域、不同单号体系 |
| **交付物类型 (deliverable type)** | AI 订单下单时冻结的交付物分型（1=设计 2=系统 3=系统＋设计）；冻结自项目终点类型，此后不随项目变更。待报价单类型已定（区别于金额的待报价 NULL）。_Avoid_: 与项目当前类型混同——订单只看冻结值 |
| **设计资产包 (design package)** | 设计／系统＋设计单的下单冻结交付件（tar.gz）：选定稿自包含形态＋DESIGN.md＋帧衍生资产，落选稿不入；系统＋设计单＝统一部件容器（含系统部件）。按单定格，此后改稿/再定稿不漂移。_Avoid_: 与「源码包」混称——源码包是项目工作区实时打包，冻结/实时两轴 |
| **AI 项目 (Project)** | aiplatform 的交付单元；带订单引用（active/latestOrder）、成本指针（costSummary）、工作区引用（workspaceId）；归档项目照读 |
| **会话来源 (session source)** | AI 项目对话条目的会话流归属：2=设计会话（每设计物一条独立会话流）、null=主会话缺省。降级口径：作用域改稿发言不标注——null 勿当未知值补归属（缺省≠未知） |
| **沙箱 / 工作区 (Workspace)** | **菜单词用「沙箱」**（`沙箱管理`），**领域实体用「工作区」**（`workspaceId`/`Workspace`）；期望态 `desiredState` 与实态 `containerState` 可漂移（清单按两者过滤找 desired≠actual） |
| **成本 (Cost)** | aiplatform 平台 token 成本观测（与订单报价脱钩、改价不溯及）；时间窗必填（`[from,to)` 半开）、五档用量（input/output/cacheRead/cacheWrite/reasoning）+ 按币种/按模型/按智能体分解 + unpriced 未配价警示 |
| **单价表 / 价目行 (Unit price entry)** | **菜单词「单价表」**，**领域实体「价目行」**（`price-entry`）；成本换算用的单价数据，append-only（改价 = 关当前行 + 开新行，可预发布未来生效） |
| **按张计价 (per-image tier)** | 价目行 tokenKind 第 6 档（张与 token 并列不混算）：成本桶按张×时点单价混算（响应无从区分按张分量）、五档分解不含按张、张数仅经 unpriced 档位（tokens=张数）与桶金额呈现；无生效单价进 unpriced 不伪装 0。UI 若需「图片生成」独立呈现 → UI→BFF→provider 单向提新 issue，前端不拆算按张分量 |
| **知识素材 (Material)** | aiplatform 沉淀的知识资产；停用⇄启用可逆、删除为治理移除（不动来源项目） |
| **账号档案 (Account profile)** | aiplatform 侧极简账号档案（`id/externalId/displayName/createdAt`），嵌订单/项目详情抽屉按 `externalId` 查。_Avoid_: identity 域的「Account（终端用户账号）」——不同域 |
| **技能 (Skill)** | aiplatform 智能体可装配的能力单元，来源三分同权（内置 1 / 安装 2 / 自产 3——经草稿晋升入库，package/version 为虚拟值 self）；寻址柄为 opaque 双形制字符串（`builtin:技能名` 前缀 / TSID 十进制串）。停用⇄启用可逆；卸载为移除（内置不可卸、有指派在身先解绑） |
| **职能槽位 (slot)** | 技能**指派**的维度，三槽：main=主智能体 / executor=run 执行体 / subagent=子智能体。_Avoid_: 与「智能体配置座」混称——指派三槽、配置三座（main/executor/designer） |
| **预检 (precheck)** | 指派提交前的**非阻断**方法论重叠判定（对照双头＝该槽生效工作协议 ∪ 该槽已指派启用技能 ∪ 候选集内其他技能；模型判定 15s 档、可降级不重试）。回执三态：重叠提示／确认无重叠／**未执行**——红线：未执行不得伪装成「无重叠」。_Avoid_: 当作提交门——提示是输入不是门 |
| **来源包 (sourcePackage)** | 安装技能的 git 仓库标识；显式更新与更新留痕按**来源包**聚合（非按单个技能） |
| **快照安装 (install)** | 从 git 仓库 HEAD 快照固化入库（版本=装时 commit；排除目录段不入库）。_Avoid_: 联想 ref/tag 选择——契约无此面 |
| **技能草稿 (skill draft)** | 自产线会话自荐产生的待审候选；在途/终态两态，终态（已晋升/已拒绝）不列活跃审核面、按 id 留档可查。_Avoid_: 与「技能」混称——草稿未入库、不可指派 |
| **晋升 (promote)** | 人审通过草稿入库成正式技能（撞名复查＋入池＋两处留痕，不可逆、不自动指派）。_Avoid_: 「安装」——安装是 git 快照通道，来源不同 |
| **扫描判定 (scan verdict)** | 草稿自动扫描的风险初筛（SAFE 安全 / CAUTION 注意；DANGEROUS 写入口拒收不落库）——廉价哨兵非安全边界，SAFE 不豁免人审通读 |
| **血统 (lineage)** | 草稿来源追溯三件：来源项目 / run / 职能槽位——审核「真伪/血统可溯」判读的回溯锚点 |
| **智能体配置座 (agent config)** | 可编辑配置的智能体，三座（main/executor/designer）：systemPrompt / 主模型档位 / 路由强档 / 两增强工具开关；覆盖态与默认分治（覆盖标记+默认预览），清空覆盖即回落默认。回滚＝旧值快照写回（一次新变更、留新痕） |
| **增强工具 (enhancement tool)** | 平台级增强能力两件：web_search（联网搜索）/ fetch_url（网页抓取）——工具面唯一可开关的 kind；骨架/内建工具恒开 |
| **更新留痕 (update trace)** | 按来源包 append-only 的版本变迁记录（from→to + 操作者），倒序、卸载不删痕 |
| **合同 (Contract)** | aiplatform 交易的人工承接件，六态机：1=准备中→2=待核对与签署→3=签署进行中→4=签署完成（末边须双方均签）；旁落 5=签署失败或过期（自 2/3 可达）；旁支终态 6=已撤回或作废（守卫去向同撤回、留痕 action 分立可审计）。撤回/作废后重建＝新号新合同、旧合同终态保留。needsUpdate＝改价/改范围后草稿合同的「需重录」派生标志（record 重录即清零）。_Avoid_: 把撤回/作废当同义——守卫同但留痕分立 |
| **付款核验 (payment verification)** | 嵌订单详情的线下转账到账核验面：节点五态（1=待支付 2=支付处理中 3=支付失败或关闭 4=线下转账待核验 5=已到账）；附言码＝`合同号-K序`；开工门节点；全额判定归 provider（累计核到账≥节点额自动转已到账、不足留痕回待支付）；节点录入整组替换且支付活动未开始是唯一重录窗口 |
| **生产承接 (production handoff)** | 嵌项目详情的两态承接面（1=待安排生产→2=生产中，生产中是稳态、无终态概念）；开工判定系统建档（operatorId=system）非管理员创建；信息整组替换（未录入段传 null 即清空）；需用户补充＝前台交付六态盖帽置位/清零 |
| **模型供应商 / 通道 (provider channel)** | **菜单词「模型供应商」**，**领域实体「通道」**（providerKey＝协议路由前缀如 volcengine/deepseek）；apiKey 掩码尾 4 位、只写不读明文（换 key 表单留空＝保持现值）；换 key/baseUrl 不重启、下轮命令构建即生效。_Avoid_: 「渠道」——与支付域 paymentChannel 混淆 |
| **模型档位 (tier)** | 语义键层（tierKey 如 flash/pro/doubao-flagship）＝智能体配置绑定引用的寻址键；升模型版本/换供应商＝改档位行指向、全部绑定自动跟上；停用＝不可作新绑定（写口 400 拦）但既有引用保留（临时下线用停用不用删除）；enabled=true 键集即配置下拉放行值域 |
| **边缘调用点 (edge point)** | 一次性轻调用的四个点位（naming=项目取名/compaction=上下文压缩/classification=入口分类/precheck=技能预检），值面仅模型档位一件（提示词是编排内建，不属运营配置）。_Avoid_: 与「智能体配置座」混称——座三把（main/executor/designer）全值面、边缘点四把仅档位 |

---

## 后端契约快照（事实，对接基线）

后端 `semgravio-admin`（Spring Boot 3.4 / Java 21 / Sa-Token / PostgreSQL+Redis），`localhost:8081`，default profile `local`。

### 鉴权
- Sa-Token：`token-name: Authorization`，`token-prefix: Bearer`，`token-style: uuid`。
- timeout：rememberMe=false → 24h；rememberMe=true → 7d。无 refresh-token。
- 放行路径：`/api/admin/auth/login`、`/api/admin/auth/captcha`(占位未实现)、`/error`、`/actuator/**`、`/swagger-ui/**`、`/api-docs/**`；其余 `/api/admin/**` 全鉴权。
- 超管 `SUPER_ADMIN` 角色自动 bypass 权限检查（仍需登录）。
- CORS：**仅**放行 `http://localhost:3001` 与 `http://127.0.0.1:3001`（`WebConfig.java:33-34`）。

### 接口清单（共 25 个，前缀 `/api/admin`）

| 域 | 方法 | 路径 | 返回 data | 权限码 |
|----|------|------|-----------|--------|
| 认证 | POST | `/auth/login` | `TokenInfo{token,loginId,expireTime}` | 公开 |
| 认证 | POST | `/auth/logout` | Void | 登录即可 |
| 认证 | GET | `/auth/current` | `CurrentUserResponse{user,roleCodes,menus,permissions}` | 登录即可 |
| 认证 | PUT | `/auth/current/password` | Void | 登录即可 |
| 菜单 | GET | `/menus` | `MenuResponse[]`(树) | `admin:menu:read` |
| 菜单 | GET/POST/PUT/DELETE | `/menus[{id}]` | — | `admin:menu:read`/`:write` |
| 角色 | GET | `/roles` | `PageResponse<RoleResponse>` | `admin:role:read` |
| 角色 | GET/POST/PUT/DELETE | `/roles[{id}]` | — | `admin:role:read`/`:write` |
| 角色 | PUT | `/roles/{id}/menus` | Void | `admin:role:write` |
| 角色 | PUT | `/roles/{id}/permissions` | Void | `admin:role:write` |
| 用户 | GET | `/users` | `PageResponse<AdminUserResponse>` | `admin:user:read` |
| 用户 | GET/POST/PUT/DELETE | `/users[{id}]` | — | `admin:user:read`/`:write` |
| 用户 | PUT | `/users/{id}/status` (`?status=1\|0`) | Void | `admin:user:write` |
| 用户 | PUT | `/users/{id}/roles` | Void | `admin:user:write` |
| 用户 | PUT | `/users/{id}/password` | Void | `admin:user:write` |
| 权限 | GET | `/permissions` (`?scope=admin`) | `PermissionResponse[]` | `admin:permission:read` |

### 关键 DTO
- **`AdminUserResponse`**: `id(Long) username nickname email phone avatar status(Integer 1=激活/0=禁用) statusName breakGlass createdAt updatedAt`
- **`MenuResponse`**(树): `id name path icon parentId sortOrder children[]` — ⚠️ **无 `type` 字段**，前端无法直接区分菜单/分组/分隔线
- **`RoleResponse`**: `id name code description sortOrder menuIds(Set) permissionCodes(Set)`
- **`PermissionResponse`**: `code name`
- 登录体 `AdminUserLoginCommand`: `{ username, password, rememberMe }`；内置超管 `admin / A1@truth`(id=1, 破窗号——V2 种子注释正本；2026-11-04 联调实测 `Hcy@2026` 旧口径已失效)

### ⚠️ 后端**尚未提供**的接口
部门(department)、岗位(position)、财务(finance)、Dashboard 聚合数据、`/auth/captcha`（在放行名单但无实现）。

---

## 不变式（继承自架构，务必遵守）

1. 前端不直接调各能力域——经 admin 后端 BFF 聚合。
2. 权限控制用登录已拉取的 `permissions`/`roleCodes`（Soybean：`useAuth().hasAuth(code)` + `v-if`），不在 UI 硬编码角色判断。
3. 鉴权链路：`/auth/login` 取 token → `/auth/current` 取 `{user,roleCodes,permissions,menus}` → 映射进 auth store（见下「UserInfo 映射」）；路由守卫在 `router.beforeEach`（`src/router/guard/route.ts`）。业务页重写。
4. 新页（部门/岗位/财务）跟 admin 后端新增同步。

---

## 本仓库决策（Decisions）

> 通过 `/grill-with-docs` 逐条结晶。已定稿的迁移至 `docs/adr/`。

### 2026-11-04 生产部署形态：SPA 静态容器 + 同源 BFF 反代（#94）

admin-web 具备可部署生产形态。**只写部署物 + 静态契约检查，不构建镜像/不起栈/不连真实服务器**。

- **生产基础地址 = 同源 `/api/admin`**（`.env.prod`，不再指 Apifox mock）；dev `.env.test` 不变。前端构建期把相对 baseURL 打进产物，运行时由容器内 nginx 反代——前端代码零改动。
- **多阶段镜像** = `deploy/web.Dockerfile`：`deps`（pnpm@10 workspace 全量依赖，`--frozen-lockfile`，需拷 `packages/*/package.json` 参与解析）→ `builder`（`pnpm build` = `vite build --mode prod`）→ `runner`（`nginx:1.27-alpine`，只拷 `dist` + 配置模板 + 启动注入脚本）。旧根 Dockerfile 是 Next.js 模板残留（`.next`/`server.js`），整体作废。
- **启动注入 `BACKEND_URL`**（`deploy/docker-entrypoint.d/30-backend-url.sh`，挂 nginx 官方 `/docker-entrypoint.d/`）：**源站口径**（`http(s)://主机[:端口]`，如 `http://semgravio-admin:8081`），**不含 `/api/admin`**（前缀由 nginx 保留转发，再带会拼成双前缀 404）。空值/占位值/带路径值**响亮失败**（exit 1，容器起不来）。替换用 `sed` 定点替换 `__BACKEND_URL__` 占位符——**不走 envsubst 全量模板机制**（会消费 `$uri` 等 nginx 自身变量）；模板因此放在官方 envsubst 扫描目录 `/etc/nginx/templates/` **之外**（`/etc/nginx/admin-web/`），官方 `20-envsubst-on-templates.sh` 不会先碰它。裸 `/api/admin`（无尾斜杠）精确匹配 404，不被 SPA 回退吞成 index.html。
- **URI 保真 + Docker DNS 重解析**：`proxy_pass $backend_upstream;`（变量、**不带 URI 部分**）→ 原样转发完整原始 URI；配 `resolver 127.0.0.11`（Docker 内嵌 DNS）→ 上游容器重建后自动重解析。
- **SPA 回退**：`location /` `try_files $uri $uri/ /index.html`；`location /assets/`（vite 哈希产物）`try_files $uri =404` + 长缓存——缺失资源不被吞成 200 的 index.html。
- **compose.prod** = `deploy/web.compose.yml`：显式 `name:`/`image:`/`container_name: semgravio-admin-web`，`BACKEND_URL` 经 `env_file: ../.env.production` 注入（路径相对 compose 文件解析；`--env-file` CLI 相对项目目录解析、compose 移入 deploy/ 后会落空，故弃用），只接 external `webnet`，**无宿主端口映射**（对外由基础设施层反代），healthcheck `wget :80`。
- **服务器 env 模板** = `deploy/env.web.example`（scp/cp 成应用根 `.env.production`，compose `env_file` 引用；只含非秘密拓扑变量）。`.dockerignore` 排 `dist`/`e2e`/`.env*`，**但 `!.env`/`!.env.prod` 必须放行**——vite `--mode prod` 构建期加载它们（`.env` 的 `VITE_BASE_URL` 等 + `.env.prod` 的 `/api/admin`），排除掉会让镜像产物 baseURL 为空（#94 review 抓出的真 bug）。`.gitattributes` 补 `*.sh`/`Dockerfile`/`*.template` `eol=lf`（CRLF 会炸容器内 `/bin/sh` 与 nginx 配置）。
- **静态契约检查** = `deploy/validate.sh`（`bash deploy/validate.sh`，只读仓库文件）：A 基础地址 / B 多阶段镜像 / C compose 编排 / D nginx 回退与代理 / E 注入脚本守卫 / F env 模板 / G 全部 shell `bash -n`。后续改部署物跑它回归。

### 2026-11-04 一键 HTTPS 发布链路（#95，承接 #94 部署物）

admin-web 发布链路齐备。**本票只写脚本/配置/文档 + 静态验证，未上传、未构建、未起栈、未装 nginx 配置**；首次真实发布等用户确认（`BACKEND_URL` 真实值亦待用户提供）。

- **一键发布 = `deploy/release.sh`**（重写 legacy 明文密码脚本，旧脚本随旧 Next 形态整体作废）：阶段 `== 0..5/6 ==` 任败即非零退出——本地密钥 → SSH 连通 → **远端前置**（semgravio-nginx 健康 / webnet / `~/semgravio-admin-web/.env.production` 的 BACKEND_URL 源站口径 / `deploy/certs/admin.semgravio.com_bundle.pem`+`admin.semgravio.com.key` / 门禁脚本在场；**在上传与构建之前**，缺项零改动）→ 打包 → scp → 远端解包 → `compose up -d --build` → 门禁安装 → 就绪等待 → 冒烟。
- **打包 = `deploy/build-bundle.sh`**：同 aiplatform 模式——`git archive HEAD`（恒 LF、跨 Windows Git Bash）、`REVISION` 记录 HEAD、脏工作区默认拒绝（`ALLOW_DIRTY=1` 逃生＋醒目警告）、秘密值排除断言（`.env.production`/`certs/`/`*.pem` 命中即中止）；产物 `dist/admin-web-deploy-<戳>.tar.gz`，末行打印包路径（`deploy/release.sh` 约定）。开发机零构建依赖——pnpm 安装与 vite build 都在服务器侧多阶段镜像里跑。
- **共享 nginx 接入 = `deploy/nginx/admin-web.conf`**：80 `return 301 https://$host$request_uri;`；443 TLS（证书引用门禁安装路径 `/etc/nginx/certs/admin-web/{admin.semgravio.com_bundle.pem,admin.semgravio.com.key}（沿用证书商原文件名，无需改名）`）；代理 `semgravio-admin-web:80` 变量形式 + `resolver 127.0.0.11 valid=5s`（infra nginx 1.30 支持同 http 块多 resolver，与 aiplatform.conf 各声明各的）；Host/X-Real-IP/X-Forwarded-For/X-Forwarded-Proto 全传递；不声明 default_server、server_name 单行（门禁契约）。安装唯一通道 = infra 门禁 `install-nginx-conf.sh admin-web <conf> <certs 目录>`（撞车即拒/语法门禁/失败回滚，conf.d 挂载热更）。**首个 TLS 接入服务**（aiplatform 只 listen 80）。
- **冒烟断言（如实报告实际码）**：HTTP `/` = 301 且 Location 指 https；HTTPS `/` = 200；未登录 `GET /api/admin/auth/current` = **401**（正向鉴权证据，其他值一律判失败）。
- **运维入口 = `deploy/server.sh`**（重写 legacy）：`status/logs web/restart/smoke/sh` 子命令（restart 不重建镜像；nginx 配置更新统一走发布门禁）。连接参数与 `deploy/release.sh` 同套默认（`ubuntu@3.70.172.160` + `semgravio-eu-1.pem`），`SERVER_HOST/SERVER_USER/SSH_KEY/REMOTE_DIR/INFRA_DIR` 可覆盖。
- **复用包发布** `SKIP_BUILD=1 deploy/release.sh`（取 `dist/` 最新包）；**解包不覆盖现网输入**（git archive 产物天然无 env/证书 + 解包后三项现网输入复核）。
- **部署文档 = `deploy/部署文档.md`**（中文）：角色与目录 / 服务器前置输入 / 一键发布 / 幂等与边界 / 运维 / 静态验证 / 换证书；明确区分「静态验证零副作用」与「真实发布须用户确认」。

### 2026-11-04 运维入口收口 + 中文部署手册（#96，承接 #95 链路）

#95 未提交产物随本票一并落地。**只写脚本/文档 + 静态验证，未执行任何真实服务器操作**。

- **冒烟断言单一事实源 = `deploy/smoke-remote.sh`**：301 跳转 / HTTPS 首页 200 / 未登录 `/api/admin/auth/current` 401 三项外部断言只维护一份——`deploy/server.sh smoke`（ssh `bash -s` 喂入）与 `deploy/release.sh` 阶段 5（解包后跑同文件）共用。判定面从「localhost + Host 头」改为 **真实 SNI**（`curl --resolve admin.semgravio.com:443:127.0.0.1`）——不再依赖「admin-web 是唯一 443 server 块」的隐式兜底（infra 日后加任何 443 块居先即静默炸 TLS 的隐患，#95 review 抓出）。
- **运维入口收口**：`deploy/server.sh` 未知子命令打印用法 + **exit 64**（原 exit 0）；`help`/无参仍 0。restart 语义不变（只重建容器运行状态、不重建镜像；nginx 配置/证书更新统一走 deploy/release.sh 门禁）。
- **#95 review 修复三处**：① deploy/release.sh 阶段标号 0..5/5（六阶段）→ **/6**；② 阶段 5 信息性 `docker ps | grep` 在 `set -e` 远端 heredoc 里 grep 无匹配会先于冒烟结论中断 → `|| true`；③ `.gitattributes` 补 `*.conf eol=lf`（`admin-web.conf` 裸漏，CRLF 会炸 nginx——#94 条目自己写明过的坑）。
- **中文手册重写**（`deploy/部署文档.md`）：前置条件（开发机零构建依赖/服务器 infra 已起栈/SSH 默认参数与覆盖）→ 一次性输入（BACKEND_URL 源站口径 + **URI 原样转发示例**、证书 `chmod 600` 权限保护）→ 发布（脏工作区门禁/SKIP_BUILD）→ **首次验收**（冒烟三项 + 深层 history 路由 curl 核验 + 浏览器登录人工步骤如实补记）→ 重复发布/换证书/运维子命令/常见失败排查表。明确：证书、私钥、服务器环境值、**部署包**均不得提交 Git；基础设施不由本仓部署；静态实施与真实发布边界。
- **静态验证扩 K 节**（#96）：冒烟脚本语法/SNI/三断言、两处共用同一脚本、`exit 64`、conf eol=lf + 无 CRLF、手册逐项覆盖（子命令/chmod 600/URI 示例/深层路由/部署包不入 Git/infra 边界/静真边界）。H 节冒烟断言改指共用脚本。`bash deploy/validate.sh` 全绿（A–K）。

### 2026-11-04 部署物收编 deploy/ 单目录（对齐 aiplatform 布局，用户拍板）

- **全部部署物归 `deploy/` 单目录**（同 aiplatform）：根 `Dockerfile`→`deploy/web.Dockerfile`、`docker-compose.prod.yml`→`deploy/web.compose.yml`、`docker-compose.dev.yml`→`deploy/web-dev.compose.yml`、`.env.production.example`→`deploy/env.web.example`、手册 `docs/deploy/`→`deploy/部署文档.md`。一键发布 `deploy/release.sh`＋运维 `deploy/server.sh` 收编原根 `publish.sh`/`deploy.sh`（项目模板残留，删除；入口名对齐 aiplatform）。
- **仓库根保留三件＝前端特殊性**（用户接受）：`.env`/`.env.prod`（Vite 约定构建配置必须居根）、`.dockerignore`（构建上下文＝仓库根——pnpm workspace 需全仓源码，aiplatform 的 web 只需子目录）。
- **证书沿用证书商原文件名**（用户拍板，不做改名约定）：`admin.semgravio.com_bundle.pem` / `admin.semgravio.com.key`；`.dockerignore` 补 `deploy/certs`（防私钥进 build context），`.gitignore` `certs/`/`*.pem` 拦截入仓。

### 2026-09-16 AI 平台六域页面 grilling（admin-web #56，消费 admin BFF aiplatform 34 端点；后端已就绪 admin#62/#63–73）

admin 仓 aiplatform BFF 已全量落地（`/api/admin/aiplatform/**` 34 端点，忠实透传 provider `/api/backoffice/**`），菜单 V15 已种、前端无页。本票 grill 拍板 UI 形态与联调口径，逐域按 matt 流程拆票实现（不分批）。

- **契约正本 = admin :8081 `/v3/api-docs`**（不读后端 Java 源码补契约，缺口提 issue）：34 端点与 issue 六域清单吻合（订单 6/项目 9/沙箱 6/成本 4/单价表 3/素材 5/账号 1）。
- **分页全链 1-based**（ADR-0012）：新页面原生 1-based、零 ±1；区别于旧 8 列表页 0-based（归 #55）。`defaultTransform` 响应侧已 1-based 透传，请求侧 1-based 直传。
- **页面形态照先例**（不再逐域 /prototype 三变体）：列表 `NDataTable`（flex-height + sm:h-full）+ `NDrawer` 720 + `.desc-table` 只读 + `NTabs` + 写按钮 `hasAuth` 门控；成本中心、项目文件区两处异质另拍（见下）。
- **错误信封**：aiplatform 透传域 `code`=数字业务码≠HTTP 状态（glossary 已加例外）。前端**不按业务码分支**——写失败走透传 `message` 统一 toast，文件内容拒读走「一态兜底」（统一「无法预览」+ 透传 message，不读 provider 码表）。
- **成本中心 = 单页 dashboard**（复用 payment/stats widget + echarts 范式）：时间窗 `NDatePicker` range 必填（`[from,to)` 半开）→ token 五档 5 stat tile → byModel/byAgentKind 两柱状 → unpriced 警示卡 → 项目成本表（分页、成本降序）+ 行点击 NDrawer 下钻。「按币种成本」暂缓（`cost:{}` 空对象 → REQ-20）。
- **项目文件区 = 项目详情抽屉内「交付文件」tab**：`NTree` 按 path 折叠（显 size）→ 点文本文件内嵌只读（`/files/content`）→ 顶部「下载文件包」（`/files/package` tar.gz）。机密/1MiB/非文本三类拒读**一态兜底**。
- **术语**：沙箱（菜单）/工作区（实体）、单价表（菜单）/价目行（实体）；glossary 补 8 条（AI 平台/订单/项目/沙箱·工作区/成本/单价表·价目行/素材/账号档案）。
- **i18n**：7 键 `route.aiplatform` + `_order/_project/_workspace/_cost/_price_entry/_material`，文案照 issue 菜单表，三处同步（Schema/zh/en），随各域 commit 落。
- **REQ-20（#75）**：`cost:{}`、conversation `question/closing/attachments:{}`、`unitPrice` string/number 不对称 → 已提 [admin#75](https://github.com/ZhangColin/semgravio-admin/issues/75)，前端先渲染已文档化字段绕行。**✅ 后端已落地（2026-09-23 合入 `1ed082f`——@Schema 自描述补齐 + 补 quote 肢）**：cost/对话四载荷消费见 T8（#64）、unitPrice 不对称消费见 T6（#62）。

**收域标准**（admin#61 冒烟四项，联调通过后 admin#61 方可关）：签名负例三连 / 域内全端点 happy path / 写操作留痕落库 / 分页与过滤边界。

### 2026-09-16 T1 交付：AI 平台脚手架 + 订单域 tracer bullet 点亮 ✅（#57，六域共用基座首次落仓）

mock E2E（headless Chrome + page.route，fixtures 派生自 `/v3/api-docs`）**31/31 两轮全绿**。验收六条全过：列表契约字段（金额 Long 分 string + statusName 直读）/ 四维筛选绑定（status 多选逗号单值 `status=1,5`、createdFrom/To、externalId、orderId）/ 抽屉价目史（append-only 新→旧带操作者）/ 三写（报价·改价、取消 reason 必填、重试归档）成功后回读+刷新 / 源码包 tar.gz 二进制流 / 写失败透传 message toast（409 + 数字业务码 5007）。

- **六域共用地基**（后续 T2–T6 照此扩展）：`Api.Aiplatform` 命名空间（`typings/api/aiplatform.d.ts`）+ `service/api/aiplatform.ts`（六端点）+ `constants/aiplatform.ts`（整数枚举手写 options）+ `route.aiplatform{,_order}` i18n 三处同步 + **首个入仓 E2E seam**（`e2e/`，playwright-core devDep + 系统 Chrome channel 免下载浏览器；T2–T6 按 `e2e/README.md` 三步扩展）。`pnpm gen-route` 产出 `aiplatform`（layout.base 目录）+ `aiplatform_order` 两级，与 V15 种子 `view.aiplatform_order` 精确对齐。
- **status 多选序列化**：service 层显式拼逗号单值（`status.join(',')`）——BFF 文档钉死逗号分隔（provider 签名按参数名去重，`status=1&status=2` 会被丢），不交给 axios 默认数组序列化。
- **状态门控**（provider OrderStatus 五态 + 聚合守卫印证）：未支付 1|2 = 报价/改价（同一端点，已报价=重复提交）+ 取消；已支付 3 = 重试归档；下载源码包无状态门控（404 ORD_001 / 500 WSP_002）。写按钮按态 + `hasAuth` 逐写码（`:quote`/`:cancel`/`:retry-archive`）双门控。
- **坑与定案（E2E 踩出，T2–T6 直接受益）**：① **NInputNumber v-model 仅 blur/Enter 提交**——弹窗内「输完即点确认」撞禁用态是真实 UX 死胡同，报价金额改 NInput 逐键绑定 + 确认时解析（payment 筛选条用 NInputNumber 是筛选场景可容忍，表单弹窗不用）；② **NModal preset dialog 成功失败都自动关**——写失败要留弹窗需 handler 返回 `false`；③ **NDrawer 默认 modal 遮罩挡背景交互**——E2E 里行级操作必须先 Escape 关抽屉；④ toast 断言用轮询采样（`waitForMessage`，~3s 生命周期，单点 `isVisible`/`waitFor` 易错过闪现）；⑤ Naive datetimerange 键盘输入 = `fill`+`Tab`（Enter 不吃）；⑥ 侧栏菜单 DOM 是 `role=treeitem`（非 `.n-menu` 类），断言等其异步渲染；⑦ 抽屉内价目史用 NDataTable（宅标准），plain NTable 在抽屉内渲染异常（空 tbody，未深究）。
- **金额线型复核**：aiplatform `amount` swagger 文档化为 `integer/int64`，与 payment 同型——线上仍是 JSON **string**（框架全局 Long→ToStringSerializer，swagger 只标声明类型）；typings 按 `string`（分）+ `formatMoney` 渲染，quote 入参 `number`（Jackson Long 兼容）。
- **code-review 修正（双轴 review，紧随本票）**：① 删 `orderStatusRecord` 死代码（aiplatform 链路有 `statusName`，record 恒 account 域范式，零引用）+ 死 i18n 键 `confirm.cancel`；② 重试归档收编父页单点（抽屉改 emit `retry`，与 quote/cancel 同先例——此前 index/drawer 双份内联）；③ 「操作」下拉触发器按行隐藏（终态/无写权限行不再出空下拉，account「互斥/不可达不出现」）；④ 列表补 projectId 列（AC 字面九字段齐）；⑤ 下载文件名改读服务端 `Content-Disposition`（端侧拼名降级为兜底）；⑥ `handleWriteSuccess` 注释勘误（modal 遮罩下「开着即同目标」恒成立，非防御性检查遗漏）。review 判断项不修的记录在案：`tsToIso` 第 6 份拷贝（先例容忍）、`installOrderMocks` 名随 T2–T6 泛化时再改。

### 2026-09-16 T2 交付：项目域点亮 ✅（#58，六域之二——列表 + 详情抽屉四 tab）

mock E2E（order 31/31 回归绿 + project **51/51 两轮全绿**）。验收五条全过：列表契约字段（id/name/ownerDisplayName/type·typeName/status·statusName/archived/createdAt/updatedAt，归档照读）/ 四维筛选（**status 三档单选单值直传** `status=1|3`——与订单多选逗号串有意不同、createdFrom/To、externalId、projectId 精确）/ 抽屉四 tab（基本信息含 activeOrder·latestOrder 双档订单引用 + costSummary 指针只读 unpriced（cost:{} REQ-20 暂缓）+ workspaceId 引用；对话史 text/kind·kindName/answered/at 且 question/closing/attachments 载荷跳过（REQ-20 #75，sentinel 断言钉死）；PRD 全文；版本列表新→旧 + 版本详情锚定收尾卡，closing 泛型键值渲染 + null 兜底）/ E2E 覆盖全链路含 PRD 未产出 4015 透传 toast。

- **项目状态两档**（provider ProjectStatus 印证 + api-docs 描述「1=进行中, 3=已归档」，码位 2 注销不复用）：筛选三档 = 全部（缺省不传）/进行中（1)/已归档（3)——「全部」radio 值 'all' 哨兵字符串（NRadio value 不收 null，整数枚举手写 options 先例）。
- **对话史六 kind**（1=user 2=agent 3=question 4=answer 5=closing 6=guide）：text 对 question/closing 条目恒 null（载荷在跳过对象里）→ 正文 '-' 占位照订单域 null 先例；answered 仅 kind=3 有语义（false=挂起待答）→ 已答/待答双态 tag。
- **版本详情 closing** = `Map<String,Object>`（api-docs 唯一文档化形状）→ 泛型键值渲染（原始键直出 + 值按类型格式化），不对 key 做端侧映射（键漂移零风险）；回滚版本 runId 空 + rollbackFrom 锚定源版本、closing 可空（收尾卡缺位）→ 统一兜底文案。
- **E2E seam 泛化**（T1 review 留账）：`installOrderMocks` → `installAiplatformMocks(page, { order?, project?, ... })`，域 fixtures 可选挂载；订单 E2E 仅改导入（31/31 回归证无损）。fixtures 与订单域交叉一致（同批 TSID 项目 id/name）。
- **坑与定案（E2E 踩出）**：① **动态路由模式下菜单点击与 addRoute 时序竞态**——点「项目管理」可能弹回 home（Vue Router 'No match for' 噪音，URL 瞬变后回落），waitForURL 捕获瞬态 through、后续断言全跑在旧页上是极难排查的假性失败——E2E 跨页一律 `page.goto` 直达（菜单渲染断言保留，菜单链路 #57 已证）；② NRadioButton 根类是 `.n-radio-button`（非 `.n-radio`）；③ 版本 tab 列表与详情同现同主题文本，getByText 断言会撞 strict mode——详情独有文本（全 hash / closing summary）作渲染信号；④ mock 失真警觉：fixtures 的 Long id 必须 string（对话条目 id 曾写 number，spec review 抓住）——**wire 形状钉子 = 类型注释自述**。
- **code-review 修正（双轴 review，紧随本票）**：① harness `ownerMap` 两域两份收编单点 `filterByExternalId`；② `costSummary` 去 nullable（provider 文档「无用量＝空 cost＋false 明确空态」指针恒在）——null 兜底渲染「成本完整」是误述；③ conversation fixtures id 字符串化（Long 序列化口径）；④ kind 色注释勘误（收尾卡红非紫）。review 判断项不修记录在案：`.desc-table` CSS 同特性内第二份（全仓 4 份先例容忍，萃取共享样式留待 T3–T6）；`tsToIso` 第 7 份拷贝（先例容忍）；对话条目 runId chip 属 AC 外但为契约字段（运营排障叙事有用，保留）。

### 2026-09-16 T3 交付：项目交付物文件区点亮 ✅（#59，六域之三——详情抽屉第五 tab）

mock E2E（project **63/63 两轮全绿** + order 31/31 回归绿）。验收五条全过：文件树按 path 折叠行内显 size（[{path,size}] 只列文件契约 → 前端目录合成 + `formatFileSize` B/KB/MB 折算）/ 点文本文件内嵌只读（content `<pre>` 只读 + path 原样回显）/ 拒读一态兜底（统一「无法预览」+ 透传 message——4022 超限与 4023 非文本**两码同 UI 态** E2E 钉死「不按业务码分三态」）/ 下载文件包（tar.gz 二进制流无信封 + Content-Disposition 文件名）/ E2E 全覆盖。

- **契约事实（api-docs）**：files 只列文件、目录由前端按路径段合成（目录 key 加 `dir:` 前缀防与文件 path 撞 key）、size Long（字节）→ JSON string；content 拒读全归 provider 裁决（4020 机密/4021 不存在/4022 超 1MiB/4023 非文本）——**4020 经树不可达**（.env 等非交付物不入清单），E2E 只 mock 树内可达的 4022/4023 两类（fixtures 头注释钉死此口径）；package 无信封、sealed=-archive/未封存=-source 文件名由 provider 经 Content-Disposition 决定（BFF 不判封存态）。
- **交互定案**：树 `NTree` block-line + expand-on-click + selectable，根级目录默认展开（树随数据后挂载、default-expanded 生效于挂载时）；目录选中 = 回提示态（防旧内容/拒读态残留）；拒读 onError toast（全局兜底）与 pane 内锚定态**双显**是有意为之（toast 不抑止，先例 ADR-0001）。
- **code-review 修正（双轴 review，紧随本票）**：① 点目录后查看器残留旧态 → 目录/取消选中回提示态；② 下载落盘动作（objectURL→anchor→revoke ~15 行）与订单源码包第 2 份逐字重复 → 萃取 `saveBlobFile` 收编 utils/common.ts、两调用点归一（订单回归 31/31 证无损）；③ `buildTree` 双遍历收敛单次递归铺平索引；④ 删仅为空态判断存在的 `files` ref；⑤ E2E 断言名与实断对齐（补 12 MB）。review 判断项不修记录在案：`error.response.data.message` 内联提取与 onError 重复（单一消费者，出现第二处再萃取）。

### 2026-09-16 T4 交付：沙箱域点亮 ✅（#60，六域之四——清单 + 详情 + 唤醒/休眠/重建/封存四写）

mock E2E（workspace **48/48 两轮全绿** + order 31/31 / project 63/63 回归绿）。验收五条全过：清单契约字段（workspaceId/containerName/kind·kindName/status·statusName/期望态·实态两列分示/lastTouchAt/卷大小/封存时刻/封存包大小/项目引用）/ 期望态·实态过滤（desired=1&actual=3 组合即捞漂移清单）/ 详情抽屉全字段 + resources + project 引用 / 四写按态门控 + 触发正确端点 + 成功后回读+刷新 / 失败透传 message 统一 toast（409 WSP_015）。

- **契约事实（api-docs + provider 枚举印证）**：期望态 1=运行 2=休眠 3=封存（DB 意图侧）/实态 1=运行中 2=已停止 3=无容器 4=未知（docker 探查一瞥不落库）两列如实分示——「期望运行而实态无容器」即漂移行；置备状态 1=置备中 2=就绪 3=失败；环境类型 1=开发 2=测试 3=生产（v1 仅 DEV）；volumeSizeBytes/archiveSizeBytes Long（字节）→ JSON **string**（封存容缺/探查失败 null）；project 软引用可空（工作区先于项目存在）；resources[].kind **无 `*Name` 字段**（契约如此，区别于其余枚举 ADR-0009 直读）——PostgreSQL/Redis 语言无关专有名词，端侧小映射 `middlewareKindLabel` 不构成 i18n 负担。
- **四写门控（守卫链 WSP_001→007→015→009→017 的可前置观测子集）**：非 DEV（WSP_007）四写全拒（E2E TEST 行钉死「操作」下拉不渲染）；唤醒**无状态限制**（封存态走深度唤醒、漂移/已死容器走幂等重建、run 在途不受限——不动数据面）；休眠/重建/封存重活三写同守卫（WSP_009：置备中/封存态拒——封存态卷已删先唤醒）。run 在途（WSP_015）/收敛任务在途（WSP_017）不可前置观测，留给服务端裁决走透传 toast。门控收编 `availableWorkspaceActions` 单点（constants），列表行下拉与抽屉按钮共用防漂移；休眠对「已休眠」照常给（幂等补删残留容器——期望休眠而实态运行的泄漏行正需要它）。
- **四写响应＝动作后的观测详情**（WorkspaceDetail，区别于订单 OrderWriteAck「不回读此体」）：响应即新事实，前端 `applyDetail` 直填抽屉**免二次回读**（E2E 以详情 GET 计数不增钉死）+ 列表刷新；抽屉 modal 遮罩下「开着即同目标」恒成立（订单域先例）。四写均无 body；确认弹窗按钮等请求（深度唤醒/封存分钟级，loading 态诚实）。错误码数字形＝域码 1×1000＋序号（1001/1009/1015/1016/1017）。
- **E2E 单域挂载的 home 陷阱**：workspace E2E 初版只挂 workspace fixtures，但 menus mock 的 home=aiplatform_order——登录落订单页拉清单撞 benign 空成功（data:null）炸 defaultTransform（pageerror 噪音）→ 补挂 order fixtures 消除（project E2E 双挂先例）；订单/项目回归零 pageerror 佐证。fixtures 与项目域交叉一致（教研/校园/口算的 workspaceId 即 project-fixtures 详情字段，同批 TSID）。
- **code-review 修正（双轴 review，紧随本票；修后 48/48 + 订单 31/31 + 项目 63/63 回归绿）**：① 四写权限码 Record 两份（index/drawer）收编 constants `workspaceWriteAuth`（与门控 helper 同居单点——改码一处编辑）；② 删 `middlewareKindLabel[r.kind] ?? String(r.kind)` 不可达兜底（kind 类型 1|2 Record 全覆盖，standing rule「门控可达不写防御性」）；③ `onDrawerAction` 纯转发删（emit 三元组与 handleAction 形参同序，模板直绑）；④ E2E `confirmDialog` 容器名参数化（§9 唤醒异目标行复用，删内联重写）；⑤ 两处「卷容缺」断言名实对齐（补 `'-'` 占位断言——T3 review ⑤ 同型复发）。review 判断项不修记录在案：AC3「回读+刷新」按契约以响应直填替代回读（响应即新事实，非偏差）；resources[].kind 无 *Name 系 provider 完整文档化设计（非 swagger 缺口，专有名词端侧映射已录上条）；`(action,id,containerName)` 三元组同行（Data Clump 仅记录，满足 confirm 插值需要）。

### 2026-09-16 T5 交付：成本中心 dashboard 点亮 ✅（#61，六域之五——时间窗 + 五档 + 双柱状 + unpriced + 项目表下钻）

mock E2E（cost **38/38 两轮全绿** + order 31/31 / project 63/63 / workspace 48/48 回归绿）。验收七条全过：from/to 必填（缺任一不发起请求 + 变更即重查）/ token 五档 stat tile（primitive long 数字千分位）/ byModel·byAgentKind 双柱状（agentKindName null 落「—」桶）/ unpriced 警示卡（有则高亮、窄窗避开即收起）/ 项目成本表分页 1-based + 成本降序行序 / 行点击 NDrawer 下钻（五档 + 双柱状 + 未配价档位复用同款组件）/「按币种成本」不渲染留位不报错。

- **契约事实（api-docs 实测 + 下钻端点 description）**：四读口 from/to **必填**（BFF 不设默认窗口、缺参 400 框架信封；半开 [from,to)、ISO-8601 Instant UTC 带 Z）；五档 token 为 **primitive long → JSON 数字**（swagger integer/int64——区别于金额 Long-string 口径，formatCount 千分位直读）；`cost{}` 按币种分桶暂缓渲染（REQ-20 #75——fixtures 带 `{}` 钉死「不报错」）；byAgentKind 的 agentKindName 可 null（辅助标记落「—」桶）；**swagger `UnpricedTier` 同名嵌套 record 撞名合并**——全局端点带 tokens、下钻端点按其自述「bySubject 口径无 token 计数」，前端分型 `UnpricedTierUsage`（带）/`UnpricedTierMark`（不带）、下钻不渲染 tokens；项目清单排序服务端定死成本降序（全未配价排后 allUnpriced=true——前端不重排只标注）；下钻查无此号 = 全零 total + 空结构非 404（零用量如实呈现）。
- **时间窗交互定案**：默认最近 30 自然日（前端显式传窗满足「必填」契约——BFF 无默认窗≠前端不能预设）；NDatePicker datetimerange 变更即重查四口（fill+Tab 两次提交会带一次中间窗 [新起,旧讫] 多查一轮——变更即重查的字面行为，不做防抖）；清空 → windowQuery 归 null，四段停查 + 整页「请选择时间窗」提示态接管；序列化 `new Date(ts).toISOString().slice(0,19)+'Z'`（本地→UTC 折算，秒精度契约形）。
- **滚动 dashboard 形态**（区别于列表页 fit-viewport）：四段总高必超一屏——root 不用 `overflow-hidden`（home NSpace 先例），表格自然高度随页滚（不 flex-height/不 sm:h-full——flex-height 必须配高度约束，本页没有）。E2E 曾因 overflow-hidden 剪掉分页踩此坑。
- **echarts 组件 v-show 定式（新坑入册）**：图表 div **恒挂载 v-show 切换**、占位态（loading/error/empty）走绝对定位覆盖层——v-if 换枝会在卸载瞬间触发 useEcharts 尺寸 watch → `echarts.init(null)`（"Initialize failed: invalid dom" pageerror，窗口变更/清空必踩）；v-show 图表实例跨窗口变更复用，只 setOption。E2E canvas 断言注意：数据后一拍才 init（ResizeObserver），先 `waitFor` 第二张 canvas 再计数。
- **E2E「—」桶断言法**：echarts 文字渲染进 canvas、DOM 不可见——tooltip 默认 html 渲染（renderMode html），hover 第三柱区（0.78×canvas 宽）后 tooltip DOM 带 axis 标签文本，锚定「—」桶端到端可见；unpriced 收起断言 = 窗口敏感 fixtures（`UNPRICED_EVENT_AT` 事件时点，窗口含才出警示——窄窗避开即收起，数据驱动非状态开关）。
- **组件复用**：`token-usage-tiles`（五档 tile，总览+下钻共用）/`breakdown-chart`（归一 {label,tokens} 行，byModel 拼 provider/model、byAgentKind 直读 agentKindName，四处复用：总览×2 + 下钻×2）/`unpriced-alert`（全局警示卡，有则高亮无则不渲染）；五档键序/标签单点 constants（`TOKEN_TIER_KEYS`/`tokenTierLabel`）。
- **code-review 修正（双轴 review，紧随本票；修后 38/38 两轮 + 订单 31/31 / 项目 63/63 / 沙箱 48/48 回归绿）**：① byModel/byAgentKind 行映射 computed 两份四段（index/drawer 逐字重复）→ 收编 `modules/breakdown.ts` 单点（`modelUsageRows`/`agentKindUsageRows`，与 `BreakdownRow` 同居——T4 review ① 收编同型；`<script setup>` 不允许值导出故立独立 ts，payment `modules/types.ts` 先例）；② 删两处不可达 `?? {from:'',to:''}` 空窗兜底（standing rule「门控可达不写防御性」，T4 review ② 同型）——defaultRange 具名 + `serializeWindow` + `currentWindow` ref（初值=默认窗、watch 仅非空更新，非空不变式成立即无兜底）；③ `tsToUtcInstant` 收编 utils/common（tsToIso 家族第 8 份拷贝起收编——UTC+Z 与本地串是两种契约形，注释钉死）；④ E2E `costCalls` 形参名/注释「前缀」实为全等（名实对齐）；⑤ en「(Cost Desc)」→「(Cost Descending)」。review 判断项不修记录在案：unpriced-alert 裸 `<table>`（只读小表，`.desc-table` 是键值网格非行表、NDataTable 过重——第三种词汇容忍，T6 收官再议）；ADR-0002 store seam 不引入（ADR 范围限 payment 仪表盘、BFF overview 已是聚合单体、aiplatform 域 T1–T4 直连先例；若后端日后跨域聚合再补同款 seam）；「留位」按不渲染+类型保留口径实现（REQ-20 #75 落地时补 UI）。spec 轴：三处 spec 外增量（配价状态列 allUnpriced 契约字段显形/刷新按钮 payment 范式/E2E 零用量下钻用例）均保留。

### 2026-09-23 T8 交付：消费 admin#75/#77 契约增量 ✅（#64——按币种成本四面 + 对话史四载荷 + kind=7 报价卡）

mock E2E（cost **43/43** + project **83/83** 两轮全绿 + order 31/31 / workspace 48/48 / price-entry 44/44 / material 46/46 回归绿）。验收七条全过：四个成本承载面渲染币种桶（总览 chips / 项目表列 / 下钻 chips / 项目详情 costSummary——空对象空态文案不伪装 0）/ typings 四处 cost + 四载荷类型化（文件头「暂缓」注释清理）/ question·closing·attachments 按文档结构渲染（text=null 条目不再 '-' 占位）/ kind=7 报价卡（kindName + event + orderId 可复制，无金额）/ i18n 三处同步 / E2E mock 覆盖三块 / 失败走透传 toast（既有口径）。

- **契约正本读取口径（票面前置坑）**：本地 admin :8081 进程是 9-22 旧构建（早于 admin#75 合入 `1ed082f`，swagger 无 quote 肢）——契约按 admin 仓 HEAD 的 DTO `@Schema` 注解读（它即新构建的 api-docs 内容），E2E 走 page.route mock 不依赖 live 后端；**手册验证前须重启后端到含 #75 构建**。
- **契约事实（admin#75 @Schema + admin#77 通报）**：`cost` 桶＝键 ISO 4217 / 值 **swagger number 直读不折算**（区别订单 Long 分口径——勿套 formatMoney；空对象＝无用量或全未配价）；对话条目四载荷结构钉死——question 呈现投影 `data.questions[{header,question,multiple,custom,options[{label}]}]`（`toolCalls` 服务侧续跑面不呈现）、closing＝run-finish 收口扩载（**可缺省键＝该轮无该事实**，`durationBreakdown` 平台分析口径文档明示可忽略）、attachments＝`{attachmentType:"annotation",annotation:{kind,anchor,note?}}`（select 点选/circle 拖框/comment 历史兼容，#97）、quote＝`{orderId,event}` **不含金额**（视镜语义 ADR-0017——金额/状态须按 orderId 取订单当前态，v1 不取）；kind 补 **7=报价卡**（kindName 随行中文）；**改价即刻对用户可见**（admin#77——repriced 卡带运营提示）。
- **形态**：① 币种桶四承载面走 `cost-buckets.vue` 单点（chips 金额降序 + 空态文案；表列内联渲染同口径）+ `formatCostAmount`（utils/common——千分位去尾零、小数上限 8 位）；② closing 双承载面（对话史 kind=5 + 版本详情，#88 同载荷）收编 `closing-card.vue` 结构化组件（摘要/PRD·系统变更±note/文件行 +n/-n 双色/耗时「x 时 x 分 x 秒」/自测 n 项/版本 hash）——versions-pane 从泛型键值升级（文档化程度足够，非强行加戏），`VersionDetail.closing` 随之收紧为 `ClosingCardPayload`；③ 报价卡 event 双态 tag（quoted=首次报价 success / repriced=改价 warning）+ orderId mono + 复制钮（navigator.clipboard，E2E 授 clipboard 权限断言 toast）+ repriced 运营提示行；④ 圈注附件 chip（kind 端侧小映射 select/circle/comment，未知裸值直显——middlewareKindLabel 同口径）；载荷缺失/形状不符统一「载荷缺位」空态不报错。
- **E2E**：cost-fixtures 补桶（overview 双币种 CNY 89.5/USD 12.34、行桶、全未配价行 `{}`）+ project-fixtures 重写 CONVERSATIONS（10 条 kind 1-7 全覆盖——双圈注附件/问答投影含可多选/收尾全字段/version 锚定叙事一致/quoted+repriced 双报价卡）+ VERSION_DETAILS files 契约形修正（linesAdded→added）；断言要点：直读不折算（12.34 非 1234）、空对象「—」且无伪 0、收尾耗时 1043000ms→「17 分 23 秒」、报价卡无 ¥ 字样、复制 toast、text=null 无「-」占位（`pre` regex 全锚）。

- **code-review 修正（双轴 review，紧随本票；修后 cost 43/43 + project 83/83 两轮 + 四域回归绿）**：① 币种桶「过滤+金额降序」逐字两份（cost-buckets computed / cost/index renderCostCell）→ 收编 `breakdown.ts` `costBucketEntries` 单点（T5 review ① 同型——cost 域数据形变居所本就在此）；② 报价卡 event 同判别式三元两联（tag 色 + 文案）→ `quoteEventMeta` Record 单点（annotationKindLabel 同口径）；③ repriced 提示措辞收敛「已收到→将收到」（对齐 admin#77 原文断言强度——SSE 推送 ≠ 已读回执）。review 判断项不修记录在案：`Number.isFinite` 滤脏值（与「形状不符走空态」载荷口径一致，随 ① 收编归一）；conversation-pane `annotationChips(entry)` 模板双调用（v-if 判长 + v-for 重算，量级小无 memo 需要）；project-detail-drawer 跨子域深路径导入 cost-buckets（首例跨子域复用，出现第二例再上提 aiplatform 共享层——`.desc-table` CSS 拷贝先例同款容忍）；总览面无空对象 E2E 用例（空对象已三面钉死 + 四面共用同组件单点，第 4 份断言收益低）；ClosingCard 在版本详情重复渲染 version 行（元数据已示 commitHash，冗余无害）；CostBuckets 键整体缺省（undefined 非 `{}`）不显空态（契约口径空对象才是「无用量」形）。spec 轴：七条 AC 全过、无缺失项；versions-pane 结构化升级系 spec 明文授权（「按文档化程度定」）非加戏。

### 2026-09-24 #56 收口交付：账号档案嵌件（第 34 端点）点亮 ✅（account:read 有码无页——订单/项目抽屉共用）

mock E2E（order **35/35** + project **87/87** 两轮全绿 + workspace 48/48 / cost 43/43 / price-entry 44/44 / material 46/46 回归绿）。至此 34 端点全消费（33→34）。

- **externalId 锚点事实（api-docs 核实）**：订单/项目详情响应均不带 externalId——嵌件由**列表页 externalId 筛选值**驱动（admin#62 用户故事 7 字面流：identity 拿账号 id → 按 externalId 检索 → 抽屉认交易对手）。**过渡实现**：REQ-21（admin#76，本仓 grill 时已提）落地 detail 补 `ownerExternalId` 后锚点迁至详情响应、任意抽屉常态点亮（组件/服务层注释已钉迁移注记，防 workaround 固化）。筛选在即查、缺省不渲染；「列表按 externalId 命中 ⇒ 账号必已建档」故 404（IDN_004→6004）仅筛选后删档竞态可达——onError 透传 toast 兜底、区不渲染，不设专属错误态（prd-pane「错误态不写防御性处理」先例）。
- **aiplatform 共享层立层**（T8 review 在案「跨子域第二例上提」兑现）：`views/aiplatform/modules/` 首件 `account-profile.vue`（order/project 两抽屉共用 + account:read 读码门控）；cost-buckets **留居 cost 域不迁**——其数据形变居所在 `breakdown.ts`，上提反造共享层→域反向依赖。
- **mock 单一事实源**：harness `ACCOUNT_PROFILES` 恒挂载（有码无页、无域 fixtures 参数），`externalIdOwnerMap` 改由它派生——订单/项目 externalId 筛选与档案端点同一批账号；嵌件用例挂订单/项目 e2e 尾部（无独立文件）。
- **code-review 修正（双轴 review，紧随本票；修后 order 35/35 + project 87/87 复绿）**：① spec 轴指出筛选驱动系 REQ-21（admin#76）落地前的降级替代——组件/服务层/本条目补「过渡实现，detail 补 ownerExternalId 后迁锚点」注记防固化；② e2e 补档案昵称断言（`赵六` 双处渲染 count≥2——基本信息 ownerDisplayName + 档案 displayName 同名互证）。review 判断项不修记录在案：两域 e2e 嵌件段 ~15 行逐字同型（e2e 惯例每域自包含，第三例再提 helper）；externalId prop 经 index→drawer 两跳纯转发（Vue prop drilling 惯用 + 注释钉转发理由）；watch 异步无乱序防护（抽屉模态期间筛选不可变，不可达不防）；account:read 无码门控无 e2e（harness 恒授全码、无降权登录先例，hasAuth 门控与全站同型不单测）。

### 2026-09-24 #56 联调收口：真实链全量走查通过 ✅（admin-web :3001 → admin :8081 → aiplatform :8888）

**API 层 34/34 端点全触达 + UI 真链走查 9/9**（六域页面真数据渲染 + 登录/动态菜单 + 账号档案嵌件 live 点亮——externalId 筛选 → 抽屉真档案四字段）。收域标准对照：① 域内全端点 happy path ✅（读全 200；写经素材 disable⇄enable 触达）；② 写操作留痕落库 ✅（回执与详情回读 `operatorId=1 超级管理员`——X-User-Id/Name 出站注入 → provider operator 列）；③ 分页与过滤边界 ✅（1-based page=1/2、size clamp 500→100 回显、超总页空 items、orderId 查无空清单 200、externalId/status 过滤、成本缺窗 400）；④ 签名负例三连属 admin↔aiplatform 机机面（admin#61 自身验收项，admin 仓执行）——本联调全链经 admin 出站签名成功即签名机制正向证据。

- **数据态非缺陷（透传路径如预期）**：休眠沙箱（desired=休眠、无容器）项目 versions/files、未备工作区订单源码包 → 500 WSP_002「环境后端操作失败」（git/打包需活工作区——运行中沙箱项目 versions 13 版/files 103/文件包 190KB gzip 全通）；PRD 未产出 → 404 PRJ_015。前端 onError 透传 toast 兜底正确。
- **超管权限口径印证**：admin（超管）`/auth/current` permissions 为空——后端 bypass + 前端 `hasAuth` `isStaticSuper` 放行（auth.ts 在案注释），嵌件/写按钮正常显隐。
- **环境数据留档**：单价表有一行 2026-09-24 生效的预发布改价（0.00000133）、订单价目史三行（9-23「#56 联调冒烟：改价验证」）——前轮后端冒烟留痕；素材域唯一数据「联调冒烟素材（#56 验证后删除）」经本联调 disable⇄enable 后**保留未删**（删光唯一素材令素材页空态，保留利于后续联调；其标题为前轮冒烟者备忘）。

### 2026-09-24 #65 技能域三页 grilling（技能管理/指派配置/智能体配置，消费 admin BFF 技能线 15 端点；后端已就绪 admin#80–#86 收口）

admin 技能线全量合入（`/api/admin/aiplatform/**` 49 端点 = 六域 34 + 技能线 15），三叶菜单 V17–V19 已种（220/230/240；icon `carbon:tools`/`list-checked`/`prompt-session` 已对锁定 @iconify/json@2.2.472 离线集核实全部存在）。本票 grill 拍三页 UI 形态，两轮 15 决策定稿（Q1–Q15 全按推荐）；实现 spec = [#66](https://github.com/ZhangColin/semgravio-admin-web/issues/66)（ready-for-agent），拆票 [#67](https://github.com/ZhangColin/semgravio-admin-web/issues/67) T1 技能管理（frontier）→ [#68](https://github.com/ZhangColin/semgravio-admin-web/issues/68) T2 指派配置 / [#69](https://github.com/ZhangColin/semgravio-admin-web/issues/69) T3 智能体配置（均 blocked by #67；原生 blocked-by API 对本仓 404，正文文字引用为权威边），真链联调收口归本票。

- **契约正本 = admin :8081 `/v3/api-docs` 实读**（skills 10 / assignments 2 / agent-configs 3 / agent-tools 2）。关键事实：① 安装命令**无 tag/ref 字段**（`repoUrl`+`excludeDirs[]`，版本恒=装时 HEAD——票面「tag 手输」按契约收敛）；② 指派=**每槽位一个 PUT**（`/skills/assignments/{slot}`，`{skillIds[]}` 整包替换、空=清空、builtin 400 SKL_011）；③ **agent-config PUT 是「缺省即回落」全量终态**——工具两 flag 缺省=true（开）、prompt/modelId 缺省=清覆盖 → 保存必须**四字段全量回传**（工具 flag 以 GET 回显原值透传，防静默误开）；④ 状态枚举与素材同构（1=启用 2=停用；source 1=内置 2=安装）；⑤ 回执三形：install=装入条目 `SkillSummary[]`、uninstall/启停=单个 `SkillSummary`（uninstall=删除前终态）、update=`{from,to,removedSkillNames,operator*,skills[]}`（from==to=幂等未落痕）；⑥ 更新留痕按来源包 query `sourcePackage` 必传；⑦ 错误码 SKL=7xxx/PRJ=4xxx 数字透传（standing onError toast）。
- **交付切片（Q1）**：T1 技能管理 → T2 指派配置 → T3 智能体配置（每片 mock E2E 两轮绿合入）；回执分型（Q7）：安装/更新=回执态 modal、卸载/启停/指派/配置 PUT=toast+刷新。
- **技能管理页**：清单 NDataTable 无分页（有界目录、服务端排序内置在前）；列=名称/描述/来源 sourceName/来源包（安装行 mono、内置 '-'）/版本 mono/状态 tag/最近操作 operatorName（契约无时间字段）/可更新（true→「可更新」tag，**不门控更新动作**）。动作=「操作」下拉：停用⇄启用互斥（素材门控范式）＋更新/卸载/留痕仅安装行；启停对内置照给（无「内置不可停」码，provider 裁决透传）。详情抽屉 720 单栏三节（基本信息 desc-table / Frontmatter 泛型键值（自由 map，versions closing 先例）/ 正文全文 pre）。安装=单步 NModal（repoUrl NInput + excludeDirs NSelect multiple tag 手输），成功不关窗切回执态（reprice-modal 先例：「本次装入 N 项」表+完成即关+父页刷新），失败留窗。更新=$dialog.warning 确认（来源包对账+移除拒绝提示）→回执态 modal（from==to 显式「远端未前进未落痕」、removedSkillNames 空显「无移除」、终态行集表）。更新留痕=行级「留痕」动作 NDrawer 时间线（from→to/operator/时间倒序）——按**来源包**挂行级入口，不放技能详情（留痕主体是包）。
- **指派配置页**：NTabs 三签（label 端侧三值映射 main=主智能体/executor=run 执行体/subagent=子智能体——响应无 slotName）；每签 NDataTable 行勾选＋当前指派预填；**选项集不列 builtin**（400 门控可达即排除）；已停用行照常勾选（终态语义）+状态 warning tag 行级呈现；每签直接 PUT+toast 无确认（清单即终态，分配先例）。
- **智能体配置页**：NTabs 三签 main/executor/工具面；每座签内上半编辑卡（systemPrompt NTextarea+modelId **NInput 手输**（契约无白名单、错值靠留痕回滚兜底）；覆盖 tag「已覆盖/默认」+默认值灰字预览；**清空提交即回落**、不加「恢复默认」按钮）下半留痕时间线卡。工具面签=按槽位三块小表（工具名 mono/kind tag/enabled/描述）；kind 无 *Name → 端侧三值映射（SKELETON=骨架/ENHANCEMENT=增强/HARNESS_BUILTIN=内建，middlewareKindLabel 先例）；开关仅 ENHANCEMENT（骨架/内建 disabled 恒开）、受控 NSwitch 即时 PUT `/agent-tools/{toolName}`+失败回滚、无确认；**工具开关独走 tool 端点（agent-tool:toggle 码），config PUT 不动两 flag（原值透传）**。时间线=NTimeline 倒序**只渲染变化项**（old*/new* 四件对 old≠new；null 显「（默认）」）；条目「回滚」→$dialog.warning（写回旧值=一次新变更留新痕）→PUT old* 四值→刷新。
- **落位注记**：目录下划线 `views/aiplatform/{skill,skill_assignment,agent_config}/`（price_entry 先例，否则 getViewName throw）；`aiplatform_skill_assignment`/`aiplatform_agent_config` 三段键产生中间父键——`route.aiplatform_agent` 补键「智能体」（T6 `aiplatform_price` 同款）；i18n 三处同步；权限码 11 枚（read 无页侧落点、assign/update/toggle 门控各保存面、五写码门控动作项）。
- **术语**：glossary 补 7 条（技能/职能槽位/来源包/快照安装/智能体配置座/增强工具/更新留痕）；「AI 平台」条 34→49 端点。

### 2026-09-24 T1 交付：技能管理页点亮 ✅（#67，#65 技能域之一——清单/安装/详情审核/四写/更新留痕，技能域地基）

mock E2E（skill **56/56 两轮全绿** + order 35/35 / project 87/87 / workspace 48/48 / cost 43/43 / price-entry 44/44 / material 46/46 六域回归绿）。验收十条全过：清单契约字段（无分页控件、内置在前、内置行 null 四列 '-'、可更新 true/false/null 三态）/ 详情抽屉 720 三节（全字段 id mono + frontmatter 四型值格式化 + 正文全文）/ 安装单步表单（repoUrl + 排除段 tag 手输 → POST body 落参；成功不关窗切回执态「本次装入 N 项」+ 完成即关 + 父页刷新；失败 502 SKL_004 留窗透传）/ 动作矩阵（停用⇄启用互斥 + 更新/卸载/留痕仅安装行——内置行仅停用；五写 hasAuth 逐码）/ 停用⇄启用 / 卸载（确认 + toast 不消费回执 + 行消失；409 SKL_008 透传）/ 显式更新（来源包对账确认 → 回执 from→to + 移除名单 + 终态行集 + from==to 幂等呈现；409 SKL_013 透传）/ 更新留痕（按来源包 query 时间线倒序 + 空态）。

- **技能域地基（T2/T3 复用）**：`Api.Aiplatform` 技能线 typings（SkillSummary 13 字段 / SkillDetail（frontmatter 自由 map + content）/ Install·UpdateCommand / SkillUpdateReceipt / SkillUpdateTrace）+ service 8 端点 + constants（skillStatusTagColor + skillWriteAuth 五码）+ e2e fixtures/harness 分支 + 菜单叶 220 + 权限码 6 枚 + route/i18n 三处同步（`route.aiplatform_skill`＝「技能管理」）。
- **契约事实（api-docs 实读，2026-09-24）**：清单**无分页**（有界目录，`useNaiveTable` 非分页形全量直灌——首个无分页域）；id 为 **opaque 串两形制**（内置＝`builtin:<技能名>` / 安装＝TSID 十进制串）路径段直传禁数值化；安装命令**无 tag/ref 字段**（repoUrl + excludeDirs[]，版本恒＝装时 HEAD）；`updateAvailable` 为来源包级标记（null=未检查过、内置恒 null）**不门控更新动作**；回执三形——install＝装入条目数组 / 卸载·启停＝单个 summary（卸载＝删除前终态，不消费只 toast——素材删除先例）/ update＝from→to＋removedSkillNames＋终态行集（from==to＝幂等未落痕未写行）；留痕 append-only 倒序、**卸载不删痕**（留痕抽屉按来源包挂行级入口，主体是包不是技能——故不放技能详情抽屉）；错误码 SKL=7xxx（001 查无 404 / 002–007 安装失败族 / 008 有指派 409 / 009 缺留痕 400 / 013 更新整体拒绝 409）。
- **形态**：清单照六域（flex-height + sm:h-full）但无检索面（契约无过滤参数）+ 操作下拉照 workspace（rowOptions 矩阵单点：互斥 toggle ∩ hasAuth + source=2 专属动作）；安装/更新回执态 modal 照 reprice（成功 return false 留窗切回执、完成即关、emit success 父页刷新）；更新留痕抽屉 NTimeline 倒序如实渲染。**抽屉纯读面**（写动作只在行下拉——抽屉 modal 遮罩挡行操作，写触发时抽屉必关，无素材域 reload 联动分支，trust-UI-gating 口径）。
- **E2E 坑与定案（踩出）**：① **清单无 id 列**（AC 列集无 id——id 在抽屉）→ 行定位不能用 TSID/builtin: 文本过滤，改唯一技能名定位（material 用 id 列过滤的范式在本域不适用）；② **NDropdown 前后两次开菜单短暂并存**（前序菜单 leave 过渡未摘）→ 读取/点选收窄 `.n-dropdown-menu').last()` + 开前 sleep 300ms 稳定；③ **NSelect tag 模式输完建议菜单仍开**挡正按钮 → 点旁侧输入框转移焦点收起（Escape 有连带关 modal 风险不走）。
- **code-review 修正（双轴 review，紧随本票；修后 56/56 + typecheck/lint 干净）**：① update-receipt-modal 终态行 tag 内联 `status===1 ? 'success' : 'default'` 重推状态色 → 复用 `skillStatusTagColor` 常量单点；② fixtures 头注释「更新新增 chart-render」笔误 → diagram-draw（chart-render 是 install 装入行）；③ index.vue 内联联合 `'disable'|'enable'|'uninstall'` 三处 + 下拉键裸 string 断言 → 局部 `RowWriteAction`（Extract）/`RowAction` 单点 + switch 收窄（素材域 MaterialAction 同型）。review 判断项不修记录在案：e2e `pad`/`localFmt` 第三份逐字拷贝（#61 review 先例容忍至第 8 份才收编）；onRowAction 对 sourcePackage 的复检（TS null 收窄必要，非防御分支）；updateAvailable tag 渲染 JSX/模板两形（两惯用面，兄弟域同款）；harness `failNextSkillWrite`（SKL_009）已接线无用例（AC 未列该码，留后续域用）。spec 轴：十条 AC 全过、契约 8 端点 URL/method/body 对 swagger 逐一对上；404 SKL_001 mock 在但 e2e 未断言（与 SKL_008 同走 onError 统一机制，UI 门控下不可达）。

### 2026-09-24 T3 交付：智能体配置页点亮 ✅（#69，#65 技能域之三——两座编辑＋留痕时间线＋回滚＋工具面，技能线 15 端点收官）

mock E2E（agent-config **42/42 两轮全绿** + skill 56/56 / skill-assignment 28/28 / order 35/35 / project 87/87 / workspace 48/48 / cost 43/43 / price-entry 44/44 / material 46/46 全量回归绿）。验收八条全过：两座编辑卡（systemPrompt NTextarea＋modelId NInput 手输＋覆盖标记「已覆盖/默认」＋默认值灰字预览＋生效值预填）/ 保存 PUT **四字段全量回传**（webSearch/fetchUrl 以 GET 回显原值透传——契约「缺省＝true 开」防静默误开；清空提交＝回落默认＋覆盖标记复位）/ 留痕时间线（倒序＋只渲染 old≠new 变化项＋null 显「（默认）」＋operatorName）/ 回滚（$dialog.warning → old 四值 PUT 写回＝留新痕 → toast＋双卡刷新）/ 工具面三槽位块（slotName 直读＋kind 端侧三值映射＋骨架/内建 disabled 恒开）/ 增强工具受控开关即时 PUT＋失败回滚 / 失败透传 toast（400 PRJ_034＋403 PRJ_036 两代表样）/ route+i18n（菜单叶 240）。

- **契约事实（api-docs 实读＋provider 源码核实）**：agent-configs 3 端点（GET/PUT `/{agentKey}` 回执同形读面：生效值＋`*Overridden` 标记＋`default*` 预览＋两 flag＋最近写者；`/traces` 倒序服务端定死）＋agent-tools 2 端点（GET 三槽位清单、PUT `/{toolName}` 窄幅开关）。**PUT 全量终态**：systemPrompt/modelId null/缺省/纯空白＝清覆盖回落枚举默认（provider `blankToNull`）、两 flag 缺省＝true 开——前端保存四字段全量回传防静默误开；**值面无动＝幂等回执零落痕**（留痕链每痕都是真实变更）。**工具开关挂 main 行开关列**（provider `toggleTool`——web_search/fetch_url 的 `tool.slot()`＝main，与配置全量写共表共留痕）：读面 main 槽增强件挂载态＝main 配置 flag（两入口同源）；骨架/harness 内建 403 PRJ_036 锁死、enabled 缺省 400 PRJ_037。错误码 PRJ 4xxx：4033 查无 404 / 4034 操作者缺 400 / 4035 工具无 404 / 4036 锁死 403 / 4037 目标态缺 400。回滚无专用端点＝old 四值快照写回。main 默认档 deepseek-v4-flash、executor 默认档 deepseek-v4-pro（AgentProfile 镜像）。
- **形态**：NTabs 三签（main/executor/工具面；前两签 label 端侧两值映射——签渲染先于读面到手，读面到手后编辑卡题直读 `agentName`）、`display-directive` 缺省 if＝切签重挂即加载（T2 同款）；面板自管（agent-config-panel：编辑卡＋时间线卡上下两卡；tool-inventory-panel：槽位块 NCard×3 内嵌小表）。编辑态＝生效值直灌（未覆盖时即默认原文），保存原样透传（空串经 provider blankToNull 归一＝清覆盖）；两 flag 不进表单（原值透传）——开关独走工具面 tool 端点（`agent-tool:toggle` 码），config 保存与回滚走 `agent-config:update` 码（回滚＝PUT 配置写同码，review 确认良性超纲）。**受控 NSwitch**（`:value` 非 v-model＋`:disabled`/`:loading`）——值随回读走，失败视觉态天然不动（回滚免实现）；骨架/内建恒 true disabled。kind string 裸值三态端侧映射收 constants（`agentToolKindLabel` i18n key＋`agentToolKindTagColor`，skillSlotLabel 先例）；留痕变化项投影 `changedFields`（四件对 old≠new 过滤）＋ null 显「（默认）」、布尔显开/关。
- **路由**：`agent_config` 目录三段 key 产纯父中间键 `aiplatform_agent`（**无页面、无劫持坑**——price 同款 redirect 预期形态，不走 T2 flattenLeafParentRoutes）；spec 决策 23 补键 `route.aiplatform_agent`「智能体」照做；static `/aiplatform/agent/config` vs dynamic 菜单 `/aiplatform/agent-config` 双轨并存（T2 同款，动态模式以后端 V19 种子为准）。
- **E2E**：skill-fixtures 扩智能体域（AGENT_CONFIGS 两座——main 双覆盖靶 fetchUrl 关＝flag 透传断言锚 / executor 全默认靶＋留痕空态；AGENT_TRACES 两条——t1 双字段变化＝变化项过滤＋「（默认）」靶 / t2 仅 fetchUrl；AGENT_TOOL_SLOTS 三槽 main 槽 8 工具全量对齐 provider 枚举序）＋harness 扩（`applyAgentConfigUpdate` provider 镜像：blankToNull＋flag 缺省 true＋幂等零落痕＋留痕 unshift；`agentToolSlots` 按 main 配置 flag 派生增强件挂载态＝同源不漂移；tool PUT 窄幅写挂 main 行；failNextAgentConfigUpdate 400 / failNextAgentToolToggle 403 注入；菜单叶 240＋权限码 2 枚）。断言要点：PUT body 四字段全量（systemPrompt 空串＋fetchUrl false 透传）、清空回落 textarea＝默认原文＋tag 复位、回滚 PUT body＝old 四值快照、时间线条目数递增（保存/回滚各 +1）、开关失败受控值不动。
- **坑（踩出）**：① **块注释里 `old*/new*` 的 `*/` 提前闭合注释**——TS1127 Invalid character 连环炸（typecheck 首跑红），全仓 grep 清算改 `old/new`；② Naive tab pane 类名是 `.n-tab-pane`（非 `.n-tabs-tab-pane`）——e2e 取整 pane 文本改走外层 `.n-card` first（display-directive if 下外卡只含活动签内容）。
- **code-review 修正（双轴 review，紧随本票；修后 42/42 + 全量回归绿）**：① 删 `formatDateTime(config.updatedAt ?? '')` 不可达兜底（外层 `v-if operatorName` 已门控、函数签名收 `string | null`——trust-ui-gating standing rule）；② fixtures main 槽 4/6 骨架工具补全 8 工具、序对齐 provider 枚举（呈现级简化→契约忠实）。判断项不修记录在案：`agentConfig.stateOn/Off`（开/关）与 `tool.stateOn/Off`（开启/关闭）两对近义键（措辞刻意区分时间线紧凑 vs toast 完整）；`togglingTool` 单串 ref 并发点击互清 loading（仅视觉、mock 快速返回）；工具面失败/空无专属空态（onError 通用兜底 standing rule）。spec 轴：8 条 AC 全过、契约与 api-docs/provider 源码逐字段一致；回滚钮 update 码同门控与 harness PRJ_033/035/037 防御分支均为良性超纲。

### 2026-09-29 #70 收口：菜单种子 routePath 正典对齐（admin#94）——4 条多段名路由深链修复 ✅

admin#94 落地：4 条种子 routePath 改正典（`aiplatform_agent_config`→`/aiplatform/agent/config`、`aiplatform_skill_assignment`→`/aiplatform/skill/assignment`、`aiplatform_price_entry`→`/aiplatform/price/entry`、`payment_channel_log`→`/payment/channel/log`）。实读 `/menus/my` 4/4 正典；Playwright 走查：正典深链 4/4 渲染（F5/直链/书签不再 403）、扁平 path 4/4 退役（渲染 not-found「返回首页」——Soybean 404 **原地内联渲染不跳 URL**，退役断言按内容不按 URL）。

- **方案拍板（fail fast，用户定向）**：前端自愈方案（按 name 推导正典 path、不信后端 routePath）**否决**——后端准确则该逻辑多余；契约错误应尽早暴露而非静默自愈掩盖（trust-ui-gating standing rule 跨层同理）。走修源头＋防复发：种子 routePath 由 routeName 推导（admin#94），手写漂移两例前科（V18 icon、本次 path）收口。
- **动态/静态双轨自此同 path**：T2/T3 交付时「动态=后端扁平 vs 静态=正典」分裂消除，深链一律正典。
- **走查坑**：登录后立即 goto 会被守卫当未初始化踢回 `/login?redirect=…`——须等侧栏菜单渲染（会话稳定锚）再走查路径。

### 2026-09-24 T2 交付：指派配置页点亮 ✅（#68，#65 技能域之二——三职能槽位行勾选＋每槽 PUT 整包）

mock E2E（skill-assignment **28/28 两轮全绿** + skill 56/56 / order 35/35 / project 87/87 / workspace 48/48 / cost 43/43 / price-entry 44/44 / material 46/46 全量回归绿）。验收七条全过：三签 label 端侧映射（主智能体/run 执行体/子智能体——响应无 slotName）＋切签/进入加载对应 GET 预填 / 选项表不列 builtin（5 安装行）＋行上下文列取自技能清单＋停用行可勾与警示色实态 / 增减保存直接 PUT `{skillIds[]}`＋toast 无确认弹窗、空勾选＝清空、成功后回读刷新 / assign 权限码门控保存钮 / 失败透传 message toast（400 SKL_011 注入代表样）。

- **契约事实（api-docs 实读）**：指派＝**每槽位一个 GET/PUT**（`/skills/assignments/{slot}`，slot 三值路径段），GET/PUT 回执同形 `{slot, skills[]}`（与技能清单行共形、**含停用行**——「指派了但已停用」实态；停用不解除指派，停用行不参与装配合成）；PUT body `{skillIds[]}` **整包替换**（清单即终态、未列入＝解绑、空＝清空），只收安装行 TSID 柄——builtin 柄 400 SKL_011（7011，装配按配置挂载）、未寻址/畸形 TSID 404 SKL_001、未知槽位 404 SKL_010（7010）、缺留痕头 400 SKL_009；生效语义＝**动态查库**（变更后智能体下一轮自然生效，不定格不打断）。前端不消费 PUT 回执体——toast＋回读刷新（spec 回执分型 Q7）。
- **形态**：页面级拉一次技能清单过滤 `source===2` 作三签共享选项源（指派不改技能行，保存后不重拉清单）；NTabs 三签 `display-directive` 缺省 if＝切签卸载重挂即加载对应槽位 GET；面板组件自管勾选态＋保存行（slot-assignment-panel）。**回读 id 可能含表外行**（他端并发指派且本页清单未刷新）——checkedRowKeys 原样保留：表外勾选不渲染但随下次整包 PUT 送回，不丢他端生效的指派（整包替换语义）。停用行状态 tag 从技能清单的 default 灰升级 **warning**（指派上下文＝装配退化警示，终态语义）；保存钮 hasAuth `admin:aiplatform:skill:assign`。
- **三段 route key 中间父键坑（T2 特有，spec 决策 23 未预见）**：`skill_assignment` 目录（price_entry 先例）使 `aiplatform_skill` 成「**有 component 的父**」——生成器 transform（elegant/transform.ts）对带 children 的非一级路由设 redirect→首子，静态回退模式 `/aiplatform/skill` 会被劫持到 `/aiplatform/skill/assignment`、菜单把技能管理变父项。定案：消费侧 `flattenLeafParentRoutes` 提平（src/router/routes/index.ts，手写文件 gen-route 重跑不冲掉；只提「有 component 且有 children」的子节点，纯父中间层如 aiplatform_price 不在此列——redirect 是其预期形态）。静态模式实测 5/5（:3002 临时 static dev + harness auth mock：/aiplatform/skill 不劫持、/aiplatform/skill/assignment 可达、菜单两叶平级）。动态模式由 menus/my 树驱动（叶子直接挂目录）不经此层；**T3 的 agent_config 中间键 `aiplatform_agent` 无页面**（纯父，price 同款）不走此坑，但 spec 决策 23 的补键照做。
- **E2E 坑（踩出）**：① **NTag type 不落 DOM class**（无 `.n-tag--warning-type` 之类——type 走 cssVars 内联着色）→ 警示色断言改 computed backgroundColor 差异化对比（停用行≠启用行），不锚主题具体色值（防主题覆写脆断）；② **NTabs `animated` 切签过渡期双表并存**（旧 pane leave 未摘）→ locator strict violation，去掉 animated（display-directive if 即卸载，且少一个动画面）；③ **组件 prop 勿叫 `slot`**——与 Vue2 废弃 slot attribute 撞名，`pnpm lint`（eslint-plugin-vue autofix）会**静默**把 `:slot="slot"` 改写成 `<template #[slot]>` 具名插槽＋删 prop（面板空白＋必填 prop 丢失，typecheck/e2e 双红而 lint 自报 0 错）。本次五次「文件被神秘改写」的真凶即它（时序全在 lint/commit pre-commit 之后）。根治＝prop 改名 `skillSlot`；教训：文件在 lint 后被无端改写，先怀疑 `--fix` autofix，不是 IDE/人。
- **code-review 修正（双轴 review，紧随本票；修后 28/28 + typecheck/lint 干净）**：① 面板状态 tag 内联 `status===2 ? 'warning' : 'success'` 重现 #67 review ① 刚清除的形状（两轴同点名）→ constants 具名 `skillAssignmentStatusTagColor` 单点（与 skillStatusTagColor 有意不同：2→warning 升级，注释钉语义）；② e2e `EMPTY_SLOT_ROW_ID` 硬编码与「fixtures 单一事实源」自相矛盾 → 收进 skill-fixtures 导出。判断项不修记录在案：flattenLeafParentRoutes 泛型化免 `as GeneratedRoute[]`（spread 判别 union 本质要断言，泛型只是把 cast 挪进函数体，净收益零）；一层提平非递归（当前数据无四段 key 形，按「不可达不预设」口径自洽）。spec 轴：7 条 AC 全过、契约与 api-docs 实读逐字段一致；「回读表外行保留」spec 未要求（他端并发可达、整包语义自洽，良性超纲）；路由提平属决策 23 未预见的必要配套（条件窄、静态回退不变式实测反被修复）。

### 2026-09-29 #65 联调收口：技能线真实链全量走查通过 ✅（admin-web :3001 → admin :8081 → aiplatform :8888）

**API 层 15/15 端点全触达 + UI 真链走查 13/13**（登录/动态菜单三叶 + 三页真数据渲染 + 详情/更新留痕双抽屉 + 配置留痕时间线真痕 + 工具面三槽位）。收域标准对照（#56 四项同构）：① 域内全端点 happy path ✅（读面 11 连 200——清单/详情×两形制柄/指派×3 槽/配置×2 座/配置留痕/更新留痕/工具面；写面全触达——install/停用⇄启用/uninstall/update 两形/PUT 指派/PUT 配置/PUT 工具，全部回执 operator=超级管理员＝X-User-Id/Name 出站注入 → provider operator 列）；② 写操作留痕落库 ✅（更新留痕 from→to 落库回读、配置留痕覆盖/回滚各落一痕）；③ 边界负例 ✅（409 SKL_008 有指派卸载守卫、400 SKL_011 内置柄指派守卫、幂等更新 from==to 回执且**未落痕**——update-traces 仅 1 痕＝真更新那次）；④ 签名负例属 admin↔aiplatform 机机面（admin 仓验收项）——全链成功即正向证据。

- **真链新印证（mock 外首证）**：① 安装 repoUrl **本地 git 路径直传**（provider clone 本地仓——联调无需外网；重装同仓取新 HEAD，版本恒＝装时 HEAD commit 二次印证）；② **工具开关与配置写共表共留痕**（PUT /agent-tools/web_search 各落一条配置留痕「联网搜索 开→关/关→开」——T3 契约注记「两入口同源」真链实证）；③ **卸载不删痕＋重装见史**（uninstall 后 update-traces 仍可查、重装后行级留痕抽屉见旧痕——append-only）；④ modelId **显式写值＝真实变更**（值等默认仍是 null→显式的覆盖写、如实落痕——provider 语义「显式即覆盖」，与「值面无动幂等不落痕」不矛盾）。
- **api-docs 技能线现 20 路径**（15＋drafts 4＋precheck 1——后 5 属 #71/#72 消费 admin #88/#90，本票不触）。
- **环境数据留档（写面全部还原）**：冒烟技能 smoke-skill-65 已终卸（清单还原 2 行原始态：prd-writing＋selftest-live-check）；指派三槽空、配置双座默认无覆盖、工具全开；main 配置留痕 4 条（覆盖/回滚/工具开关×2——真联调留痕保留，#56 素材先例同款）；本地仓 `~/tmp/skill-smoke-65` 保留（冒烟包留痕 1 痕跨卸载存活、仓在可复装）；#260 活体验收资产 selftest-live-check 未动。UI 走查为一次性脚本（用后即删，未入仓）。

### 2026-09-29 #71 草稿审核页 grilling（草稿审核新页 250 + 技能管理页观测扩展；admin #92/#93 已 CLOSED——blocker 解除，grill 收口后实现即刻可进）

13 决策全按推荐定稿（Q1–Q13，单票全量、mock E2E 一轮）。契约正本＝admin HEAD DTO（本地 :8081 若旧构建按 T8 口径读 `@Schema`，联调前重启后端）。

- **契约事实（admin #92/#93 源码核实，2026-09-29）**：drafts 4 端点——GET `/skills/drafts`（**不分页**、行 10 字段 id/name/description/slot/projectId/runId/scanVerdict/status 恒1/statusName/createdAt，自荐倒序）；GET `/skills/drafts/{id}`（16 字段：+content 正文全文 +scanFindings＝**untyped `List<Map<String,Object>>`**（七键 patternId/severity/category/file/line/matchText/description 仅 swagger 描述层）+留痕4 operatorId/operatorName/reviewedAt/rejectReason 在途恒 null，**任意状态可查留档**）；POST `/{id}/promote`（**无 body**、操作者 X-User 头，回执＝技能库清单行 `SkillSummary` 含新技能 id）；POST `/{id}/reject`（body 仅 reason，回执＝**终态草稿详情**同形、留痕直读）。错误族：409 SKL_016 撞名 / 409 SKL_017 已审结 / 400 SKL_009 缺操作者 / 400 SKL_018 空白理由 / 404 SKL_015——信封 code＝数字 7xxx、errors 恒 null、message 中文透传（**SKL_016 文案「技能库已有同名技能，晋升被拒」不含「先处置同名」指引**——票面括号是 issue 注释非后端文案）。观测字段：loadCount **JSON string 三态**（"5"/"0"/null——**null＝内置不适用、0＝从未加载**，语义＝load 实际发生口径）；lastLoadedAt LocalDateTime；resources＝`Map<String,String>`（**仅 Detail**、无 scripts/内置恒**空对象 {}** 非 null）；自产行 sourcePackage/version＝固定虚拟值 self。
- **草稿审核页（叶 250）**：清单照先例（NCard + NDataTable flex-height + sm:h-full、无分页无检索面、**不列 status 列**——整页恒在途零信息量）+ 刷新按钮、不轮询；详情 NDrawer 720 三节（基本信息 desc-table 含血统三件 → scanFindings → 正文全文 pre），**不设终态留痕节**（终态呈现归拒绝回执）。findings＝**七键投影卡片**（类型 Record<string,unknown> 缺键跳过、值直显——T8 closing「文档化程度足够即投影」先例；severity **裸值直显不映射色**（值域未文档化）、file:line mono、matchText 代码块、空列表「无发现」）。scanVerdict＝NTag 安全（SAFE）/注意（CAUTION）。审核动作＝**双入口**（行下拉 + 抽屉动作条，矩阵收 constants 单点 workspace 先例；promote/reject 两码分别 `v-if`）。晋升＝$dialog.warning（技能名对账+不可逆）；拒绝＝NModal reason 必填（前端拦截、SKL_018 兜底）。回执＝**回执态 modal 双写**（晋升呈新技能行 id mono；拒绝呈终态详情留痕三件——**拒绝回执是唯一终态留痕呈现面**）。错误＝**不判业务码**（#56 standing 决策零冲突）：写失败透传 message toast + **无条件刷新在途清单**（不判码也解 SKL_017 他端审结 stale）。权限三码 read（两读复用）/promote/reject，读写不串。
- **技能管理页（220）观测扩展**：详情 desc-table 加「使用次数/最近使用」两行（清单不加列——已 9 列）；loadCount 三态文案（千分位/「从未加载」/「内置不适用」，lastLoadedAt 同步）；自产行清单 package/version＝`-` 占位（内置行先例）、**详情如实直读 self**（扫视面降噪 vs 核对面如实分治）；resources＝详情第四节 NCollapse（每文件一面板：头相对路径 mono + 体 pre 全文、默认收起、`{}` 不渲染节）。
- **落位**：`views/aiplatform/skill_draft/`（下划线目录）→ 键 `aiplatform_skill_draft`；种子 V20 已种（V21 正典 routePath `/aiplatform/skill/draft`、icon carbon:task-approved、i18n_key `route.aiplatform_skill_draft`＝「草稿审核」）；`aiplatform_skill` 再添子叶由 T2 `flattenLeafParentRoutes` 自动覆盖；slot 稳定键三值端侧映射复用 skillSlotLabel 先例。
- **术语**：glossary「技能」两分→**三分同权**（+自产 3）；补 4 条（技能草稿/晋升/扫描判定/血统）。无 ADR（全为先例延伸，无一满足难逆+意外+真权衡三条件）。

### 2026-09-29 #71 交付：草稿审核页＋技能管理观测扩展点亮 ✅（单票全量——drafts 4 端点＋清单/详情观测字段，技能线 20 端点收官）

mock E2E（skill-draft **47/47 两轮全绿** + skill 68/68（观测扩展断言 +12）/ agent-config 43/43 + order 35/35 / project 87/87 / workspace 48/48 / cost 43/43 / price-entry 44/44 / material 46/46 / skill-assignment 32/32 全量回归绿）。验收全过：在途清单契约字段（无分页、不列 status 列、自荐倒序、血统三件槽位复用 skillSlotLabel、判定 NTag 安全/注意）/ 详情抽屉三节（含 findings 七键投影——七键全 + 缺键跳过、file:line mono、matchText 代码块、空列表「无发现」；不设终态留痕节）/ 动作双入口（行下拉＋抽屉动作条，promote/reject 两码分别 v-if）/ 晋升 $dialog 对账→回执态 modal 新技能行 id mono→技能库自产行入列（跨页断言）/ 拒绝 NModal 必填前端拦截→成功不关窗切回执态留痕三件（唯一终态留痕呈现面）＋同目标抽屉随行关闭 / 错误不判码（409 SKL_016、400 SKL_018 透传 toast＋无条件刷新，GET +1 断言）/ 观测扩展（自产行清单 package/version `-` 占位 vs 详情 self 如实直读分治；loadCount 三态「12,345/从未加载/内置不适用」两行同步；resources 第四节 NCollapse 默认收起、`{}` 不渲染）。

- **契约事实**：见上 grilling 段（admin #92/#93 源码核实）——实现零新发现，逐字段对齐。类型层 `SkillSource` 扩三态（1|2|3）、`SkillSummary` + `loadCount: string | null`（JSON string 三态）/`lastLoadedAt`、`SkillDetail` + `resources: Record<string,string>`；草稿域五类型（DraftSummary 10 字段/DraftDetail 16 字段/ScanVerdict 两值封闭/DraftAction/RejectCommand）。
- **形态**：`views/aiplatform/skill_draft/`（index 清单收口 + 3 modules——detail-drawer 判读面三节＋动作条 emit、reject-modal 单弹窗双态、promote-receipt-modal 纯回执态）；清单行内 `source === 2 && sourcePackage` 门控（自产行 self 虚拟值 `-` 占位）；路由键 `aiplatform_skill_draft` gen-route 正典 `/aiplatform/skill/draft`（与 V21 种子一致；嵌套 aiplatform_skill 由 flattenLeafParentRoutes 自动提平）。写后无条件 `getData()` 在 dialog 回调与 modal settled 钩子两处对称落位；成功且抽屉开在同目标则随行关闭（素材删除先例）。
- **E2E**：skill-fixtures 扩观测字段全行（"12345" 千分位靶/"0" 从未加载靶/null 内置靶）＋自产行（SELF_ROW source=3）＋草稿域三靶（d1 SAFE 晋升/d2 CAUTION 拒绝·findings 两条含缺键样本/d3 只读）；harness 扩 drafts 4 路由（**须在 `/skills/{id}` 匹配之前**——`/skills/drafts` 撞单段 regex）＋`applySkillDraftPromote/Reject`（技能库 push 自产新行、草稿移出活跃面、详情留档回填）＋`failNextSkillDraftPromote`(409 SKL_016)/`failNextSkillDraftReject`(400 SKL_018)＋菜单叶 250/权限码三枚。
- **code-review 修正（双轴 review，紧随本票；修后 47/47+68/68+43/43 复绿）**：① **slot 映射内联模板串绕过 constants 单点**（Standards 轴硬伤）——草稿页两处 `$t(\`…skillAssignment.slot.${slot}\`)` → `$t(skillSlotLabel[slot])`（CONTEXT grilling 段自己写着「复用 skillSlotLabel 先例」，两行修复）；② **拒绝理由 `maxlength="500"` 臆造上限**（Spec 轴）——契约无长度限制，静默截断终态留档理由 → 删 maxlength/show-count；③ resources pre `dark:bg-#333` 与全仓既有 pre 形不一致 → 统一去掉。判断项不修记录在案：promote 回执直读 `self`（回执＝核对面，与 D11 清单扫视面分治自洽）；fmtVal 与 formatFmValue 子集孪生、desc-grid 第 5-8 份、pickRowAction 第 2 份/localFmt 第 4 份（文档化容忍至第 8 份）；`source === 2` 字面量（文件既有 idiom）。
- **顺带修正（独立 commit）**：agent-config e2e 存量断言漂移——aa072c7 把默认值预览改「查看默认」弹层但断言仍查内联灰字，41/42 红 → 断言对齐现 UI＋补弹层交互断言 43/43（stash 法证实 HEAD 上即红，非本票回归）。

### 2026-09-29 #71 联调收口：草稿域＋观测扩展真实链全量走查通过 ✅（admin-web :3001 → admin :8081 → aiplatform :8888）

**API 全触达 + UI 真链走查 16/17**（运行中 admin 已含 #92/#93/#94——无需重启；深链 `/aiplatform/skill/draft`＝V21 正典再证）。收域标准对照（#56 四项同构）：① 域内全端点 happy path ✅（读面：drafts 清单 3 条/详情 16 字段×在途·终态两态/技能清单/技能详情×内置·安装·自产三形制；写面全触达——promote/reject 各 1 真且全链成功）；② 写操作留痕落库 ✅（两写回执与终态详情 operator 均＝**超级管理员**＝X-User 头注入→provider operator 列；reviewedAt 落定、rejectReason 原文回读）；③ 边界负例 ✅（404 SKL_015＝7015、400 SKL_018＝7018 空白+纯空格两形、409 SKL_017＝7017 三方向——已拒再晋升/已晋再晋升/已晋再拒绝，文案「终态不可再审——重提为新草稿」）；④ 签名负例属机机面——全链成功即正向证据（#65 口径）。

- **观测扩展真链三态全实证**：`loadCount` **string 形态**——内置 prd-writing `null`（内置不适用）/ 安装 selftest-live-check `'1'`＋lastLoadedAt（**真 load 实际发生**——#260 活体资产真加载过一次，指派/启停不计数口径印证）/ promote 新晋行 `'0'`（从未加载）；`resources` 三形全 `{}`（内置/无 scripts 安装包/a-only 自产——`Map.of()` 出空对象在场）；自产行 `source=3`·sourceName「自产」·sourcePackage/version 双 `self`。
- **UI 走查**（一次性脚本 /tmp 用后即删，#65 先例）：草稿页真数据渲染（3 条在途、三槽位映射、倒序、判定 tag）→ 抽屉判读面（真 SKILL.md 正文＋「无发现」＋血统 run mono）→ 晋升链（$dialog 对账→回执 modal→清单 3→2）→ 拒绝链（NModal→回执态留痕三件含「超级管理员」→清单 2→1）→ 技能管理页（自产行入列「自产」＋`-` 占位、详情「从未加载」/self 直读/无 scripts 节、安装行使用次数 1＋最近使用时刻）。**唯一 FAIL＝走查脚本断言自身缺陷**（读 `modal.first().textContent()` 撞 `$dialog` leave 残影收窄不足）——晋升回执事实由技能库自产行五断言＋API 回执行状交叉证实，非产品问题。
- **SKL_016 撞名未真链构造**：前置「技能库已有同名技能」在现数据不可得（库 2 行与在途草稿不同名；构造需先入同名技能再 promote）——mock e2e（failNextSkillDraftPromote 409）＋admin 侧 RBAC/契约测试已钉，留档不补。
- **环境数据留档（写面还原）**：promote 产生的自产行 subagent-live-check 已 uninstall 还原（技能库复核 2 行原状：prd-writing＋selftest-live-check）；**终态草稿留档不可逆**（reject main-live-check-v2＝理由已标注「联调验证」、promote subagent-live-check 留 status=2 痕——草稿本待人审，终态归宿正常）；在途剩 1 条（main-live-check，#260 线产物）。

### 2026-09-29 #72 grilling：指派配置页预检三态呈现（消费 admin #90 第 16 端点——precheck 1，BFF 已就绪 swagger 54）

票面留「触发时机」本票 grill 定，两轮 7 决策全按推荐定稿（Q1–Q7）。实现 spec = 新票（ready-for-agent，见 #72 评论链接）；真链联调收口归 #72。

- **触发时机（Q1）＝手动预检按钮**：保存行加「预检」钮点了才调（传点击时勾选清单快照）；否决编辑后自动（15s 模型调用随编辑停顿出发＋竞态）与提交前强制（每次保存强加 15s 税＋事实造两阶段确认流，反转 #68「无确认直接 PUT」定稿）。**票面「确认框」前提按实际形态收敛**——#68 无确认弹窗，预检传的是结果区上方当前候选快照（后端 session 想象的前提，契约不变）。
- **作用域（Q2）＝每槽签面板内**：预检钮与保存钮同排（`hasAuth(skill:assign)` 同码门控，无新权限码）；端点按槽位寻址（`/{slot}/precheck`）、PUT 亦每槽一发，页面级齐检不符契约粒度。
- **三态视觉（Q3）＝NAlert 单块居保存行下方**：hints 非空→warning「发现 N 处方法论重叠」＋逐条四字段标签化（涉及技能/对照/重叠/消解方向）；hints 空→success「未发现方法论重叠」；executed=false→**info 中性**「预检未执行——结果未知」（绝不 success 色）。loading＝预检钮自身 loading；**发起即清旧结果**（防新旧混淆）；预检与保存互不禁用（非阻断双向）。
- **失效标注（Q4）＝保留＋标注**：清单变更后（含在途）旧结果保留、标注「清单已变更——结果对应上次快照」（快照 id 集 vs 当前勾选派生比较）——参照 hints 消解重叠时编辑动作不抽走参照物；下次预检/切签自然消亡。
- **空清单（Q5）＝禁用预检钮**：重叠判定对象是候选技能（`skills`＝涉及的候选技能名），候选空则判定无对象。
- **null 呈现（Q6）＝「—」占位**：counterpart/overlap/resolution 三 String 可 null（模型输出解析态），字段行保留恒定结构，不臆造兜底文案。
- **切签存亡（Q7）＝随面板卸载丢弃**：NTabs display-directive if 卸载重挂，与未保存勾选同命（既有行为一致性）。
- **契约事实（api-docs 实读）**：`skills` 是**技能名清单**（非柄——结果区直渲无需 id→名映射）；executed=false 时 **hints 恒空**（契约保证，无「未执行但 hints 非空」防御分支）；对照双头＝生效工作协议 ∪ 该槽已指派启用技能 ∪ 候选集内其他技能（subagent 槽无运营配置正本：对照＝已指派＋候选集）；错误族与 PUT 指派同源同码（400 SKL_011/404 SKL_001/404 SKL_010，走 onError 信封透传）。**客户端超时覆写 30s**（`@sa/axios` 默认 10s 会先于后端自身 15s 超时掐断、抢走 executed=false 降级回执——预检调用须带 `timeout: 30_000`，勿当冗余参数删）。

### 2026-09-29 #72 收口交付：指派配置页预检三态点亮 ✅（mock E2E 52/52 两轮绿＋九域全量回归绿；spec #73 grill Q1–Q7 全按推荐）

手动预检钮（每槽面板动作行、`skill:assign` 同码、空清单禁用、发起即清旧、不重试）＋三态 NAlert（重叠 warning 逐条四字段／无重叠 success／未执行 info 中性——红线落地）＋stale 派生标注＋非阻断双向＋切签随面板丢弃；**timeout 覆写 30s**（`@sa/axios` 默认 10s 会先于后端 15s 自身超时掐断、抢走 executed=false 降级回执——勿当冗余参数删）。code-review 双轴：e2e/README 补册（硬项已修）；判断项记录在案（四字段同形模板＝Q6 结构恒定、双 computed 三态级联、null 计数断言前瞻脆弱）。

### 2026-09-29 #72 联调收口：预检真实链全量走查通过 ✅（admin-web :3001 → admin :8081 → aiplatform :8888——技能线 20 端点收官）

**API 三方向＋错误族全实证＋UI 真链走查 7/8**（唯一 FAIL＝走查脚本断言自身缺陷，见下）。收域标准对照（#56 四项同构）：① 端点 happy path ✅——**clean**（main 单候选 executed=true hints 空，2.6s）／**overlap**（subagent 双自测技能候选，6.3s 真模型判定四字段全：counterpart＝对侧技能名形、overlap/resolution 中文长文直读）／**工作协议对照负向**（main 单自测技能候选 vs 需求梳理工作协议＝无重叠，6.4s——双头对照跑通）；② 留痕不适用（precheck 只读不变异——探针技能 install/uninstall 各留痕 1 条系 #65 已验收路径顺带再证）；③ 边界负例 ✅——400 SKL_011（7011 内置柄）/ 404 SKL_001（7001 未寻址 TSID）/ 404 SKL_010（7010 未知槽位）三发全中，与 PUT 指派同源同码、HTTP 状态与业务码分立；④ 签名负例属机机面——全链成功即正向证据（#65 口径）。

- **executed=false 真链不可构造**（#71 SKL_016 同款留档）：该态需 provider 侧模型判定故障/超时/输出不可解析，admin-web 侧无法诱发——mock E2E 三态断言已钉（52/52）＋北向 swagger @Operation 两态纪律自描述。
- **真模型逐次输出变体（意外实证）**：同一候选集两判——curl 首判 skills＝双候选清单、UI 走查次判 skills＝单候选＋counterpart 承载对侧技能名。skills 列哪些候选由模型裁量，UI 对两种形都正确渲染（契约容差落地）；两判 null 三字段均未出现。
- **UI 走查**（一次性脚本仓内跑用后即删，#65/#71 先例）：正典深链 `/aiplatform/skill/assignment` → subagent 双勾 → 预检（真 6s loading 在途可见）→ overlap 警示真模型内容直读 → 取消一勾 stale 标注 → 保存钮全程可点（非阻断）。7/8：FAIL 项断言「全文无—」撞真模型中文行文「——」散文破折号——null 占位计数断言只在 mock fixtures（刻意无散文破折号）下成立，产品行为无缺陷。
- **环境数据留档（写面还原）**：探针技能 selftest-progress-report（本地仓 `/tmp/precheck-overlap-skill-72` 构造真重叠用——#65 冒烟仓先例保留可复装）已终卸还原，技能库复核 2 行原状（prd-writing＋selftest-live-check）；三槽指派全程空（本票只读走查不变异指派）；uninstall 留痕跨卸载存活（契约先例）。

### 2026-10-08 #74 grilling：设计线四项增量（订单类型列＋设计资产包下载＋对话史来源标注＋按张计价呈现——消费 admin BFF 设计线 admin#96–98 已合 develop，BFF 55 端点、零新码零新菜单零新路由）

- **订单页**：① 清单加「类型」列＋详情栅格类型项——NTag 三色 Record（1=设计 info／2=系统 success／3=系统＋设计 warning）＋`deliverableTypeName` 直读（ADR-0009），列位 status 后、amount 前；无类型筛选维度（已备案）。② 下载**单按钮自适应**（Q1）：详情抽屉操作行既有「下载源码包」按 `deliverableType` 切换文案＋端点（2=系统→源码包实时打包；1/3→设计资产包冻结件，3 型统一部件容器含系统部件即全覆盖）——3 型失去直达源码包入口系有意取舍（实时源码诉求走项目页文件包，不同件）；「互斥/不可达不出现」先例（错配 404 ORD_016 不上台面），错误态零专属处理（onError 透传 toast 兜底）。③ 写路径回执零增量——三写回执本就纯 toast（OrderWriteAck 不渲染先例），「回执同字段对」是契约事实非 UI 义务。
- **项目页对话史**：**行内标注**（Q2）——平铺时间线保持，`sessionSource=2` 条目在 kindName 右侧加 NTag size=small type=default 灰阶 tag 显 `sessionSourceName` 直读（Q4），null 不渲染（缺省=主会话；降级口径下作用域改稿发言不标注——**勿当未知值补归属**，此为否决分组的决定性约束）；不加来源过滤器（零加戏）。报价素材承接面＝既有交付文件 tab＋设计资产包下载，落选稿不专门呈现。
- **单价表**：增量收敛两处——`PriceTokenKind` 扩 1-6＋`priceTokenKindTagColor` 补 6=default 灰（五色已占满，按张「非 token 档」灰系自成一档）；tokenKind 无任何下拉/options（筛选仅 provider/model 两文本框），unitPrice string/number 不对称 T6 已消费（原串直灌＋提交转 number）零改。
- **成本中心**：**零代码增量**——unpriced 表 tier 列 `tokenKindName` 直读、数量列 formatCount，按张行自动正确呈现；五档 tiles/双柱状按 `TOKEN_TIER_KEYS` 迭代天然不含按张（契约：分解不含按张）；cost 桶混算无从区分亦不需区分。tokens 列头「无价 tokens」保持不改（Q5——tier 名自释单位，零 i18n 改动）。
- **横切**：`deliverableType`/`sessionSource` Integer code（JSON number）＋`*Name` 直读； typings 三处补对（OrderSummary/Detail/WriteAck、ConversationEntry、PriceTokenKind）；i18n 新键三处同步（类型列名/设计资产包按钮与成功文案）；E2E fixtures 补类型对/来源标注/六档行（house 范式）。

### 2026-10-08 #74 交付：设计线四项增量点亮 ✅（#76 订单类型＋下载自适应 / #77 对话史标注＋单价表六档＋成本钉子——spec #75 两轮 grill Q1–Q5 全按推荐）

- **#76 订单域**（commit `384e348`）：清单「类型」列＋详情栅格类型项（status 后同位，NTag 三色 Record 1=设计 info／2=系统 success／3=系统＋设计 warning＋`deliverableTypeName` 直读，ADR-0009 零端侧映射）；下载按钮按 `deliverableType` 自适应（2=系统→既有 source-package；1/3→新 `design-package` 端点 tar.gz 冻结件 blob——3 型无源码包入口系有意取舍），复用 `saveBlobFile`（Content-Disposition 文件名优先＋端侧兜底）＋分型成功 toast；错误零专属分支（onError 透传——按型门控使错配 404 ORD_016 不可达）。typings 三 DTO（Summary/Detail/WriteAck）补类型对＋i18n 三处；order mock E2E **43/43 两轮绿**＋十域全量回归绿（三型样本＋两下载路由计数分立断言）。
- **#77 三域小增量**（commit `96d72f9`）：对话史 `sessionSource=2`（设计会话）条目 kindName 右邻灰阶小 tag 直读 `sessionSourceName`；**null=主会话缺省不渲染任何标注**（勿当未知值补归属），时间线平铺不分组、零来源过滤器；typings 补 `sessionSource: number | null`＋`sessionSourceName: string | null`（JSON 在场为 null 非字段缺省）。单价表 `PriceTokenKind` 扩 1-6＋标签色 Record 补 6=default 灰（1-5 五色已占满、「非 token 档」自成一档），按张行呈现/改价/停用全复用既有链路零视图改动、unitPrice 串/数不对称既有消费零改。**成本中心 src 零增量**——unpriced 按张行（tokens=张数）经 `tokenKindName` 直读＋formatCount 自动正确，以 e2e 契约钉子防未来端侧键控标签化时炸（五档 tiles 不含按张同步钉死）。project **94/94 两轮**＋全量十域 **535 断言**回归绿。
- **code-review（双轴，#78 联调收口时补跑——两 commit 落地时未走 review，#78 补审 `384e348^..HEAD` 全量）**：Standards 轴**硬违规零**（i18n 三处齐／ADR-0009 直读／trust-UI-gating 零防御分支／请求层无裸 fetch 全落实），判断项记录在案：① e2e `tagBg` 背景色 helper 第 3 份逐字拷贝（skill-assignment 起，一次性脚本范式容忍至第 8 份口径）；② NTag 渲染形状列/栅格两份（Soybean 列/详情拆分惯例，低价值抽取）；③ `sessionSource === 2` 模板裸字面量（同文件 `entry.kind === 3` 先例，契约仅 2/null 两值）；④ project e2e 平铺断言锚 DOM 父容器结构（spec 钉死项的最便宜代理，贴边可接受）；⑤ 注释裸 `#96` 需猜所属仓（微）。Spec 轴**全过零疑误**：typings 用 `OrderDeliverableType` 字面量联合窄于票面裸 `number`（OrderStatus house pattern、intent 保留）；e2e 下载按钮只点 2/3 型（1/3 共支路未测面为零）；双柱状不含按张系结构性非断言（byModel 仅五字段）。

### 2026-10-09 #78 联调收口：设计线真实链全量走查通过 ✅（admin-web :3001 → admin :8081 → aiplatform :8888——BFF 55 端点全触达，母票 #74 收口）

**API 层全实证＋UI 真链走查 27/27**（唯一补跑一轮系走查脚本 CJK `\b` 断言自身缺陷，产品行为零问题）。收域标准对照（#56 四项同构）：① 新端点 happy path ✅（design-package 三态真下载：1 型冻结包／3 型统一部件容器／取消残留照取）；② 留痕不适用（纯读端点，类型对字段经订单三出口实读）；③ 负例三发全中 ✅（404 ORD_016＝5016 系统单取设计包／404 ORD_001＝5001 不存在单／404 PRJ_051＝4051 冻结件缺失——docker 移走冻结件构造后还原复跑 200）；④ 签名负例属机机面——全链成功即正向证据（#65 口径）。

- **三型真单经真实用户流造数**（非 DB 注入）：登录 OIDC → `endpointType=1` 一句话建项目（山雾咖啡双设计物）→ 访谈 12 问自动作答收敛 → PRD 产出 → 设计轨真模型产出（主徽标位图三稿＋首页位图三稿，出图走 volcano 按张计量）→ 两件各定稿稿1（稿2/稿3＝落选）→ **下单 1 型单**（366790499140375855）→ 取消 → 切终点 3 → **再下 3 型单**（366790818035764758，赶在重产轮收口前落冻结）——订单清单三型齐（3/1/2/2），待报价行类型对有值（amount NULL 行类型照显）。
- **设计资产包 tar.gz 解开验证**：1 型包＝`DESIGN.md`（品牌色板 7 token＋风格＋遵守条目——出图 palette/style 参数转正物化）＋选定稿×2；**落选稿（稿2/稿3×2）不入** ✓；3 型统一部件容器＝工作区树剪枝（src/、docs/PRD.md 等 14 文件，AGENTS.md/规范侧车结构性不入）＋设计部件显式追加 ✓。Content-Disposition `{orderId}-design.tar.gz`、application/gzip。**帧衍生未 live 覆盖**——两件均平面类位图稿（media=image），界面类 HTML 稿 live 路径有 provider 缺陷（见 aiplatform#303 发现一），帧衍生渲染归 provider 侧 docker LiveTest 证据（chromium PNG 魔数已钉）。
- **系统单源码包回归**：休眠沙箱唤醒（355998826453863864 封存深度唤醒→运行中，WSP_002 1002 数据态先证后愈）→ 200/136KB/tar 52 件/CD `356710602611360985-source.tar.gz`。
- **对话史混排**：41 条＝37 null（主会话）＋4×`sessionSource=2`「设计会话」（首产收尾×2＋定稿收尾×2）；UI 恰 4 枚灰阶 tag、null 零标注。
- **按张两处真数据**：单价表 2 行（zhipu/glm-image 0.1 CNY＋dashscope/qwen-image-3.0 0.18 CNY，经 provider 官方开行通道种入、操作者落空＝种子口径、2026-01-01 敞口）——**volcano（当前出图供数方）刻意不配价**，出图 7 张进成本中心 unpriced 按张行（`tokens="7"`＝张数）——「漏配价」正是 unpriced 警示卡的设计场景，AC4b 由真用量点亮而非记录数据态；五档 tiles/双柱状不含按张（契约钉死）。
- **provider 活体走查两发现 → [aiplatform#303](https://github.com/ZhangColin/aiplatform/issues/303)**（跨仓提 issue 不改码）：① 界面类 HTML 稿收口判据 live 必不过——harness write_file 落稿变更路径无前导斜杠 vs `designAnchored` 要 `/design/`（GenerateImageTool #292 显式补斜杠故图片路通；seam 测试 stub 锚定形路径盲区），三尝试全败重试超限、10 份 HTML 在盘不被识别；② PRD 清单章形态偏离（章序号前缀＋验收要点编号混入）——首轮「形态偏离设计不派」、修正后验收要点被解析成 12 件设计物，二次精确意见后才收敛 2 件。本仓消费面零影响（订单/包/对话/按张全通）。
- **环境数据留档**：设计项目 366576215829955473（未命名项目——LLM 取名未落、占位保留）留档不删（订单/对话/冻结件的活体样本）；1 型单留已取消态（取消残留＋不按支付态门控的实证锚）；3 型单待报价态；轻简待办沙箱唤醒后留运行态（自动休眠策略自收）；单价表 volcano 行持续未配价（unpriced 警示长明＝漏配价可观测的正例，后续如需消除经 provider 种子脚本补种即可）；走查脚本 /tmp 用后即删未入仓。

### 2026-11-03 #79/#80 grilling：aiplatform A 批＋B 批对接（合同六态新页/付款核验/生产承接/模型通道·档位两新页/智能体配置档位化）——两轮 18 决策全按推荐定稿

A 批（#79，admin BFF A1–A6：55→74 端点、33→50 码、菜单 V22 合同叶 260）＋ B 批（#80，B1–B4：74→90 端点、50→58 码、菜单 V23 两叶 270/280，决策正本 aiplatform ADR-0031）一场 grill 覆盖。实现 spec 两份（A/B 各一，`ready-for-agent`）＋各拆三票顺序施工，mock E2E 两轮绿合入，真实链联调收口各归母票。**A 先 B 后**（B 批配置页档位下拉依赖档位页读口；两批互相独立）。

- **契约正本**：本地 :8081 未运行——按 T8 口径读 admin 仓 HEAD 源码/DTO `@Schema`（A/B 批全在 develop）；联调前须起含 A/B 批构建的后端。票面端点清单为对接近似，以 admin HEAD 为准。
- **grill 期源码核实的四个关键契约事实**：① **designer 第三座**——B3 给 agent-configs 加 `designer`=设计执行体（三座 main/executor/designer），前端现只有两座（`AGENT_KEYS=['main','executor']`），配置页改造的隐藏增量；② **routingStrongModelId 挂座级**——三座响应同 record 均带强档三件（生效值/覆盖标记/默认预览=pro），PUT 命令体同扩（四字段全量回传→五字段），档位键即时校验 PRJ_074（缺行 4074）/075（停用 4075）；V44 存量已刷档（无裸名旧数据兼容面）；provider 读面另带路由开关/两阈值六件不镜像；③ **订单响应不带合同在场标志**——「创建合同」按钮无法按可观测态门控；④ **回执形状**——合同七写（createForOrder/advance/fail/withdraw/void/sign/record）全回 `AiplatformContractResponse`（**单段合同体非三段 detail**）；生产 update/advance 回执＝detail 同形**含 transitions**（applyDetail 直填先例适用）；付款三写回 `PaymentPlanResponse`（不含历史/时间线全量）；B 批 CRUD 回实体行、DELETE 回 data=null。
- **A 批切片（Q2）**：T1 合同管理页（9 端点＋叶菜单＋订单抽屉创建入口）→ T2 付款核验（5 端点＋订单抽屉改 tabs）→ T3 生产承接＋订单域增量（4＋1 端点＋词表＋scope＋双版本字段）。**B 批切片（Q3）**：T1 模型供应商页（7 端点）→ T2 模型档位页（6 端点）→ T3 智能体配置改造（edge 3 端点＋designer 座＋档位下拉＋强档字段对）——顺序即依赖。
- **合同页（Q4–Q6）**：照六域先例（清单 flex-height+sm:h-full／筛选 status 多选逗号＋createdFrom/To＋orderId＋contractNo／分页 1-based 新在前）＋详情 NDrawer 720 三段（contract 全字段含 needsUpdate warning tag「需更新」**清单行与详情双现**＋范围快照冻结三段＋双方签署位/落签时点＋PRD/Demo 双版本引用／prdSnapshot 全文 pre／transitions NTimeline 新→旧六类）。七写**双入口**（行下拉＋抽屉动作条，草稿/素材先例）＋六态×动作门控矩阵收 constants 单点（`availableContractActions`，workspace 先例）；basis 必填 ≤1000——advance/fail/withdraw/void 四动作共用「basis-only 确认 modal」单组件、sign 加 party 单选（1=甲方 2=乙方）、record 整组表单五肢（仅草稿态 1/2 可达）；**advance 3→4 双签门禁按可观测签署位门控**（未双签不出推进钮，ORD_027 兜底竞态）；回执不消费——toast＋详情回读＋列表刷新。**创建合同入口＝订单抽屉动作行按钮常给＋hasAuth（contract:create）**，在场/可建由服务端 409 裁决透传，成功不跳转（清单入口用 orderId 筛选自然可达）。
- **付款核验（Q7）**：订单抽屉**改 NTabs 两签**（基本信息＝现有单列内容原样入签＋付款核验新签）——项目抽屉五签先例。核验签分节：计划概览（附言码 mono＋开工门标志）/节点表（五态·statusName/金额/累计核到账）/凭证清单（点行看证＝**下载 blob**，无信封、saveBlobFile＋Content-Disposition 文件名）/核验留痕时间线/历史计划行收起态。三写：节点录入整组替换 modal（**不预判重录窗口**——可观测推导复杂易漂移，ORD_044 服务端裁决）、核验 modal（actualAmount 元转分＋arrivedAt＋voucherId 凭证清单选＋channelRefNo＋basis）、打回复用 basis-only modal；全额判定归 provider 不预判；`payment:*` 三码分别 hasAuth；回执不消费——toast＋回读 plan detail。
- **生产承接（Q8）**：项目抽屉**第六 tab**；desc-table（联系人/下一步/进展/预计开始——null 如实「—」）＋两态 tag＋留痕 NTimeline（创建行 operatorId=system「系统建档」如实呈现）。三动作：信息更新整组替换 modal（**表单空＝清空**终态语义表单明示）、推进 $dialog.warning（已生产中不出钮，409 PRJ_056 兜底）、需用户补充 NSwitch 受控＋确认（回执 data=null 不消费）。update/advance 回执含时间线→**applyDetail 直填整签免二次回读**（沙箱 T4 先例）；supplement 回 null→toast＋回读。
- **订单域增量（Q9）**：① scope 三段录入＝订单抽屉动作行「范围录入」（order:scope 码，**按未支付态 status 1|2 门控**——quote/cancel 同款，ORD_033 兜底）modal 三 textarea 整组（空＝清空该段）；② 词表 statusName 直读（ADR-0009）**前端零改**、操作位无变化；③ 新字段＝订单详情 desc 加 prdVersionNo/demoVersionNo 两行＋scope 三段（未录入「—」），清单不加列；④ **ORD_047 取消关门维持透传不判码**（后端文案已含「需求变化走对话区」指引，联调核实）；成本中心 token 对账口径**不造说明位**（零加戏）。
- **供应商页（Q10）**：无分页清单全量直灌（技能页先例）；列 providerKey(mono)/baseUrl/apiKeyMasked(null＝未配置「—」)/enabled tag/最近写者/操作。创建 modal（apiKey 明文唯一写口）；更新 modal（baseUrl 预填终态替换、**apiKey 留空＝保持** placeholder 明示、enabled 开关预填显式传）；删除 $dialog（被引用 409 PRJ_072 透传）；留痕 drawer（apiKey 快照恒掩码）。**远端清单拉取＝行动作 → POST → 对照 drawer**：条目表（modelId/status 如实转述/trackedTierKeys 空＝「建议入库」）＋staleTiers「已过时」区块；**入库＝drawer 内嵌轻量表单**（勾选＋行内语义键输入 → 直接 POST /model-tiers，providerKey＝本通道、modelName 预填所选 modelId；hasAuth `model-tier:create` 跨域码如实门控）——**否决跨页跳档位页引导**；每次真拉无缓存、失败 502 PRJ_077 透传不静默。
- **档位页（Q11）**：无分页清单；列 tierKey/providerKey/modelName(mono)/displayName(null 回落 tierKey)/enabled/最近写者/操作。更新 modal 三肢不同（providerKey/modelName 终态替换预填、displayName **空＝清空回落**表单明示、enabled 显式传）；删除守卫 409 PRJ_073 透传；留痕 drawer 时间倒序。**回滚＝per-trace「回滚」钮 → 打开预填表单（非直接 PUT）**：行在＝编辑 modal 预填旧值（apiKey 除外——留痕只有掩码须重输全量，表单明示）；行已删＝创建 modal 按旧值预填重建（agent-config 时间线回滚是直接 PUT old——本域因 apiKey 掩码不可直写改预填形态）。**留痕跨行存活零特判**（入口挂行、行删入口自然消失，traces 端点容错是后端纪律前端无从到达）。
- **配置页改造（Q12）**：`AGENT_KEYS` 扩三座（+designer「设计执行体」，panel 零改寻址键参数化）；每座编辑卡 **modelId＋routingStrongModelId 双档位行同范式**（下拉＋覆盖标记＋默认预览灰字）；PUT 四字段→**五字段全量回传**（null＝清空回落，blankToNull 同款）；留痕渲染扩强档 old/new 对。**档位下拉**：数据源 `GET /model-tiers` **页面级拉一次共享**（指派页技能清单先例，Q18）；选项 label＝displayName??tierKey＋modelName 辅助灰字；**停用档 option 带「已停用」tag＋disabled 不可选**（如实呈现不过滤＋不可作新绑定，PRJ_075 兜底竞态）；已绑定后遭停用＝下拉显示现值＋旁挂停用 warning tag。
- **边缘四点（Q13）**：**合一签「边缘调用点」**（签内四块纵排：naming/compaction/classification/precheck，每块＝窄面板——档位下拉行＋覆盖标记＋默认预览＋留痕时间线收起态）——否决每点一签（8 签过挤、点值面仅一件下拉单独成签太空）；「座＝签、边缘点＝块」层级语义；窄面板组件同款复用不受布局影响（工具面签内三槽位块同构）。
- **横切（Q14/Q17）**：`views/aiplatform/contract/`（两段键）＋`model_provider/`/`model_tier/`（三段键产纯父中间键 `aiplatform_model` 补键「模型」，price 先例；下划线目录）；i18n route 键 4＋page.* 双语三处同步；六态/五态/两态 statusName 直读零端侧映射；**读码门控签显隐**——付款核验签 payment:read/生产承接签 production:read/边缘调用点签 agent-config:read（无码＝签不渲染，account-profile 嵌件先例），三座签与工具面签维持现状不设门控。E2E：新域 fixtures 六套＋harness 扩展（合同态机 applyContract* 就地变异、verify 累计核到账模拟、remote-models 对照样本含建议入库/过时两态、edge 四键）＋全量回归；联调＝#56 四项收域标准，合同六态与付款核验真链造数策略联调时定。**票面「前端按数字码分支」按 standing 决策收敛为不分支、透传 message**（#56 定稿零冲突）。
- **术语**：glossary 补 6 条（合同/付款核验/生产承接/模型供应商·通道/模型档位/边缘调用点——双词制照沙箱·工作区先例）。**零 ADR**（全先例延伸，无一满足难逆＋意外＋真权衡三条件）。

### 2026-11-03 A-T1 交付：合同管理页点亮 ✅（#87，#79 A 批之一——六态清单/详情三段/七写动作＋订单抽屉创建入口，合同域 9 端点）

mock E2E（contract **63/63 两轮全绿** + 既有十域全量回归绿：order 43 / project 94 / workspace 48 / cost 46 / price-entry 48 / material 46 / skill 68 / skill-assignment 52 / skill-draft 47 / agent-config 43）＋ typecheck/lint 干净。验收十条全过：清单契约字段＋四维筛选（status 多选逗号/createdFrom·To/orderId/contractNo）＋分页 1-based 新在前直读／needsUpdate「需更新」warning tag 详情现（见下契约偏差）／详情抽屉 720 三段（contract 全字段含范围快照冻结三段＋双方签署位·落签时点＋PRD/Demo 双版本引用、PRD 全文、transitions NTimeline 新→旧六类）／七写双入口＋门控矩阵 constants 单点＋八码逐写 hasAuth／basis-only 共用 modal×4＋sign party 单选＋record 五肢整组／advance 末边双签可观测门控（ORD_027 failNext 竞态透传）／订单抽屉「创建合同」常给＋409 ORD_024 透传＋成功不跳转／回执不消费（toast＋详情回读＋列表刷新）／路由两段键对齐 V22 种子 260＋i18n 三处同步。

- **契约偏差钉子（grill 后核实 admin HEAD）**：spec/GLOSSARY grilling 段口径「needsUpdate 清单行与详情双现」——但 admin HEAD `AiplatformContractSummaryResponse` **无 needsUpdate/签署位字段**（provider BackofficeContractSummaryResponse 源头即无）。按 standing decision「契约正本＝admin HEAD」执行：**needsUpdate tag 与双方签署位仅详情段呈现**（清单行不可观测——「扫视需更新」能力受限于 wire，如需清单徽标须后端补字段，另立票）。同理 **advance 末边双签门控在行下拉不可观测**：矩阵单点 `availableContractActions` 收 `{status, partyASigned?, partyBSigned?}`——行传 undefined → 3 态不出推进（保守，末边推进走抽屉），抽屉传详情实值 → 双签后解锁；ORD_027 兜底竞态以 `failNextContractWrite` 注入断言。
- **门控矩阵（六态×七写，constants 单点）**：终态 4/5/6 全拒；advance 1/2 恒给、3 须双签；fail 仅 2/3；sign 仅 3（已落位幂等拒 ORD_028 服务端裁决——party 选项不按已签 disable，e2e 以重复落甲方断言 409 透传）；record 仅草稿 1/2；withdraw/void 自任何非终态（守卫同、留痕 action 分立）。行下拉＝status-only 矩阵 ∩ hasAuth；抽屉动作条＝全 meta 矩阵 ∩ hasAuth。
- **形态**：清单/筛选/分页照订单域形制（status 多选逗号单值、createdFrom/To 本地串 tsToIso）；详情抽屉 720 三段照素材/草稿先例（动作条置顶 emit 回父页收口）；**六写弹窗收口形态**＝advance/fail/withdraw/void 共用 basis-only NModal（cancel-modal 先例：basis 必填空禁用＋失败保持弹窗）＋sign 加 NRadioGroup party（必选）＋record 独立五肢 NModal（抽屉入口预填四预览字段、行入口空表单；空白归一 null 显式传——provider blankToNull 同款）；创建合同＝订单抽屉动作行按钮常给（`CONTRACT_CREATE_AUTH` 单点）→ 父页 $dialog.warning → 无请求体 POST → toast 不跳转不刷新（订单态不动）。
- **E2E**：contract-fixtures（六态 12 行两页——撤回/作废同态不同动作对行、动作六类跨行全覆盖、needsUpdate 草稿锚、重建对行 SG-8JUQ0Z→SG-8JTL5M）＋ harness applyContract* 六写与创建**行·详情双端就地变异**（守卫族自然裁决 ORD_020/021/022/024/025/027/028/031——ORD_024/025/027/028 全走自然/注入双路）＋权限码 8 枚/菜单叶 id=260（V22 种子镜像）＋ order-fixtures 增 ...06 英语晨读陪练详情（创建流目标单，既有用例不涉）。签署→末边推进全流（未签无推进钮→落甲方仍无→落乙方解锁→failNext 409→成功 3→4 终态动作条清空）是态机主链断言。
- **code-review 修正（双轴 review，紧随本票；修后 63/63 两轮 + order 43/43 回归绿）**：① 删范围快照三段不可达 `?? '-'` 兜底（冻结集 typings 钉非空——standing rule「门控可达不写防御性」，T4/T5 review 同型）；② action-modal 五连嵌套三元 → basis-only 四写收 `BASIS_ONLY_FETCH` Record 单点（material WRITE_FETCH 先例）、sign 因 party 独立显式分支（连带消除 else 收敛到 sign 的错路由风险面）；③ `tsToIsoLocal` 收编 utils/common（tsToIso 家族第 8 份拷贝＝本票起收编——与 `tsToUtcInstant` 并居、注释钉「两种契约形」；存量域内拷贝留待顺路迁移）；④ 抽屉 emit 载荷类型如实标 `Contract`（原标 Summary 少报四预览字段）；⑤ `contractWriteAuth` 注释「七写」→「六写」名实对齐（create 独立 `CONTRACT_CREATE_AUTH`）。review 判断项不修记录在案：action/record modal 骨架同形（quote/cancel-modal 先例容忍）；`recordTarget` 以 Summary 形传 record-modal（modal prop 预览肢可选＝行入口缺省的如实形）。spec 轴：十条 AC 全过、9 端点/8 码/V22 种子与 admin HEAD 逐字核对一致、无越权；清单行 needsUpdate/签署位不可现为 wire 契约事实（见上「契约偏差钉子」）。

### 2026-11-03 A-T2 交付：付款核验签点亮 ✅（#89，#79 A 批之二——订单抽屉改两签＋计划/节点/凭证/核验三写，付款域 5 端点）

mock E2E（payment **49/49 两轮全绿** + 既有十二域全量回归绿：order 43 / contract 63 / model-provider 76 / project 94 / workspace 48 / cost 46 / price-entry 48 / material 46 / skill 68 / skill-assignment 52 / skill-draft 47 / agent-config 43）＋ typecheck/lint 干净。验收六条全过：订单抽屉改 NTabs 两签（「基本信息」＝原单列内容原样入签零丢失——order.e2e 43/43 回归即证；「付款核验」签按 payment:read 显隐）／核验签五分节（概览 contractNo mono·总额·累计已核到账·创建时点／节点表五态 statusName 直读＋附言码 mono＋开工门 tag＋累计核到账·还需支付＋到账时点·渠道流水号随行小字／凭证清单平面点行下载／留痕时间线新→旧跨节点／历史计划行收起态）／节点录入整组替换 modal（元转分＋开工门＋不预判重录窗口——ORD_044 服务端裁决）／核验 modal（actualAmount 元转分＋arrivedAt ISO＋voucherId 凭证清单选＋channelRefNo＋basis）＋打回 basis-only modal／三码分别 hasAuth＋核验/打回另按节点 4 态门控（ORD_038 兜底竞态）／回执不消费——toast＋回读 plan detail／无计划 404 ORD_036 面板缺席（prd-pane 先例：NEmpty＋toast 透传、不判码）。

- **签面架构**：pane 自持三写 modal（挂签内——单入口签面自持，区别于合同页「弹窗在父页挂载」的双入口先例；写成功 toast＋pane reload 收口不经抽屉/父页转发）。切签 v-if 挂载即加载、切签卸载重挂天然重置（项目抽屉五签先例）；抽屉每次打开回 basic。凭证清单＝全节点 vouchers 平面（节点名列锚定）；trails 的 from/to 状态 code 无 *Name——**mono 数字如实呈现不造映射**（ADR-0009 反例豁免：wire 不带名，编映射即端侧翻译）。
- **金额口径横切**：`parsePositiveYuan`（≤2 位小数正数校验）＋`centsToYuanText`（分→元预填回显）收编 utils/common——金额弹窗「元输入提交转分」惯用法第 3 份拷贝起收编（#87 tsToIsoLocal 同款决策），quote-modal 存量改走共用件（order.e2e 43/43 回归即证）。
- **E2E**：payment-fixtures 三单——PLAN_RICH 六节点**五态全覆盖**（2/3 渠道保留位展示样本——v1 真链不产出，验证 statusName 直读零分支）＋部分核到账 8000/20000＋双凭证＋trails 三类（全额核验/部分核验/打回）＋history 一行、PLAN_EMPTY 空节点（录入流靶——重录唯一窗口自然敞开）、无计划单（ORD_036 靶）；harness applyPaymentNodes/Verify/Reject 就地变异——**verify＝provider 全额判定镜像**（settled≥amount 自动转已到账 receivedAt＝实到时间、不足回待支付累计不清零；percentage/totalAmount/totalSettled 随行重算），守卫族 ORD_036/037/038/039/041/042/044/045 自然裁决＋failNext 注入（409 ORD_044／400 ORD_041 代表样）；order-fixtures 增 ...05 实验报告批改助手详情（PLAN_EMPTY 宿主，既有用例不涉）。
- **code-review 修正（双轴 review，紧随本票；修后 49/49 两轮 + 全量回归绿）**：① e2e/README 补 payment 域条目（#87/#88 先例的 harness 文档门）；② 删 5 个死 i18n 键（node.percentage/channel/receivedAt、nodesModal.name/amount——Speculative Generality，三处同步清）；③ 基本签改用 `order.drawer.tabs.basic` 本域键（原借用 project 命名空间）；④ 金额惯用法收编（见上「金额口径横切」）；⑤ voucherColumns 读响应式改 computed／nodeColumns 无依赖改 const（倒置修正）；⑥ **核验 modal channelRefNo 不预填**（spec 轴真发现：每笔到账各随行落值，预填会把上次核验的流水号静默重交进新留痕）。spec 轴另两笔记录在案不修：概览括号「附言码 mono＋开工门标志」按节点级呈现（两字段本质是节点属性，计划级聚合属编造展示）；节点表加「还需支付」列（AC 列名之外——部分核到账可观测性的自然载体，服务 #79 全貌口径）。

### 2026-11-04 A-T3 交付：生产承接签＋订单域增量点亮 ✅（#92，#79 A 批之三——生产域 4＋订单 1 端点，scope/双版本/词表核验）

mock E2E（production-handoff **24/24 两轮全绿**＋order **52/52 两轮全绿**＋其余十三域全量回归绿：project 94 / workspace 48 / cost 46 / price-entry 48 / material 46 / skill 68 / skill-assignment 52 / skill-draft 47 / agent-config 64 / contract 63 / payment 49 / model-provider 76 / model-tier 58）＋typecheck/lint 干净。项目抽屉第六签「生产承接」按 production:read 显隐，四段 null「—」、两态 statusName 直读、留痕新→旧与系统建档均如实呈现；update 五字段整组替换（空段 null＋预计开始本地 ISO＋basis 必填）、advance $dialog.warning＋必填依据＋生产中按钮消失＋409 PRJ_056 透传、supplement 受控开关＋确认＋data=null 回执 toast 后回读；三写分别按 production:update/advance/supplement 门控。订单抽屉新增「范围录入」（order:scope ∩ status 1|2），三 textarea 整组替换、空段 null、ORD_033 透传、成功回读；详情加 PRD/Demo 双版本与 scope 三段，清单不加列；ORD_047 取消文案含「需求变化请在对话区沟通」原样透传，不判数字业务码；statusName 与成本中心零改。

- **回执口径**：update/advance 回 `ProductionHandoff` 全量详情（含 transitions）——响应即新事实直填整签，E2E 以 GET 计数不增钉死无二次回读；supplement 回 data=null、scope 回 `OrderResponse` 非详情——均不消费，toast 后回读。生产读失败沿用 NEmpty＋onError toast 先例；所有 PRJ/ORD 守卫只透传 message，不在 UI 编业务码分支。
- **上游读面缺口（如实降级，不伪造端点）**：① admin/provider HEAD 的订单详情 DTO 均不带 prdVersionNo/demoVersionNo（admin#108 明确双版本仅镜像到 `OrderResponse`），故详情 typings 将两字段标可选、null/缺省显「—」；E2E 按当前真实详情契约断言「—」，双版本仅保留在 scope 写回执 fixture，不能再伪造详情字段制造假绿。② `AiplatformProductionHandoffResponse` 不含 needsUserSupplement（布尔在项目聚合读面），开关以 null 明示「当前状态未随承接读面下发」，已确认目标值提升到项目抽屉、跨切签保留；重开抽屉仍回未知，不能声称恢复真实盖帽状态。两项均需后端补读面或母票 #79 联调时定案。
- **E2E**：production-handoff-fixtures 两项目覆盖两态、四段有值/全 null、创建/推进/信息更新留痕；harness 对 update/advance 就地追加留痕并回完整 detail，supplement 回 null；订单 scope mock 就地改详情三段并支持 5033 失败注入，取消注入 5047 钉住原文透传。词表新语义与 ORD_047 指引本轮仅以 admin/provider 源码核实＋mock 验证，未启动真实后端，真链收口仍归 #79。
- **code-review 修正（双轴 review，紧随本票）**：① 删除订单详情 fixture 伪造的 prdVersionNo/demoVersionNo，断言改为 admin HEAD 真实契约下的「—」（Standards/Spec 同指假绿）；② supplement 布尔改三态 `boolean|null`，null 明示读面未知，已确认值 v-model 提升父抽屉跨切签保留并新增重挂断言；③ `trimmedOrNull` 五份拷贝收编 utils/common（合同/通道/档位存量三处顺路迁移）；④ e2e/README 补生产承接流与 fixtures 条目。上游两项读面缺口仍记录在案，不以 mock 冒充已闭环。

### 2026-11-04 #79/#80 联调收口：A 批＋B 批真实链全量走查通过 ✅（admin-web :3001 → admin :8081 → aiplatform :8888——A 批 19＋B 批 16 端点全触达，母票 #79/#80 收口）

**链路环境新事实**：真链四件套＝admin :8081（宿主 java）＋ aiplatform provider :8888＋**app-registry :8088（必须起着——provider 入站验签 `X-Api-Key` 经 `RemoteApiKeyProvider` 查 app-registry `/api/app-registry/api-keys/{key}`，缺它全 aiplatform 面 401「Invalid app key」；Caffeine 缓存按访问过期，短期掉线不即刻断链）**＋共享 PG `aiplatform-pg`（admin 用 `semgravio` 库、provider 用 `aiplatform` 库，同实例 5432）。provider 验签三件套外还有 nonce/时间戳/body-digest（cartisan-openapi `SignatureVerificationFilter`）——admin 侧自动签名，前端零感知。

**收域标准对照（#56 四项）**：① 域内全端点 happy path ✅——A 批 19/19（合同九写含六态全走：创建→record 重录→双签→推进 1→2→3→4；付款五：计划读/节点整组/部分核验/全额核验/打回；生产四：系统建档读/整组更新/推进/盖帽；订单 scope）＋B 批 16/16（通道 CRUD/留痕/远端清单、档位 CRUD/留痕、edge 四键读写留痕）；② 写留痕落库 ✅——合同 transitions/付款 trails/承接 transitions/通道·档位 traces 的 operator 均「超级管理员」（X-User 头透传），承接创建行 operatorId=system（系统建档）；③ 分页/过滤边界＋错误族 ✅——合同清单 1-based page=2 size=2/超总页空/查无空 200、四维过滤全中；业务码 27 枚实码命中（ORD 5021/5024/5025/5026/5027/5028/5033/5037/5038/5042/5044/5045/5005；PRJ 4056/4064–4077）——含 **5044 重录窗口关、5038 非待核验态拒（前端按节点 4 态门控按钮的 wire 依据）、4075 停用档写口拒、4072/4073 引用删除守卫（边缘真绑定 409 实证）**；④ 签名负例属 admin↔aiplatform 机机面（admin 仓执行）——全链成功即正向证据（#65 口径）。

**造数策略（联调时定，单订单全生命周期）**：唯一订单 375906742886750614（语义引力官网）走完 **1→2→3→4 全生命周期**——报价 ¥1000 → scope 三段 → 合同五份（fail/withdraw/void 三终态 + 双签推进签署完成主链 + 已支付后重建 5021 守卫观察）→ 付款两节点（首付开工门部分 ¥200→补足 ¥300 自动转已到账；尾款打回）→ 订单 3（已支付＝开工条件满足双门禁，paidAt 落定）→ retry-archive 手动归档 4。**两处触发源缺失以 DB 置位模拟（#52 先例）**：节点入 4 态（线下转账待核验）——管理面无入口，`UPDATE ord_payment_nodes SET status=4`（aiplatform 库）模拟用户侧 submitVoucher，核验链路本身全真。UI 真链走查 **33/33**（真登录/动态菜单 V22+V23 叶/合同页四行/订单抽屉两签·¥1,000.00 千分位/生产承接签·含 NEmpty 空态分支——四个同名「语义引力官网」项目误开其一，反而实证空态；B 批：掩码 ****66e1/真拉火山方舟 55 条对照 drawer/种子三档/三座＋边缘四点签）。

**真 bug（provider，aiplatform 仓）**：`BackofficeContractQuery` 构造器 `contractNo != null && isBlank() ? null : trim()`——null 时走 else 直接 NPE，**GET /contracts 不带 contractNo（默认清单）必 500**。已提 [aiplatform#389](https://github.com/ZhangColin/aiplatform/issues/389)（含一行修法建议；跨仓不动代码，修复归该仓定夺）。mock E2E 不可能发现（page.route 不经 provider）——联调收口的存在意义实证。

**契约事实与发现**：① **PUT 通道/档位＝全量终态替换**：partial PUT（只传 enabled/displayName）400 4069/4070（baseUrl/providerKey+modelName 必填）——#80 票面 `{providerKey?, ...}` 可选标记与 wire 不符（前端本就全量回传，零影响；档位停用须携全肢＋enabled:false）；② **edge 读面 modelId 是生效值**（覆盖值回落缺省后回显 flash 等，`modelIdOverridden` 区分真绑定）——删除守卫只认真绑定，四点全回落态时删 flash 合法放行（联调曾误删种子档，按 V44 种子值重建、边缘清回，终态 2 通道 3 档原样）；③ 词表 wire 名 3=「已支付」（枚举注释明示语义＝开工条件满足双门禁，UI 直读零改 standing decision 不变——语义由转换时点实证：合同签署完成后单据仍 2，开工门全额到账瞬间转 3）；④ 远端清单真拉无缓存（55 条、staleTiers 对照、上游 status 原文透传），假 baseUrl → 502 4077 明确报错；⑤ apiKey 全链掩码铁律实证（明文只在写口出现一次，回执/读面/留痕恒 `****尾4`）；⑥ mock e2e menus fixture 的 agent-config 路径与真库 V19 种子漂移（`agent-config` vs `agent/config`）——mock-only，真链不受影响，fixture 待顺路校正。

**读面缺口定案（#92 记录在案两项，联调实证后提 admin 仓票）**：① 订单详情不带 prdVersionNo/demoVersionNo（仅 OrderResponse 写回执有）→ 前端「—」降级呈现维持 → [admin#120](https://github.com/ZhangColin/semgravio-admin/issues/120)；② **needsUserSupplement 在 admin BFF 任何可达读面均缺席**（项目聚合/订单详情/承接读面都无）→ 前端三态开关恒 null「未知」，**盖帽动作可写不可读** → [admin#119](https://github.com/ZhangColin/semgravio-admin/issues/119)（优先级更高——交互盲写 vs 展示完整性）。两项均后端读面增量，前端零改（降级形态已按 wire 事实实现）。

**观察限制（如实记录）**：needsUpdate=true 真链不可达——单订单造数下「草稿窗内改价」与「开工门全额到账推 3」互斥（派生逻辑归 provider 测试面，前端 tag 渲染已由 mock E2E 钉）；ORD_047（5047）专属窗口（已签署未支付）已过，终态实证 5005 先到先得、5047 文案以 provider 源码＋mock 钉住。

### 2026-09-17 T7 交付：素材域点亮 ✅（#63，六域之七——清单 + 详情抽屉（PRD 全文）+ 停用⇄启用 + 删除）

mock E2E（material **46/46 两轮全绿** + order 31/31 / project 63/63 / workspace 48/48 / cost 38/38 / price-entry 44/44 回归绿）。验收六条全过：清单渲染契约字段（id/kind/projectId·projectName/title/status·statusName/sunkAt/operatorId·operatorName——未治理行 '-'）/ status 单选 + 沉淀时间闭区间（Instant UTC 带 Z）+ projectId 精确筛选、分页 1-based / 详情抽屉（元数据 + content＝块按 seq 空行拼接全文 pre 呈现）/ 停用⇄启用按状态门控切换（行·抽屉双触发面）+ 删除 $dialog 确认（不可逆提示）、正确端点、成功后刷新 / 失败透传 message 统一 toast（400 KNW_006→2006）。

- **契约事实（api-docs + :8081 实测，2026-09-17）**：status 单选两态 **1=启用 2=停用**（缺省全部——与订单多选逗号串、项目三档单选均不同，各域如实分示）；`kind` 为 **string 裸值**（v1 业务口径恒 "PRD"、无 *Name 字段——专有名词直显不映射，区别于其余枚举 ADR-0009 直读）；sunkFrom/sunkTo **闭区间含两端**、ISO-8601 Instant UTC 带 Z（同成本域口径，`tsToUtcInstant` 复用——区别于订单/项目创建区间的本地串）；sunkAt=首沉淀时间（重沉淀与治理动作不改）；排序服务端定死沉淀倒序。**三写回执是 MaterialSummary（区别于沙箱域回执＝观测详情）**——无 content，抽屉开着须 `reload()` 二次回读；删除回执＝删除前终态（provider 契约，确认移除了什么，前端不消费只 toast+刷新）；停用⇄启用重复幂等（UI 按状态门控只给可达侧，幂等留服务端兜底）。错误码 KNW_005→2005（404 查无）/ KNW_006→2006（400 缺留痕头）/ KNW_007→2007（400 未知 status）。
- **形态**：列表照 price_entry（行内按钮——本域至多两写可见：状态切换钮 + 删除，无需下拉）+ 抽屉照 workspace（写按钮 emit 回父页 $dialog 单点收口，`WRITE_FETCH` 映射同型）；停用⇄启用按 `status===1` 门控切换（启用态行给停用 warning ghost、停用态行给启用 primary ghost）；**删除成功且抽屉正开在同目标则随行关闭**（素材已不可见，详情 404——区别于启停的 reload）。路由两段名 `aiplatform_material`（`/aiplatform/material`）与 V15 种子精确对齐，gen-route 直接产出（无 T6 三段中间层坑）。
- **E2E**：material-fixtures（12 条两页——停用态 ×4（status 单选靶）/王十二官网 010 ×3 全启用态（组合过滤算术坑见下）/9 月 ×10 vs 8 月 ×2（沉淀闭区间靶，窗 [09-01,09-30 23:59] 时区无关命中）/陈运营 ×3）+ harness 扩素材域（`materialListResponse` 三维过滤 + `applyMaterialToggle`/`applyMaterialDelete` **行·详情同步就地变异**（抽屉 reload 拿到新事实）+ failNextMaterialWrite 400 KNW_006）+ 权限码 4 枚/菜单叶 id=201。断言要点：status 单值直传 `status=2`（非逗号串）、sunkFrom/sunkTo 本地→UTC 折算、**回执 summary → 抽屉二次回读计数**（detail GET 次数 +1）、删除后抽屉随行关闭 + 行消失、kind/title 同值 'PRD' 精确匹配计 2 钉住两列。
- **坑与定案（E2E 踩出）**：① **抽屉元数据断言竞态**——抽屉标题即渲染而 detail 异步拉取，开抽屉后立即断言元数据会撞 loading 态（前两断言 FAIL 后续 PASS 的典型形状），须等 content 锚点 `waitFor` 再断言；等 id 锚点会撞 playwright strict mode（id 串同时命中 mono span 与 pre 首行 `# {id} PRD`），锚点选唯一文本；② **组合过滤断言算术**——「停用 ∩ 项目 010」实际 0 行（010 三行全启用态），fixture 覆盖矩阵要按断言算过，不能凭直觉写命中数；③ Escape 关抽屉后才能点行操作（NDrawer modal 遮罩，T1 既有坑复现）。
- **code-review 修正（双轴 review，紧随本票；修后 46/46 + 六域全量回归绿）**：① harness 删除失败分支内联第二份 KNW_005 信封 → 复用 `knw404()` 单点（T6 review ② meter404 同型）；② harness JSDoc `failNext*` 注释被新 flag 改坏（原文「抛 409」对 3 个既有 flag 失实）→ 分述「quote/workspaceWrite/reprice 抛 409，material 抛 400/404」（T5 review ④ 名实对齐同型）；③ index.vue handleAction 注释「删除不可逆走 warning」勘误（三写共 warning，兄弟域同型）；④ E2E kind 列断言加强（kind≡title≡'PRD'，`getByText exact` 计 2 才钉住两列各在）。review 判断项不修记录在案：e2e `pad`/`localFmt` 第二份逐字拷贝（price-entry 起已 2 份，tsToIso 家族先例容忍至第 8 份才收编）；drawer 加载失败空白渲染（project 抽屉有 NEmpty/workspace 无——兄弟域本身不一致，onError 通用兜底 standing rule 辩护）；emit `(action,id,title)` 三元组 Data Clump（T4/T6 先例）；KNW_007→2007 未测（AC 未要求）。spec 轴：六条 AC 全过、无缺失项；抽屉写按钮行 + summary→reload 机制为 AC 文本外延伸但系 #60 沙箱抽屉先例 + 回执契约蕴含，保留。

### 2026-09-17 T6 交付：单价表域点亮 ✅（#62，六域之六——清单（含历史行）+ 原子改价（回执呈现）+ 停用）

mock E2E（price-entry **44/44 两轮全绿** + order 31/31 / project 63/63 / workspace 48/48 / cost 38/38 回归绿）。验收六条全过：清单渲染契约字段（id/provider/model/tokenKind·tokenKindName/unitPrice/currency/effectiveFrom/effectiveTo/operatorId·operatorName——历史行陈运营两列 + 种子行 '-'）/ provider·model 精确等值过滤 + 分页 1-based / 原子改价（回执 closed/opened 两行呈现 + effectiveFrom 预发布字段必填 + unitPrice string→number 预填转类型）/ 停用即时（正确端点 + 成功刷新）/ 失败透传 message 统一 toast（409 METER_008）。

- **契约事实（api-docs + :8081 实测，2026-09-17）**：`unitPrice` BigDecimal → JSON **string** 明文小数（如 "0.000000014"）而**请求侧为 number**（REQ-20 #75）——预填保响应原串直灌输入框（`Number()` 往返会把 <1e-6 的价位渲染成科学计数法形 "1.4e-8"），提交时才 `Number(text)`；tokenKind Integer code 五档 + tokenKindName 随行直读；effectiveFrom/effectiveTo ISO-8601 Instant UTC 带 Z（本地折算显示）；**effectiveTo null 即当前行**——改价/停用只作用于当前行（METER_007 目标非当前行 409，历史行不渲染操作），清单含历史行全量（价史全貌）排序服务端定死生效起点倒序；operator 两列=该行最近管理动作（closed 行保留原开行操作者不被改写、opened 行落 X-User 落痕；种子行 null）。无「开行」端点——种子脚本通道不暴露，web 改价只走原子 reprice。
- **原子改价形态定案**：`reprice-modal` 单弹窗双态——表单态（unitPrice 原串预填 + currency 随行 + effectiveFrom NDatePicker datetime **必填**（AC）默认即时=Date.now，未来时点即预发布；正则 `^\d+(\.\d{1,12})?$` 正数拦截，METER_004/005/008/010 留服务端透传）→ 成功**不关窗切回执态**：closed/opened 两行库内事实（匹配键/价格/生效区间/操作者，opened 带「敞口生效中」tag）+ 完成即关；失败 return false 留窗可修正（NModal preset dialog 定式）。列表刷新由父页 success 钩子承担（toast + getData）。停用走 $dialog.warning 二次确认（目标对账 provider/model·档位 + 即时关行不接新行提示）。
- **路由命名坑（gen-router 三段名中间层）**：view 目录制 `aiplatform/price_entry/`（**下划线**——目录名 dash 会被转 camelCase `priceEntry` 对不上 V15 菜单的 `aiplatform_price_entry`）；但 elegant-router 对三段下划线名固定生成**中间父路由** `aiplatform_price`（path `/aiplatform/price`、无 component——`payment_channel`→`payment_channel_log` 同型先例），需补 `route.aiplatform_price` i18n 键（与叶子同名「单价表」）。动态模式下叶子 path 用后端 `/aiplatform/price-entry`（静态 fallback 是 `/aiplatform/price/entry`，仅翻回 static mode 才可见）。
- **E2E**：price-entry-fixtures（12 行两页——deepseek 现行 6+历史 1（陈运营改价痕）/anthropic 3（provider 过滤靶）/qwen CNY 2（停用靶））+ harness 扩单价表域（provider/model 精确过滤 + reprice/deactivate **就地变异 fixture 行**（closed 行 effectiveTo=新起点保留原操作者、opened 行 unshift 清单首——刷新后清单如实呈现，比只回数计数更强）+ failNextReprice 409 3008）+ 权限码 3 枚/菜单叶 id=200。断言要点：请求 body `typeof unitPrice === 'number'`（string→number 入参口径）、effectiveFrom 本地→UTC 折算 `new Date(...).toISOString().slice(0,19)+'Z'`（cost 先例）、回执两行块级断言、刷新后新行入首行/原行关死无操作。
- **code-review 修正（双轴 review，紧随本票；修后 44/44 两轮 + 订单 31/31 / 项目 63/63 / 沙箱 48/48 / 成本 38/38 回归绿）**：① i18n 重复键 `confirm.target`≡`repriceModal.target`（双语逐字同串）→ 收编单键 `priceEntry.target`（改价弹窗/停用确认共用）+ 回执行摘要 computed 单次映射（模板 4× 函数调用）；② harness 单价表分支内联清单过滤 + 两份 METER_006 404 信封 → 收编 `priceEntryListResponse`/`applyReprice`/`applyDeactivate` 具名 helper（对齐 order/project/workspace 域 `*ListResponse` 形状 + `applyWorkspaceAction` 先例）+ `meter404` 单点；③ 当前行无任一写权限时操作列空 div → 与历史行一致回 `-` 占位；④ `priceEntryWriteAuth` `as const` → `Record<PriceEntryAction, string>`（注释自称与 workspaceWriteAuth 同型，实类型对齐）；⑤ 本节初版误插 T5 段前 → 移正票序。review 判断项不修记录在案：停用失败未单独 E2E 断言（与改价共享 onError 透传通道，409 METER_008 已钉死）；static fallback path `/aiplatform/price/entry`（gen-router 三段名已知取舍，已录路由条目）；`(provider, model, tokenKindName)` 插值三件套同行（T4 `(action,id,containerName)` 先例容忍）；停用二次确认与跨域后果文案（成本警示联动）属域内 UX 先例保留。spec 轴：六条 AC 全过、无缺失项；两处轻微部分项（读码无页侧落点=前五域先例、第 2 页发起搜索回 page=1 未测=与先例逐字同型）均容忍。

### 2026-09-16 T1 E2E 联调闭环：平台账号全流程点亮 ✅（#52 / spec #51）

真后端（admin BFF :8081 + identity :10001 均 local profile）全链验证。**验收八条全过**（含两条语义校准，见下）：

- **菜单/列表/详情**：V14 菜单经 `/menus/my` 下发、侧栏「平台账号」可见可进；列表出 identity 真数据（`userId` JSON 字符串）；详情与列表行同构（含 `locked`/`hasPassword` 两轴）。
- **六字段筛选**：phone（精确/模糊 INNER_LIKE）、email 模糊、userId 精确、status 整数枚举、locked 布尔转换 **五字段全绿**；**注册时间区间 → BFF 502**（KNOWN，REQ-19 / [admin#74](https://github.com/ZhangColin/semgravio-admin/issues/74)，契约内 date-time 透传炸下游，前端格式与 payment 域同形无锅）。
- **分页 1-based 收口**：REQ-18 已落地（admin#73 + identity#78，全链 1-based 无 ±1）——前端删临时适配（请求 `page` 回 1-based 直传，`index.vue`/`account.ts`/`account.d.ts` 三处 ⚠️ 注释清除），实测 page=1/2 回显与翻页正确、page=0 clamp 到 1。**其余域（manage/payment/app 共 7 个列表页）请求侧对齐归 #55（OPEN，同窗 admin#73）**——本票只收口 account；后端已全链 1-based，那 7 处当前翻页会 off-by-one（`page-1` 发 0-based 请求被 clamp），#55 落地即愈。`common.d.ts` 的「请求 0-based」注释亦随 #55 统一更新。
- **封号链**：disable 200 → 列表/详情 status=0 → 测试账号登录 **401「账号已停用」** → activate → status=1 → 登录恢复。
- **锁定链**：「登录失败累计自动锁定」identity **未实现**（触发源缺失，[identity#79](https://github.com/ZhangColin/semgravio-identity/issues/79)）——以 DB 置位模拟：列表/详情 locked=true（双轴叠加 status=1 不丢信息）→ 登录 **401「账号已锁定」** → unlock → 恢复。
- **强制下线链（语义校准）**：登录拿 token → userinfo 200 / refresh 200 → revoke 200 → **refresh 400 `invalid_grant`（SSO 会话已失效）** ✅。票的「token 失效」按 identity 既定设计落地为「refresh/会话失效」；**access token 15min 短命内继续可用是设计取舍**（准 SLO：短命自然收尾），非缺陷。
- **UI 冒烟（headless Chrome 全真后端，18/18）**：抽屉横幅四态合成（正常 / 正常·系统锁定 / 已封号 / 已封号·系统锁定）、操作按钮长横幅上、互斥切换（封号⇄解封按钮按态切换、解除系统锁定仅 locked 时现）、reason 弹窗必填（空时确认禁用）、写操作后回读+列表刷新。
- **验证设施（/tmp 不入仓）**：`/tmp/account-e2e.sh`（API 全链 bash，PASS/FAIL/KNOWN 三档）+ `/tmp/account-ui-smoke/smoke.mjs`（playwright-core + 系统 Chrome channel，免下载浏览器）。
- **环境陷阱**：① 短信发码限流 per phone+ip（429「发送过于频繁/次数过多」）——脚本带 65s 重试；② dev 固定码（local profile）：图形码 `qa58`、短信码 `246810`（QA/e2e 设计如此，不依赖真实收码）；③ Vite「504 Outdated Optimize Dep」= 残留旧 dev server 占 3001（kill 端口进程重启即修，非代码问题）；④ identity OIDC 全链：captcha → sms → login-code → `{redirectUrl}` 取 code → `/token` 换 access/refresh（demo client `rhznx-…`/`http://demo.localhost:3000/auth/callback`）。
- **范围外观察**：V15 已种 aiplatform 六叶菜单但前端无对应页面——动态路由转换报「View component not found」console.error 噪音，菜单优雅跳过不炸（本票不处理，aiplatform 前端建页时自愈）。
- typecheck + lint 全绿。

### 2026-08-14 平台账号管理前端 grilling（admin-web #50，消费 admin BFF admin#49；后端已就绪）

复用 payment 列表+抽屉范式，建「平台账号」目录 + 账号列表页 + 详情抽屉 + 4 写操作。后端 6 端点（`GET /accounts`、`GET /accounts/{userId}/management`、`POST .../disable|activate|unlock|sessions/revoke`）已合入 admin 本地 develop、测试齐全。

- **术语与文案**：glossary 已补 **Account（终端用户账号）** 与 **Operator 对举**、封号/解封、系统锁定、强制下线四条。菜单中文文案**前端 locales 定**（后端 V14 只下发 i18n_key）：`route.account` = **「平台账号」**、`route.account_list` = 「账号列表」——与「系统管理>用户管理」（Operator）拉开区分度（Q1）。
- **两条状态轴独立呈现**（Q2，identity javadoc 印证）：封号轴（status Integer 1=ACTIVE/0=DISABLED）与系统锁定轴（locked boolean）分开渲染——列表主「状态」列只渲染封号轴 tag，locked 作独立标记；抽屉分块各说各的。**无 `*Name` 字段**，前端按 code 映射文案（两值+布尔，整数枚举手写 options 范式）。
- **操作按钮 = 互斥切换显示，不灰**（Q3 用户修正「禁用」方案）：封号/解封**单按钮按状态切换 label+handler**（ACTIVE→「封号」error / DISABLED→「解封」）；「解除锁定」仅 locked=true 时 v-if 显示；「强制下线」恒显。全组 `hasAuth('admin:account:write')` 门控（read/write 两值已定、不拆）。
- **reason 交互**（Q7）：封号独立弹窗 reason 必填 ≤500（NTextarea + maxlength 计数）；解封/解锁/强制下线 `$dialog.warning` 纯二次确认——后端三端点的可选 reason body **不消费**（审计已有 X-User-Id/X-User-Name 出站透传）。写操作响应 `data:null`，成功后回读详情 + 刷新列表。
- **`hasPassword` 不展示**（Q8 用户拍板）：它是「是否设过密码」布尔标志（社交/纯验证码账号 false），非密文本身；类型里保留字段、UI 不渲染。
- **注册时间仅筛选项**：`createdFrom/createdTo` query 支持，但列表/详情响应**均无注册时间字段**（identity 不回）——不做时间列。
- **分页契约分歧 → REQ-18**（Q6 用户拍板平台统一路线）：account 响应 `page` 是 **0-based**（BFF 透传 identity 协议），与全平台「响应 1-based」相反。前端 account 专属 transform **+1 临时适配**；REQ-18 提 admin BFF 北向归一化 1-based、再层层向各服务提 issue 统一分页协议。后端改好后删适配。
- **落位/形态**（Q5）：`src/views/account/list/index.vue`（→ `account_list` / `/account/list`，与 V14 `view.account_list` 对齐，同构 `app_list`）；详情抽屉无路由、NDrawer **720**（对齐 payment）；筛选 6 字段（email/phone/userId/status/locked/注册时间区间）**平铺不折叠**；service `src/service/api/account.ts` + `src/typings/api/account.d.ts`（`Api.Account` 命名空间）；页面局部状态、**不建 store**。
- **commit = 2 个**：① service/types + REQ-18 文档；② 页面 + 抽屉 + i18n 三处 + gen-route 产物。
- **E2E**：测试终端账号（手机号 18001828301，用户提供）——封号→列表已封号→测试账号登录被拒→解封恢复；锁定→locked 标记→解锁；登录拿 token→强制下线→token 失效。identity 服务须起着（`localhost:10001`）。
- **UI 原型拍板（/prototype 三变体，headless 冒烟 20/20，2026-08-14）**：**A 的筛选 + B 的主体**。筛选 = A 形态（keyword 类输入 + status/locked 下拉 + 注册时间区间，平铺）；列表 = B（合成徽章单列——主状态 tag + 锁定小 tag 并排，双轴叠加不丢信息；行内「查看 + 操作下拉」，互斥/不可达操作**不出现**在下拉里）；详情抽屉 = B（状态横幅置顶——合成态大字 + 操作按钮长在横幅上，资料单列在下）；按钮/下拉文案**不带省略号**（「封号…」→「封号」）。原型全量保档 `prototype/account-ui` 分支（三变体 + 浮动切换条 + mock，仅作设计过程 primary source，勿合回）。

### 2026-08-12 支付管理前端 grilling（admin-web #41，消费 admin-bff #38）

消费 admin-bff 支付管理 BFF（[admin#38](https://github.com/ZhangColin/semgravio-admin/issues/38) 契约锁定），实现「支付管理」一级目录 + 5 叶子页 + 仪表盘。后端 V13 菜单已种、经 `/menus/my` 下发；详情不种菜单。后端端点面 `/api/admin/payment/**`（4 列表 / 3 详情·生命周期 / 3 写 / 8 统计）。

- **节奏 = 全量一次建，不 tracer-bullet、不延后**（用户两次拍板 Q1/Q7，覆盖 tracer-bullet 范式）：后端与前端锁步、做到即就绪，按锁定契约全量建 5 页 + 仪表盘 + 全写操作；tier-2 统计同样全量建、无占位。**唯一保留**：payment 服务侧 wire 字段（金额单位、审核 reason 字段名）接真时核对——避免 5 页同改。
- **service / types 独立**（Q8）：新建 `src/service/api/payment.ts`（`index.ts` barrel 再导出）+ `src/typings/api/payment.d.ts` 的 `Api.Payment` 命名空间。payment 是独立限界上下文（后端 `com.semgravio.admin.payment` 子包）、体量最大（18 端点），不塞进 `system-manage.ts` / `Api.SystemManage`。
- **`src/views/payment/` 落位**：`stats/order/refund/operation` 两段目录（→ `payment_*` 键）。**`payment_channel_log` 落 `src/views/payment/channel/log/`（三级）**——route_name 双下划线 = elegant-router 层级分隔符（`GetChildRouteKey` 递归拆），三级目录产出键 `payment_channel_log`；动态模式只取其 `views` 映射键 + `RouteKey` 类型项（`fetchIsRouteExist` 403-vs-404 + i18n），静态路由树不用、无害。建页后跑 `pnpm gen-route`。
- **详情 = NDrawer（非 Modal）**（Q5，覆盖 issue「720px Modal」默认）：右抽屉 `width=720`，内部复用 apps 的 `.desc-table` grid 放只读字段 + `NTabs`（基本信息 / 生命周期，默认基本信息、按需切）。生命周期 = `NTimeline` 合并 PaymentLog + OperationLog（按 createdAt 排序、机机 vs 行为者分色/分图标、success/fail 区分）。支付抽屉头部「通知重发」、退款抽屉头部「审核」。payment **无创建流**（支付/退款均非 admin 创建，spec out-of-scope）。
- **生命周期端点**：`/orders/{no}/lifecycle` 一个，支付/退款抽屉各传自己的 no 复用同一组件。
- **退款审核**（Q12）：独立「审核」弹窗（approve/reject radio + reason，reject 必填）→ `POST /refunds/{no}/audit`；不散两按钮。
- **通知重发**：`$dialog.warning` 确认 → `POST .../notifications/resend`，toast 成功；不改订单状态（仅补投递，术语已钉）。
- **列表 / 筛选**：镜像 manage/app 范式（`useNaivePaginatedTable` + `defaultTransform` + 0-based 请求/1-based 响应分页 + `TableHeaderOperation`）。筛选条 10+ 字段走 **NCollapse 折叠**（Q11，钉 keyword+status、其余「更多」），金额区间双 `NInputNumber`、时间 `NDatePicker` range、status 多选。
- **枚举来源 = 硬编码**（Q10）：~9 组领域枚举（paymentStatus / payMode / accessType / paymentChannel / refundStatus / auditType / logType / operationType / result）进常量，手写 `Option<number, I18nKey>[]`（整数枚举范式，不走 `transformRecordToOption`）。**`businessSystemName` 例外 = 数据驱动**，筛选用 `NInput`（日后或加字典）。
- **两日志页**（通道交互日志 PaymentLog / 订单操作记录 OperationLog）= 纯筛选只读列表，无详情抽屉、无写。
- **仪表盘 = 单页多区块**（Q2 同期做）：8 widget（tier-1 ×4 + tier-2 ×4）全 ECharts（照 `src/views/home/modules/*-chart.vue` + `src/hooks/common/echarts.ts` 的 `useEcharts`）；**widget 经 `usePaymentStats` store 消费、不直连端点**（Q9，见 [ADR-0002](docs/adr/0002-payment-stats-store-seam.md)，留跨服务聚合余地）。chart 选型按数据形态：overview=折线趋势、status-distribution=饼、gateway-health=表+成功率条、operations-audit=表、by-business-system/by-channel/operations-activity=条形、anomalies=列表。
- **金额展示**：`formatMoney`（`¥1,234.56`，千分位+2 位小数），列表/详情/仪表盘统一；假设整数分、接真核对。
- **i18n**：`route.payment` + 5 叶子键 + `page.payment.*` 三处同步（gen-route → `zh-cn.ts`/`en-us.ts` → `app.d.ts` `Schema.page.payment` 子树）。
- **延后项**：① **写按钮权限门控本次不接**（Q14，用户将统一处理一次；audit/resend 按钮先无门控渲染）；② **bank-query 按钮不渲染**（Q4，admin#46 条件性，做到时找 admin 确认）；③ payment wire 字段核对（金额单位、审核 reason 名）接真时做。
- **术语**：payment 子域术语已落 glossary（PaymentOrder/RefundOrder/PaymentLog/OperationLog/退款审核/通知重发/主动查行/生命周期）。

### 2026-08-12 T1 支付订单列表页 ✅（#43 / spec #42，tracer bullet + 地基）

落 payment 整套地基 + 支付订单列表页（复用 SystemManage 整套 CRUD 范式：`useNaivePaginatedTable` + `defaultTransform` + 0-based 分页）。

- **实现时核对修正的两处预设**（grilling 时未见真契约，本片接 admin#37/#38 契约后厘清）：
  - **枚举是字符串（Java enum 名）非整数**：payment 域枚举经 admin BFF 原值透传（`'PENDING'`/`'WECHAT'`/`'H5'`/`'ICBC'` …），与 SystemManage 的整数枚举不同。故 `src/constants/payment.ts` 用 `Record<枚举名联合, I18nKey>` + `transformRecordToOption`（string 键无 `Object.entries` 压 number 问题）。9 组闭合枚举（paymentStatus/payMode/accessType/paymentChannel/refundStatus/auditType/logType/operationType/operationTargetType）；`OperationLog.result` 是自由 token、非闭合，不建 options（T4 走文本输入）。
  - **金额单位 = 整数分（payment `Long amount`，BFF 透传不换算）**：`formatMoney(cents)` ÷100 → `¥1,234.56`（千分位 + 2 位小数），列表/详情/仪表盘统一；金额筛选 UI 用元（NInputNumber precision=2）、提交 `Math.round(yuan*100)` 转分。**唯一保留核对项**（spec 已言）：payment 服务侧 wire 字段接真时复核金额单位 / 审核 reason 名。
- **statuses 多选参数绑定**：BFF query record `statuses: List<String>`，axios qs 默认 indices 格式 `statuses[0]=..&statuses[1]=..` 经 curl 实测 Spring 能正确绑定（全量筛选集 HTTP 500 非 400，500 纯属 payment 不可达）。
- **`payment_channel` 中间路由键**：三级目录 `src/views/payment/channel/log/` 经 gen-route 产出 `payment_channel_log` 叶子键 + **自动中间键 `payment_channel`**（elegant-router 层级分隔符）。`route: Record<I18nRouteKey,string>` 要求所有键翻译——zh/en 均补 `payment_channel`（动态菜单不显示它，仅满足类型 + `fetchIsRouteExist`）。
- **`TableHeaderOperation` 加 `hideAdd` prop**（镜像既有 `hideDelete`）：payment 订单列表只读（订单非 admin 创建），`:hide-add + :hide-delete` 只留刷新 + 列设置。最小框架扩展、升级债可控。
- **NCollapse 筛选**：钉「支付订单号 + 状态(多选)」常驻，其余 8 字段（业务订单号/业务系统/支付方式/接入类型/支付通道/金额区间/创建时间区间/支付时间区间）收入默认折叠的「更多筛选」。时间 NDatePicker datetimerange → ISO 本地串 `YYYY-MM-DDTHH:mm:ss`（后端 LocalDateTime）。
- **详情入口钩子**：点行「详情」开右抽屉（`width=720` 占位本体），抽屉本体（只读全字段 + 生命周期 NTimeline + 通知重发）归 T2 / #44。
- **文件**：`src/typings/api/payment.d.ts`（`Api.Payment` 命名空间 + 9 枚举字面量联合 + PaymentOrderSummary/SearchParams/Filter）、`src/service/api/payment.ts`（订单列表端点 + barrel 导出，模块头记全端点面）、`src/constants/payment.ts`（9 枚举）、`src/utils/common.ts`（+`formatMoney`）、`src/views/payment/{order(全量),stats,refund,channel/log,operation}(1 全 + 4 stub)`、`src/components/advanced/table-header-operation.vue`（+`hideAdd`）、i18n 三处（zh/en/app.d.ts `Schema.page.payment`）+ route 6 键。
- **E2E（headless chromium + page.route mock 隔离验前端，20/20）**：登录→sidebar 露「支付管理」(V13 `/menus/my`)→`/payment/order` 渲染→NCollapse 折叠/展开→金额 `¥1,234.56`/`¥1.00`/`¥99,999.99`→状态/payMode 翻译→`*No` 按 string→初始请求 `page=0&size=10`（0-based）→搜索带 `paymentOrderNo`→翻第二页 `page=1`（0-based 页码，非 item offset）→状态多选 5 枚举→详情抽屉钩子开。**真实数据往返被后端端口错位阻塞**：admin BFF `payment.base-url` 默认 `http://localhost:8082`（down），payment 实跑 `18081`——属后端配置项（admin#38/T2 PaymentClient+config），非前端缺陷；前端 + BFF 参数绑定已全验证。typecheck + lint 干净。
- **延后**：T2 退款订单 + 详情抽屉本体 + 退款审核 / T3 通道日志 / T4 操作记录 / T5 通知重发 / T6+T7 统计仪表盘；写按钮权限门控（spec Q14 统一处理）。

### 2026-08-11 批量删除：manage 页保留、应用页隐藏（grilling 定稿）

- **背景**：四个列表页（user/role/menu/app）因共用 Soybean 原生 `TableHeaderOperation` 组件，默认都带「批量删除」按钮。后端**无任何批量删除端点**——user/role/menu 的批量删除是前端 `handleBatchDelete` for 循环**串行**调单删 `DELETE /{resource}/{id}` 模拟（非原子、部分失败留中间态），带 count/partial toast（自加 i18n key `batchDeleteSuccess/Partial`）。应用页本就无删除（后端 `/apps` 无 DELETE），按钮靠 `:disabled-delete="true"` 永久灰掉。
- **域澄清**：当前 UI 的「批量删除」是**幻象**——非领域意义上的原子批量操作，而是 N 次独立单删 HTTP 请求的 UI 包装（无事务、部分失败有中间态）。保留即接受这个语义。
- **决策**：① **user/role/menu 保留**批量删除现状（循环串行单删，非原子可接受——"既然已经能用就不删"，低频 RBAC 清理够用，**不提**后端批量端点 REQ）；② **应用页隐藏**批量删除按钮（应用无删除语义，灰按钮是 UI 噪音）；③ 实现 = 给 `TableHeaderOperation` 加 `hideDelete?: boolean` prop（默认 `false` 保持 Soybean 兼容、`v-if="!hideDelete"` 门控批量删除按钮），应用页 `:hide-delete="true"`——最小改动、升级债可控（升级只合一个 prop 的 diff）。`disabledDelete` prop 保留（Soybean 对齐、未来可用）。
- **文件**：`src/components/advanced/table-header-operation.vue`（+`hideDelete` prop + `v-if` 门控）、`src/views/app/list/index.vue`（`:disabled-delete="true"`→`:hide-delete="true"`）。验证：typecheck + lint 干净 + 浏览器点测（应用页按钮消失 / 用户页按钮+selection 列俱在，新 prop 两条路径均覆盖）。

### 2026-08-01 动态菜单 grilling（#11 下游实现：翻 `VITE_AUTH_ROUTE_MODE=dynamic`）

> 前置：#11 决策（前端转换器方向）已 CLOSED；REQ-8 已交付——`/auth/current.menus` 每节点带全量 Soybean 路由生成器字段（`component` 已是 `layout.base$view.x`/`view.x` 格式、`routeName` 与 elegant-router 生成名逐字一致）。本次 grill = 动态路由上线前的开放决策点。

- **① home + 菜单端点拆分 = REQ-13（用户拍板：拆分，演进自「/auth/current 补 home」）**：Soybean dynamic 模式 `getUserRoutes` 需返回 `{routes, home}`，而 `/auth/current` 不含 home；讨论中用户提出并确认更彻底的方案——**菜单从 `/auth/current` 拆出，职责按「身份 vs 导航」划界**：
  - **`GET /menus/my`（新端点）= 我的导航**：返回 `{home, menus}`——`menus` 按角色裁剪的可见菜单树（同现 `/auth/current.menus` 内容），`home: string | null` = sortOrder 最小角色的非空 home（全空 → null）。**权限：登录即可**（不能要 `admin:menu:read`，普通用户也要拉导航）。形状直接贴 Soybean `UserRoute`（`{routes, home}`），`fetchGetUserRoutes` 直通零封装；后端算 menus 时本已拿到角色，顺手推导 home 零额外成本。**只返回启用（status=1）菜单**（用户定：消费面过滤是服务端职责、属本 REQ 条款，实测现 `/auth/current.menus` 不过滤 status=0 须一并修；directory 禁用则子树不下发）。管理面 `/menus`（分页）、`/menus/tree` 不受影响——维护用途须见禁用项，保持全量。前端转换器信任契约、不再过滤 status。
  - **`/auth/current` = 身份与权限**：`{user, roleCodes, permissions}`，**移除 `menus` 字段**（breaking；前端是唯一消费者，同步改）。roleCodes/permissions 不拆（身份 claims，非资源）。
  - **动机**：① 消费 REQ-10 已交付的角色 `home` 字段（不消费=死字段）；② home 与 menus 同一消费场景（路由系统），内聚；③ 拆开消除「`fetchGetUserRoutes` 再调一次 `/auth/current`」的重复请求与语义牵强——auth store 调 `/auth/current`、route store 调 `/menus/my`，各取所需。
  - **前端兜底**：home 为 null / 指向本地不存在路由时，fallback = 排序后第一个可见叶子菜单（menuType=2）routeName——任何角色配置下不死。（否决「纯前端推导 home」：角色 home 白做；否决「写死 home」：未分配 home 菜单时 `/` 重定向 404。）
  - **代价**：后端删字段 + 集成测试调整；架构仓库 `docs/starters/admin.md` 契约快照需同步。
- **② `isStaticSuper` 判定去模式条件（翻模式的硬 blocker，实测确认）**：实测超管 `/auth/current` 返回 `permissions: []`（后端 bypass 语义），而 `isStaticSuper` 原判定带 `VITE_AUTH_ROUTE_MODE === 'static'` 条件——翻 dynamic 后恒 false → T2 接进 `hasAuth` 的超管放行失效、写按钮全灭。决策：判定改为 `roles.includes(VITE_STATIC_SUPER_ROLE)`（两种模式通用），名字保留（最小 diff；dynamic 下它专职按钮权限放行，加注释）。（否决「后端给超管下发全量 permissions」：违背 bypass 设计。）
- **③ 菜单显示名兜底 = i18nKey 有效才用，否则 `menuName`（用户拍板 b 并泛化）**：Soybean 渲染规则 `label = i18nKey ? $t(i18nKey) : title`——dynamic 接上后，运营改 `menuName` 若 i18nKey 仍在则显示不变；且弹窗自动派生 `i18nKey=route.{routeName}`，新菜单 locales 缺键时导航显示 `route.xxx` 原文（vue-i18n 缺键行为）。决策：转换器检查 i18nKey 有效性（zh/en 均缺键 → 置 null）——**「不管是没配，还是配了读不到，就用菜单名称」**（用户原话）。种子/规范配置菜单行为不变（走翻译），缺键新菜单显示中文名不显示原文。转换器是本方代码，零升级债。
- **④ 实现事实（grilling 告知项，无决策空间）**：`fetchGetConstantRoutes` 本地化（不发请求，返回本地内建 constant routes——login/403/404/500/iframe-page 是前端内建页，避免每次启动 404+toast）；`fetchIsRouteExist` 本地实现（查完整生成路由表，区分 403/404）；菜单变更生效时机 = 重新登录/刷新（Soybean 固有，会话内不热更）；static 代码全保留、env 翻回即回退；route store 与守卫零改动（转换器放 route store 共享模块，service 层三适配）。
- **✅ spec 已发布（2026-08-01，via `/to-spec`）**：[#20](https://github.com/ZhangColin/semgravio-admin-web/issues/20)（`ready-for-agent`）= 动态菜单（dynamic 路由模式）前端实现。测试 seam = 手动 E2E（同 spec #1/#13）。**阻塞边 = [REQ-13](https://github.com/ZhangColin/semgravio-admin/issues/20)（✅ 后端已交付实测，2026-08-02，见「需服务端支持」REQ-13 条目）**；不依赖后端的（`isStaticSuper` 修复、转换器、service 三适配）可在 static 模式下先合入、零行为变化，翻 env 是最后一步。已 grep 核实无任何代码消费 `/auth/current.menus`——后端删字段无切换协调风险。**✅ 已拆 3 ticket（2026-08-02，via `/to-tickets`，全部 `ready-for-agent`）**：[#21](https://github.com/ZhangColin/semgravio-admin-web/issues/21) T1 dynamic 前置适配（frontier，static 零行为变化）｜[#22](https://github.com/ZhangColin/semgravio-admin-web/issues/22) T2 动态路由闭环（翻 env，blocked by #21）｜[#23](https://github.com/ZhangColin/semgravio-admin-web/issues/23) T3 非超管裁剪与配置行为全矩阵 + 菜单页 toast「更新成功，刷新页面后导航生效」（blocked by #22）。下一步 `/implement` 从 #21 起，清 context 逐个做。
  - **✅ #21 已交付（2026-08-02，commit `186c730`）**：isStaticSuper 去模式条件（auth store，两模式通用）；`fetchGetConstantRoutes`/`fetchIsRouteExist` 本地化不发请求（前者=本地生成路由表 meta.constant 部分，后者=查本地完整路由表）；转换器 `transformBackendMenuToMenuRoutes` + `getValidI18nKey`（经 `locales.isI18nKeyExist`，按注册语言迭代非硬编码）+ `getHomeRouteKeyByBackendMenus` 兜底链 全在 route `shared.ts`（route store/守卫 upstream 逐字未动）；类型 `CurrentUser` 去 menus + 新增 `Api.Route.MyNavigation`。验证：typecheck/lint/build 干净 + headless 浏览器 static 回归 16/16（登录/导航/三管理页写按钮/分配弹窗回显/刷新深链）+ 双轴 code-review（spec 零缺漏）。`fetchGetUserRoutes` 接 `/menus/my` 属 #22。
  - **✅ #22 已交付（2026-08-02，commit `f48e90e`）**：`fetchGetUserRoutes` 改打 `GET /menus/my`（service 层直通映射 `{home, menus}`→`UserRoute`；home 兜底链为空 → `?? VITE_ROUTE_HOME` 类型适配——与 ROOT_ROUTE 默认重定向同源，行为不变、决策 5 不违背，双轴 review 辨析后保留）；`.env` 翻 `VITE_AUTH_ROUTE_MODE=dynamic`（`.env.prod` 未覆盖随 `.env` 同生效；static 代码全保留、翻回即整体回退）。验证：dynamic 超管矩阵全绿（登录落 /home、`/`→/home、导航由 /menus/my 驱动且顺序图标随后端、三管理页写按钮齐全、URL 直达 + F5 恢复、改排序/图标 F5 反映——菜单名不反映 = i18nKey 有效走翻译属决策 6、禁用叶子 F5 消失→恢复）+ typecheck/lint/build 干净。剩 [#23](https://github.com/ZhangColin/semgravio-admin-web/issues/23)（非超管裁剪与配置行为全矩阵 + 菜单页 toast）。**注意**：后端 CORS 只放行 3001——E2E 前确认 dev server 落 3001（残留旧 server 会抢占致 vite 顺延 3002、登录 403）。
  - **✅ #23 已交付（2026-08-02，commit `543ed31` + 复查调整 `2038b0c`）**：① 菜单页提交 toast 通用「更新成功/新增成功」→ 专属文案（edit=「更新成功，刷新页面后导航生效」`page.manage.menu.updateSuccess`、add/addChild=「新增成功，刷新页面后导航生效」`page.manage.menu.addSuccess`——首版单键同文案，双轴 review 指出 add 语义错位，**用户拍板拆双键**（`2038b0c`，headless 实测新增 toast 正确）；两键均手写 Schema 三处同步）；② 非超管全矩阵 E2E 绿（playwright-core headless chromium 驱动，脚本在 /tmp 不入仓）：curl 造角色（菜单子集 首页+系统管理>用户管理 + home=manage_user）+ 用户 → 登录落 /manage/user、导航只见分配菜单、/manage/role|menu 直达 403、/nonexistent 404、`/`→/manage/user；角色 home 置 null → 兜底落第一个可见叶子 /home；禁用叶子 manage_user → F5 导航消失 + 直达 403（空目录 manage 一并消失）；禁用 directory manage → 子树整体消失；i18nKey 缺键菜单导航显示 menuName；hideInMenu 导航不可见 URL 可达；sortOrder 0 升最前 + 换图标 F5 反映；toast zh/en 双验；env 翻 static 静态导航恢复 → 翻回 dynamic；测试数据全清（含 DB 清孤儿关联，见 REQ-14）。typecheck/lint 干净。
    - **⚠️ routeName 的 `_` = elegant-router 层级分隔符（E2E 踩坑后实证定案，2026-08-02；2026-08-03 澄清）**：① **静态侧（src/views 文件式生成）实证**：`src/views/e2e_test/index.vue` 经 `pnpm gen-route` 生成 `e2e`(layout.base, /e2e) → `e2e_test`(view, /e2e/test) **两级嵌套、自动补父级、正常工作**。② **动态侧定案（2026-08-03）：不做自动拆层级处理**——菜单维护成什么样就用什么样，不自动拆。在代码层面看似简化了，但离开代码层面反而让人费解。后缀仍为 elegant-router 原生分隔符含义（作用于静态侧文件式路由生成），动态侧不管。
    - **⚠️ 后端菜单无独立启停端点**：`PUT /menus/{id}/status` 不存在（500），status 经全量 `PUT /menus/{id}` 切换（service 层注释早有记载，curl 造数据时易忘）。

### 2026-08-01 列表空白真根因 + 框架可升级审计 + 菜单树形（re-verbatim 一轮）

- **列表空白真根因 = 复制时漏了 `class="sm:h-full"`**（非 HMR/后端/SW，此前曾误判）：Soybean 三个 manage 页 NDataTable 都成对带 `:flex-height="!appStore.isMobile"` + `class="sm:h-full"`；我们只抄了 flex-height。漏 sm:h-full → 表格没 100% 高度 → flex-height 算不出父高度 → 表体塌 0（实测 `.n-card__content` 高 0、`.n-data-table`≈81px 只剩表头），数据行在 DOM 却被裁、肉眼空（分页仍显示"共 X 条"、无空占位）。**修法：恢复 verbatim（flex-height + sm:h-full 都补上，三个页面）。** 详见 memory `flex-height-needs-sm-h-full`。
- **框架可升级性 = 强**（4-agent 对 `soybean-admin/example` 全量审计确认）：共享依赖**零版本漂移**（naive-ui 2.44.1 / vue 3.5.34 / vite 8.0.12 / @elegant-router 0.3.8 / pinia 3.0.4 / 全部 @sa/* workspace:* 与 Soybean 一致）；承重脚手架逐字节一致（`global-content`/`base-layout` md5 校验同；@sa/axios|hooks|utils|color|uno-preset pristine；@sa/materials 仅差手机端 sider `w-0` 样式）。**合并债核实（2026-08-01 纠正，此前基于 example 分支误判）**：升级 merge 的是 `soybean/main`。`filterRoutesByDev`（route `shared.ts`/`index.ts`）、`global-tab` 滚轮横向滚——这两处 main **本就有、与我方逐字一致**（`diff main` 零差异；example 是精简演示分支、删了这些，故拿 example 对比会误判为债。**勿动**——动了反而破坏与 main 的 verbatim、制造真冲突）。唯一真分歧 = `simple-git-hooks`（我方 `pre-commit: lint` / `pre-push: typecheck`；main 严格档 `commit-msg: git-commit-verify` + `pre-commit: typecheck && lint && fmt && git diff --exit-code`），属 package.json 配置、非 Soybean 源文件。**2026-08-01 用户定：保持宽松**（有意分歧——`pre-commit: lint` / `pre-push: typecheck`，commit 快、不强制 commit message 规范 / fmt；升级时 package.json 的 hooks 块手合几行即可，dependencies 本就要手合、hooks 非主要冲突源）。**升级步骤**：`git checkout -b upgrade/soybean-<tag>` → `git merge soybean/main <tag>` → 在已知冲突点重应用适配 → `pnpm install && pnpm gen-route` → `pnpm typecheck && pnpm lint && pnpm dev` 冒烟。Soybean 原文件尽量 verbatim、适配集中业务层（`src/service/api`、`src/typings`、`src/constants`、`src/store/modules/auth`、`defaultTransform`）——见 `soybean-reference-sources` memory。
- **菜单树形表格**（产品决策，有意与 Soybean v2.2.0 扁扁分页不同）：后端 `/menus/tree` **本就返回完整两级树**（叶子 parentId='60'，非"全 0"——**无需后端改**）；前端切 `fetchGetMenuTree` + `useNaiveTable`（去分页）+ NDataTable 树形 + **受控 `expanded-row-keys`**（computed 全父节点 key，默认全展开——`default-expand-all` 对异步加载数据不生效）+ 去 parentId 列。**后端不用提 issue**。
- **re-verbatim 一轮**（系统管理对齐 Soybean，typecheck+lint 干净）：✅ flex-height+sm:h-full / ✅ `getScrollX` 恢复（`table.ts`）+ 三页接 `scrollX`（去硬编码 `:scroll-x`）/ ✅ `on-change`→`on-update:value`（消弃用警告）/ ✅ 列设置 `column-setting-scroll` 滚动条 / ✅ 搜索栏 `NCollapse` 折叠（user+role）。✅ **i18n 已做**（详见下条「i18n re-verbatim 收尾」）。
- **菜单 flat vs tree 判定**：Soybean v2.2.0 example 的菜单页**也是扁平分页**（`useNaivePaginatedTable`+`remote`+parentId 列，无 tree/children）——我们改树形是新特性（用现成 `/menus/tree`），非对齐缺口、无需升 Soybean。

### 2026-08-01 i18n re-verbatim 收尾（系统管理全 $t，re-verbatim 最后一块）

- **范围**：系统管理 12 个组件（用户/角色/菜单 三列表 + 两搜索 + 菜单操作弹窗 + 用户/角色 操作抽屉 + 三个授权弹窗 + 重置密码弹窗）全走 `$t`；`constants/business.ts` 改 enum→i18n-key 模式。typecheck+lint 干净；2-agent review（语义 0 缺陷 + zh/en/Schema **130 键三方一致**）通过。
- **`page.manage.*` 双语 key（130 叶子键，zh+en）**：Soybean example 的 `page.manage.{common,role,user,menu}` **逐字搬入**（含未用的 `button/buttonCode/buttonDesc`，保留为升级对齐），外加**本项目专属键**（additive、升级安全）：`common.{enableSuccess,disableSuccess,batchDeleteSuccess/Partial}`（启停/批量 toast，`{count}/{success}/{fail}` 插值）、`role.{order,keyword,assignMenu,assignPermission,defaultHome,homePlaceholder,noMenuToAssign,superAdminCodeLocked,roleNameLengthRule,roleCodeRule,form.{order,keyword}}`、`user.{password,createdAt,keyword,resetPwd,assignRole,noRoleToAssign,newPassword,confirmPassword,userNameRule,pwdRule,form.{password,keyword,confirmPassword}}`、`menu.{routePathAuto,i18nKeyAuto}`、**新 `permission.{module.{user,role,menu,permission},noPermissionToAssign}`**（权限弹窗资源分组标签）。授权/重置成功 toast 统一复用 `common.updateSuccess`（Soybean 范式、少加键）。
- **⚠️ Schema 是手写类型（非 `typeof zhCN`）→ 加 i18n 键要改三处**：`src/typings/app.d.ts` 的 `App.I18n.Schema`（`page` 段 home 之后加 `manage` 子树）+ `zh-cn.ts` + `en-us.ts`。`I18nKey = GetI18nKey<Schema>` 严格派生 → 漏一处 typecheck 即红（zh/en 均按 `Schema` 校验，天然保证三方同构）。memory：`i18n-schema-handwritten-3-place-edit`。
- **整数枚举 vs Soybean 字符串**（既有后端分歧）：status/gender/menuType/iconType 后端整数（1/0、1/2），Soybean 字符串（'1'/'2'）。故 record 键用 `number`；**options 不用 `transformRecordToOption`**（它经 `Object.entries` 运行时把 number 键压成 string，破坏 NSelect 的 number v-model）——手写 `Option<number, I18nKey>[]`。search 的 NSelect **不用 `translateOptions`**（签名 `Option<string,...>` 拒 number）——改组件内 `computed(() => opts.map(o => ({...o, label: $t(o.label)})))` 渲染时翻译（语言切换可响应）。**不动** Soybean 的 `@/utils/common`。memory：`i18n-integer-enum-options`。
- **渲染范式（照搬 Soybean）**：性别/菜单类型列 = 内联 `tagMap: Record<number, ThemeColor>` + `$t(record[value])`（标签色不在 record 携带）；是/否单选 = `$t('common.yesOrNo.{yes,no}')`；NRadio/NSelect 选项 label = `$t(item.label)`。
- **⚠️ 一处保留的结构性分歧（待用户定）—— status 列用 NSwitch，Soybean 是只读 NTag+tagMap**：我方三列表 status 是内联启停开关（刻意 UX 增强、跨多轮已被接受），本轮**保留**只把 label 走 `$t`、未回退 NTag。要逐字对齐 Soybean（升级时此处必冲突）可回退——小改动。
- **次要文案向 verbatim 靠拢**：① NCard 标题 `XX管理` → Soybean `.title`（`XX列表`）；② 菜单弹窗部分提示型 placeholder（如 `如 manage_user…`）→ Soybean `form.*` 的 `请输入…`。非功能变化，回滚提示很容易。

### 2026-08-01 NSwitch 二次确认 + 清空权限/角色守卫修正

- **status 列加二次确认（防误操作）**：抽 `StatusSwitch` 子组件（`src/views/manage/components/status-switch.vue`，业务层、不污染 Soybean `common/`）。NaiveUI `NSwitch` 无前置拦截钩子（点即乐观切换），故用受控副本 `inner` 接管：点击→乐观切到目标态 + `NPopconfirm` 弹「禁用?」→确认才发请求（回滚乐观、父 `getData` 驱动同步）→取消/点外自动回滚。三列表 status 列接入。
- **清空权限/角色 = 前端过期守卫 bug（非后端 REQ）**：核实后端 `AssignPermissionsCommand`/`AssignRolesCommand` **均已去 `@NotEmpty`**（REQ-10 已修，服务层 clear-then-add，空集=清空；破窗号由后端守卫保留 SUPER_ADMIN）。但我方 `permission-auth-modal` + `role-auth-modal` 仍带过期空集守卫（`if(checks.length===0) return` + 按钮 disabled）→ 实际无法清空。已去两处守卫（对齐 `menu-auth-modal`，三者一致）。
- **email 搜索 = 无 gap（不提 REQ）**：`AdminUserQuery.keyword` 已 `blurry=username,nickname,email` 覆盖邮箱搜索，前后端一致用 keyword；Soybean 的独立邮箱搜索项仅 parity，功能已覆盖，不值得加键/字段。

- **路由模式 = static**（T1）：`VITE_AUTH_ROUTE_MODE=static`，登录→拉 `/auth/current`→按 roles 过滤本地静态路由→`home`。**不碰后端动态菜单**（菜单→ElegantRoute 转换 + icon + DIVIDER = 后续 ticket，决策见 #11）。理由：tracer bullet——`src/views` 现仅 `home`+`_builtin`，static 天然即"登录→home"，别把最难的菜单适配混进登录。
- **env 目标值**：`VITE_SERVICE_BASE_URL=http://localhost:8081/api/admin`（前缀放 baseURL，api 路径保持 `/auth/login`；Vite 反代剥 `/proxy-default`）、`VITE_SERVICE_SUCCESS_CODE=200`、`VITE_SERVICE_LOGOUT_CODES=401`、`VITE_AUTH_ROUTE_MODE=static`、`VITE_STATIC_SUPER_ROLE=SUPER_ADMIN`、`VITE_HTTP_PROXY=Y`、`VITE_SERVICE_EXPIRED_TOKEN_CODES=`（空，Sa-Token 无 refresh）。
- **UserInfo 映射**（路由硬依赖 userId+roles）：`/auth/current` 的 `{user,roleCodes,permissions,menus}` → Soybean auth store `{userId:String(user.id), userName:user.nickname, roles:roleCodes, buttons:permissions}`（`menus` static 模式暂不用、类型保留；`id` 用 String 防 Long 精度丢失）。
- **错误处理在 `onError`，不在 `onBackendFail`**（⚠️ 反直觉，详见 [ADR-0001](docs/adr/0001-error-handling-in-onerror.md)）：后端约定 HTTP 状态码即 `code`，业务错以 **HTTP 非 2xx** 返回 → 走 axios error 拦截器；Soybean 的 `onBackendFail`（仅 HTTP 2xx 触发）对我们是**死代码**。
- **登录接口的 401 = 账密错，不登出**：靠 endpoint 区分（`/auth/login` 的 401 落 toast；受保护接口的 401 才算会话过期）。**遗留**：会话过期自动登出尚未接（logoutCodes 在死代码 onBackendFail 里）——刷新可恢复，待 follow-up 挪进 onError。
- **登录失败不 `resetStore`**：原 `login()` 失败分支调 `resetStore` 会重置路由、冲掉 toast；改为只弹 toast。
- **header 退出走 `authStore.logout()`**（原直调 `resetStore`，不发后端 `/auth/logout`）。
- **删 refreshToken 整条死代码**（`fetchRefreshToken`/`handleExpiredRequest`）。
- **T2+ 安排 = example 移植路线（2026-07-31，`/grill-with-docs` 定稿）**：决定移植 Soybean `example` 分支的系统管理 UI，而非从零搭（用户拍板：T2 用户页打头炮；菜单页等 #11）。
  - **example 的价值 = UI 外壳 + CRUD hook 用法范式**，**不是**现成 CRUD——其 service 层仅 6 个 GET 查询、增删改全 `// request` 占位，且打的是 Soybean mock（`/systemManage/*` + Soybean DTO），对我们完全无用。**读写 API 全部前端自写**对接 `/api/admin`。
  - **基座已自带 CRUD 地基**（Soybean 精简 main 只删演示页、未删框架）：`src/hooks/common/table.ts`（`useNaivePaginatedTable`/`useTableOperate`/`defaultTransform`）、`form.ts`、`src/components/advanced/table-{header-operation,column-setting}.vue`、`@sa/hooks` `useTable`。移植**只搬页面外壳**。
  - **请求层适配 T1 已完成**（`code==="200"`、unwrap `data`、`onError` 读 `message`）；**唯一**新增契约适配点 = `defaultTransform`（分页 `records/current`→`items/page`、请求 0-based）+ 实体 DTO 字段映射（userName→username 等）+ status 字符串↔数字（Soybean `'1'/'2'` ↔ 我们 `1/0`，**且禁用值语义相反**：Soybean 2=禁用、我们 0=禁用）。
  - **菜单管理页完整移植 Soybean（2026-07-31 决策反转，覆盖上条）**：此前曾定「重写不移植、按 `MenuResponse` 重写」——**作废**。用户拍板 Soybean 系统管理（用户/角色/菜单）**完整移植**，一切功能以 Soybean 实现为准，后端缺啥补啥——菜单按 [REQ-8](https://github.com/ZhangColin/semgravio-admin/issues/11) 扩成路由生成器模型（`component`/`routeName`/`i18nKey`/`keepAlive`/`hideInMenu`/`buttons` 等）。详见 `docs/backend-requirements/REQ-8-soybean-system-mgmt-full-alignment.md`。
  - **排期**：T2 = tracer bullet **用户管理页**（搬外壳 + 自写 CRUD + 改 `defaultTransform`，一页端到端验证整套适配范式）✅ → T3 = 角色管理页（复用范式 + 两个授权弹窗接 `menuIds`/`permissionCodes`）✅ → **菜单页 = 完整移植 Soybean**（2026-07-31 反转，不再 defer #11）：随 [REQ-8](https://github.com/ZhangColin/semgravio-admin/issues/11) 后端扩字段交付后落地；当前 static 模式下可先搬 UI 外壳。
  - **前端实现 spec 已发布（2026-07-31，via `/to-spec`）**：[issue #13](https://github.com/ZhangColin/semgravio-admin-web/issues/13)（`ready-for-agent`）= Soybean 系统管理完整移植（用户/角色/菜单）。分期：**Phase 1** = 用户分配角色（不卡后端、现可做）；**Phase 2**（blocked-by 后端 #11）= 菜单页 + 用户 gender/列表角色列/手机号搜索 + 角色 status/home；审计已撤（非 Soybean 需求，单独待办 #19）；按钮权限（REQ-9）存疑延后、未入 spec。测试 seam = 手动 E2E（同 spec #1）。下一步 `/to-tickets` 拆 tracer-bullet（Phase 2 各 ticket blocking edge 挂 #11）。**✅ 已拆（2026-07-31，via `/to-tickets`）**：[#14](https://github.com/ZhangColin/semgravio-admin-web/issues/14) T1 用户分配角色（frontier，不阻塞）｜[#15](https://github.com/ZhangColin/semgravio-admin-web/issues/15) T2 菜单页｜[#16](https://github.com/ZhangColin/semgravio-admin-web/issues/16) T3 用户字段｜[#17](https://github.com/ZhangColin/semgravio-admin-web/issues/17) T4 角色字段｜[#18](https://github.com/ZhangColin/semgravio-admin-web/issues/18) T5 审计列——审计非 Soybean 需求，#18 已关、单独待办 #19；T2~T4 blocked-by 后端 `semgravio-admin#11`（跨仓文字引用，用户通知后解锁）。父 spec = #13。下一步：`/implement` 从 #14 起，清 context 逐个做。
  - **后端阻塞不变**（[REQ-4]/[REQ-5]/[REQ-6]/[REQ-7]），仅基座从 Next.js 换 Soybean；UI 全做、读接通、被挡写操作给 toast + 跟 REQ。
  - **example 升格为长期 UI/CRUD 模式参考**（不只本次）：后续部门/岗位/财务页继续以其为模板。

- **T2 用户管理页 ✅（2026-07-31，tracer bullet）** — 首页端到端验证整套 Soybean 适配范式。搬 `example` 分支用户页外壳（`src/views/manage/user/`：index.tsx + user-search + user-operate-drawer + user-reset-pwd-modal），自写 CRUD 接 `/api/admin/users`（`src/service/api/system-manage.ts` 6 函数：list/create/update/delete/status/password），改 `defaultTransform` 适配后端分页。
  - **范式落地（T3/部门/岗位/财务复用）**：① `defaultTransform` 读 `PageResponse{items,total,page,size}`（旧 `records/current` 作废）、`total` 为 Long→string 故 `Number()` 兜底；② 请求 `page` **0-based**（`onPaginationParamsChange` 里 `params.page-1`），响应 `page` 1-based；③ `status` 后端运行时是**整数**（1=激活/0=禁用），**OpenAPI 标 string 实为误导**——按整数对接，`PUT /users/{id}/status?status=0|1` 实测接受整数；④ DTO 字段对齐（username/nickname/email/phone，无 gender）。
  - **类型**：新增 `Api.Common.PageResponse<T>`、`Api.SystemManage.{User,UserSearchParams,UserCreateCommand,UserUpdateCommand,ResetPasswordCommand}`（`src/typings/api/`）；`User = Api.Auth.AdminUser`（同构、单一来源）。**POST /users 返回新 id 字符串**（非 User 对象）。
  - **权限门控范式（重要）**：SUPER_ADMIN 后端 bypass、`/auth/current` 返回 `permissions: []` → 原 `useAuth().hasAuth(code)` 对超管恒 false（写按钮全隐）。已修 `src/hooks/business/auth.ts`：`hasAuth` 命中 `isStaticSuper` 直接放行。此后全页 `v-if="hasAuth('admin:*:write')"` 即正确（超管见全部、非超管按权限码）。**路由级仍按 `meta.roles`/static guard**，本页未设 `roles`（所有登录用户可见菜单），写操作靠按钮级 `hasAuth` 兜底。
  - **保护**：删除/启停对 `breakGlass`（内置 admin）禁用、启停对当前登录用户禁用（防自锁）。
  - **E2E（curl 直连后端全链路）**：list/search/分页/创建/编辑/启停(整数)/重置密码(重置后用新密码登录成功)/删除 全通过；**REQ-5 软删已修并验证**（删除后 GET 404、list total 0）。
  - **defer**：分配角色 = T4（被 REQ-4 回显 + REQ-7 写入阻塞，未做）。
  - 文件：`src/views/manage/user/**`、`src/service/api/system-manage.ts`、`src/typings/api/{common,system-manage}.d.ts`、`src/constants/business.ts`、改 `src/hooks/{common/table,business/auth}.ts`、路由 + zh/en i18n（`manage`/`manage_user`）。

> ⚠️ 下述 2026-07-28 决策为 **Next.js 时代**产物：栈无关的（对接范围 RBAC、dev 端口 3001、Dashboard 不动、权限并入角色）仍有效；栈相关（middleware 守卫 / cookie 镜像 / 反代收敛于 `next.config`）**已作废**。

- **对接范围 = RBAC 运营核心**（2026-07-28）。本次只打通后端已支持的 `auth/menus/roles/users/permissions`：路由守卫 + 退出按钮 + sidebar 读后端真 menus + 3 个管理页（用户/角色/菜单，权限并入角色）。Dashboard 不动、部门/岗位/财务留到下一批等服务端接口。理由：后端当前只支撑这五个域，且这正是架构文档「必修现状」的核心。
- **路由守卫 = Middleware + token 镜像 cookie**（2026-07-28）。前端登录成功后将 token 镜像写入 cookie（非 httpOnly，`admin_token`，与 localStorage 并存），logout 清两边；middleware（edge）读 cookie 判断未登录则 redirect `/`，matcher 扩展到页面路由。发请求仍走 `Authorization: Bearer` header，cookie 仅作守卫存在性判断。理由：SSR 前拦截、刷新无闪烁；token 本就在 localStorage，镜像 cookie 不新增 XSS 暴露面。
- **反代只留 middleware**（2026-07-28）。删 `next.config.mjs` 的 rewrites，`/api/*` 反代与页面守卫统一在 `middleware.ts`。理由：消除重复，middleware 同时承担反代 + 守卫两职。
- **dev 端口 = 3001**（2026-07-28）。保持 package.json 的 3001（后端 CORS 仅放行 3001），修正 CLAUDE.md 的 10002 笔误。理由：前后端零改动即可连通；10002 是文档笔误。
- **Dashboard 本次不动**（2026-07-28）。范围聚焦 RBAC 核心，dashboard 保留现有 mock，不碰。⚠️ 偏离架构「必修现状」之「dashboard 接真数据」，留待后端提供 dashboard 聚合接口后再做。
- **权限管理并入角色管理**（2026-07-28）。后端权限仅只读 GET /permissions（无 write）、权限是系统预定义码，不单独建权限页；权限码字典在「角色管理 → 分配权限」里展示勾选。理由：权限码本质是给角色分配用的，单独只读页价值低。故 RBAC 核心实际为 3 个独立页（用户/角色/菜单）+ 权限并入角色。
- **前端实现 spec 已发布**（2026-07-28，via `/to-spec`）：https://github.com/ZhangColin/semgravio-admin-web/issues/1 （标签 `ready-for-agent`）= RBAC 运营核心对接（不阻塞部分）。测试 seam = 手动端到端验证（不引入测试框架）。待 agent 接手实现。
- **spec 已拆为 4 个 tracer-bullet ticket**（2026-07-28，via `/to-tickets`，全部 `ready-for-agent`，GitHub 原生 blocking 已连）：
  - [#2 T1] 受守卫登录闭环 + 退出 + header 真实用户（无 blocker = **frontier**）
  - [#3 T2] 用户管理页 + 首建 useCan ← blocked by #2
  - [#4 T3] 角色管理页（含分配权限/菜单）← blocked by #3 — **主体已实现 ✅（2026-07-30）**，分配权限/菜单被后端 [REQ-7](https://github.com/ZhangColin/semgravio-admin/issues/9) 阻塞
  - [#5 T4] 用户分配角色（回显）← blocked by #3 + 后端 [REQ-4](https://github.com/ZhangColin/semgravio-admin/issues/3) + [REQ-7](https://github.com/ZhangColin/semgravio-admin/issues/9)
  - 用 `/implement` 逐个做，每个做完清 context。
  - ⚠️ **上述 #2–#5 为 Next.js 时代 ticket，其代码实现已在 Soybean greenfield 重写（commit `4300f99`）时整体丢弃**（仅文档由 `001664c` 保留）。Soybean 时代重追：T1 = #12 ✅；T2/T3 重定义见上「example 移植路线」；菜单页并入 #11。

---

- **REQ-1 已交付并实测验证 ✅（2026-07-29）** — 后端 issues #4/#5/#6 CLOSED：`type` 字段（`8c982ad`）+ CRUD 支持 type + path 不变量（`8ce8730`）+ 树排序/祖先链补全/裁剪（`00f1893`）+ **决策 B：DIVIDER 不分配给角色、按结构自动纳入**（`5ee29ea`）。前端 curl 实测 `/auth/current` 与 `/menus` 每节点均带 `type`。**对 T3 的影响**：分配菜单勾选树须过滤 `type=3`(DIVIDER) 节点（不可分配，由后端按邻居可见性自动纳入）。
- **T3 角色管理页 ✅（2026-07-31，Soybean）** — 搬 `example` 角色页外壳 + 自写 CRUD/分配对接 `/api/admin/roles`，复用 T2 整套范式（`defaultTransform`、0-based 分页、`useAuth().hasAuth` 按钮门控）。列表/搜索(name/code/keyword)/分页/新增/编辑/删除 + SUPER_ADMIN 删除禁用 & 编辑 code 禁用 + 两个分配弹窗。⚠️ 上面那条「2026-07-30 主体实现」是 **Next.js 时代**记录（`<HasPermission>`/旧 `menu-tree.ts`），其实现已在 Soybean greenfield（`4300f99`）丢弃；本条为 Soybean 重做。
  - **角色特化**：① 角色无 status 字段（区别用户）——表格无状态列/开关；② 两个分配弹窗放**编辑抽屉内**（仅 edit 态，对齐 example 外壳，表格只留 编辑/删除）；③ 菜单勾选树按决策 B 过滤 DIVIDER（`menu-tree.ts`），`checkStrategy="all"`（菜单 GROUP 是后端真实实体，进 menuIds 往返，**非** permission 的 UI-only 分组）；权限弹窗按资源段分组（两级树）+ `checkStrategy="child"`（只发权限 code）；④ `RoleResponse` 自带 `menuIds`/`permissionCodes` → 回显直接用列表项，无需 GET 详情；⑤ 分配命令后端 `@NotEmpty`——勾选为空时禁用确认按钮（双保险）。
  - **写按钮门控**：`hasAuth('admin:role:write')`（超管 `isStaticSuper` 放行），按钮级 `disabled`（对齐 T2，非 `v-if`）；路由不设 `roles`（所有登录用户可见，读权限靠后端 + 按钮 hasAuth 兜底）。
  - **保护**：`SUPER_ADMIN_ROLE_CODE` 常量（`src/constants/business.ts`）驱动删除/选择禁用 + 编辑 code 禁用；后端亦 `SUPER_ADMIN_CANNOT_DELETE` 兜底（实测 403）。
  - **E2E（curl 直连 + 浏览器点测 3001）全通过**：list/search(中文)/分页/创建(TSID string id)/编辑/删除、SUPER_ADMIN 保护、**分配菜单**（回显 menuIds 含 GROUP）、**分配权限**（回显 permissionCodes，REQ-7 已修写路径打通）、@NotEmpty 空集 400、无效权限码 404。
  - 文件：`src/views/manage/role/**`（index + role-search / role-operate-drawer / menu-auth-modal / permission-auth-modal / menu-tree）、`src/service/api/system-manage.ts`（roles+menus+permissions 8 函数）、`src/typings/api/system-manage.d.ts`（Role/RoleSearchParams/RoleCreate/Update/AssignMenus/AssignPermissions/Permission）、`src/constants/business.ts`（SUPER_ADMIN_ROLE_CODE）、路由 + zh/en i18n（`manage_role`）。详见 issue admin-web#4。
- **用户分配角色 ✅（2026-07-31，#14 / spec #13 Phase 1）** — 用户编辑抽屉加「分配角色」入口（`RoleAuthModal` = NSelect multiple 弹窗），镜像角色页 auth-modal 范式：用户角色是**独立端点** `PUT /users/{id}/roles`，与资料保存 `PUT /users/{id}` 分离（对齐角色页「资料一个抽屉、分配走弹窗」结构，避免两端点耦合提交 / partial-fail）。
  - **回显**：取 `GET /users/{id}` 详情的 `roles`（列表/`/auth/current` 不含、REQ-4 `@JsonInclude(NON_NULL)`）→ `fetchGetUserDetail`；选项取角色列表（角色无 status = 启用集）→ `fetchGetAllRoles`（暂以 `GET /roles` 大页兜底，REQ-10 `/roles/all` 落地后替换）。弹窗每次打开 lazy 拉两份数据。
  - **约束**：空集禁提交（`@NotEmpty` 双保险，确认按钮 disabled）；break-glass（内置 admin）用户 SUPER_ADMIN 锁定不可移除——选项 `disabled`（NaiveUI `closable: !option.disabled` → 已选 tag 不可关闭、下拉不可取消），`load()` 并强制补回；后端亦 403 兜底。
  - **错误防误清**：详情拉取失败（全局 onError 已弹 message）即关弹窗——全量替换语义下，避免回显缺失被误以空/残集提交清掉既有角色。
  - **E2E（curl 直连 + 浏览器点测 3001）全通过**：分配多角色 → 回读回显精确、空集禁用、break-glass SUPER_ADMIN 锁定（tag closable=false）、@NotEmpty 400、break-glass 后端 403。
  - 文件：`src/views/manage/user/modules/role-auth-modal.vue`（新）+ `user-operate-drawer.vue`（接线，edit-only 分配按钮）、`src/service/api/system-manage.ts`（+`fetchGetUserDetail`/`fetchAssignUserRoles`/`fetchGetAllRoles`）、`src/typings/api/{system-manage,auth}.d.ts`（`UserRole`/`AssignUserRolesCommand`/`AdminUser.roles?`）。详见 issue admin-web#14。
- **菜单管理页 ✅（2026-08-01，#15 / spec #13 Phase 2）** — 完整移植 Soybean `example` 菜单模块（表格 + 操作弹窗）+ 自写 CRUD 接 admin 后端 `/api/admin/menus`，复用 T2/T3 整套范式。菜单模型 = Soybean 路由生成器（REQ-8 / 后端 #13 落地后开工）。
  - **模型对齐（推翻旧 nav-tree）**：`menuType` 用 directory(1)/menu(2) **2 值**（DIVIDER(3) 废弃）；`menuType`/`iconType`/`status` 后端**整数**（`BaseEnumSerializer`），`sortOrder`（后端名，Soybean 叫 `order`），`id`/`parentId` 字符串（Long），root = `parentId:null`（非 0），`query:[{key,value}]`。`Api.SystemManage.Menu` 全字段 + `MenuCommand`/`MenuSearchParams`。
  - **表格**：分页扁平形态（与 Soybean example 同构——flat `NDataTable` + parentId 列 + 「新增子菜单」，**非** tree 模式；remote 分页与客户端树不兼容）。类型/图标(iconify↔local)/状态/隐藏/父级/排序列。状态**无独立启停端点**——NSwitch 经全量 `PUT /menus/{id}` 切换（整行重建 `MenuCommand`）；目录行(`menuType===1`)显「新增子菜单」。`admin:menu:write` 按钮门控。
  - **弹窗**：Soybean 全字段（component 拆 layout/page、routePath/i18nKey 由 routeName 自动派生、keepAlive/constant/href/hideInMenu/activeMenu/multiTab/fixedIndexInTab/query）。**path 不变量前端兜底**（后端透传无不变量，旧 ADMIN_014_3 已废）：menu 类型 routePath 必填（由 routeName 派生）、directory 类型禁填（清空）。page 选项**前端自派生**——弹窗打开拉 `/menus/tree` 取全量 menuType=2 routeName（REQ-8 决策，本仓无 Soybean `/getAllPages`，同角色页 homeOptions 派生法）。**丢弃 REQ-9 buttons**（按 spec #13 延后）。
  - **保护**：删除有子菜单后端 403 `MENU_HAS_CHILDREN`（前端无 break-glass 菜单保护，任何无子菜单可删）；DIVIDER 清理：角色页 `menu-tree.ts` 随 type 改 2 值已在 `3e749b8` 完成（type=3 废弃、无需过滤，无残留）。
  - **E2E（curl 8081 + 浏览器点测 3001）全通过**：list(分页)/tree/create(directory routePath=null + menu 带 query)/read/启停(全量 PUT 1→0)/delete(MENU_HAS_CHILDREN 403 守卫 → 删子后再删父 200)；UI 新增弹窗 routePath/i18nKey 自动派生 + 提交往返字段持久化校验。typecheck + lint 干净。
  - 文件：`src/views/manage/menu/**`（index + menu-operate-modal + shared）、`src/service/api/system-manage.ts`（+4 menu CRUD 函数）、`src/typings/api/system-manage.d.ts`（Menu/MenuType/MenuIconType/MenuQueryParam/MenuSearchParams/MenuCommand）、`src/constants/business.ts`（menuTypeOptions/Record、menuIconTypeOptions）、路由 + zh/en i18n（`manage_menu`）。详见 issue admin-web#15。
- **用户字段补齐 ✅（2026-08-01，#16 / spec #13 Phase 2，REQ-11）** — 用户管理页补齐 Soybean 字段：① 抽屉加「性别」`NRadioGroup`（1=男 / 2=女 / null=未填写；新增/编辑均提交）；② 列表新增「角色」列（`roles[].name` → `NTag`，空 → `-`）+「性别」列（`NTag`，null → `-`）；③ 搜索增加「性别」`NSelect` + 「手机号」`NInput`，命中后端 `AdminUserQuery.phone/gender`。后端 REQ-11（PR #17）已交付：`GET /users` 项含 `gender/genderName/roles[]`（roles 进**列表**，区别 REQ-4 仅详情）、`phone/gender` 入 query。
  - **gender 整数语义**：1=男 / 2=女 / null=未填写，**0 非法**（实测 PUT `gender=0` 被忽略）——与 Soybean `'1'/'2'` 同枚举值、仅整数。常量 `userGenderOptions`/`userGenderRecord`（`src/constants/business.ts`，整数版，别与 Soybean 字符串版混用）。
  - **角色列只读回显**：用列表项自带 `roles[]`（无需详情）；分配角色仍走 #14 的 `RoleAuthModal` 独立端点。Soybean `example` 列表无角色列——本列为本项目需求自加。
  - **E2E（curl 直连 + 浏览器点测 3001）全通过**：gender 创建(男)/编辑(男→女，回显正确)/搜索(phone 单选、gender=女 单选且排除 null)/列表 roles 回显(admin→超级管理员)；typecheck + lint 通过。
  - 文件：`src/constants/business.ts`（gender 常量）、`src/typings/api/{auth,system-manage}.d.ts`（`AdminUser.gender/genderName`、`UserSearchParams.phone/gender`、`UserCreate/Update.gender`）、`src/views/manage/user/{index,user-search,user-operate-drawer}`。
- **T4 角色字段补齐 ✅（2026-08-01，#17 / spec #13 Phase 2，REQ-10）** — 角色管理页补齐 Soybean 字段：① 列表「状态」`NSwitch` 列 + 搜索「状态」`NSelect` 筛选，提交 `PUT /roles/{id}/status`（复用 T2 用户页整范式——Soybean `example` 状态列是只读 NTag + 写路径全 stub，故按本项目已验证的用户开关范式做、非照搬 example）；② 分配菜单弹窗顶部加「默认首页」route name `NSelect`，选项从已加载菜单树 `menuType=2`(menu/叶子) 节点的 `routeName` 派生（Soybean `getAllPages` 在本仓无后端端点——route name 是 `@elegant-router` 构建期产物，REQ-8 决策「前端自派生」，直接复用弹窗已拉的菜单树），经 `PUT /roles/{id}` UpdateRoleCommand 提交（home 属角色字段、**非**分配菜单端点）。后端 REQ-10（PR #16）已交付：`GET /roles` 项含 `status/home`、`AdminRoleQuery.status`、`PUT /roles/{id}/status`、去 3 处 `@NotEmpty`。
  - **SUPER_ADMIN 锁定**：角色 status 开关对超管行 `disabled`（后端 `AdminRole.disable()` 守卫，实测禁用 403「超级管理员角色不能禁用」），与 T3 的删除/code 保护一致。
  - **顺带**：去分配菜单弹窗的「空集禁提交」（REQ-10 已去 `AssignMenusCommand @NotEmpty`，空集=清空，旧禁用已成 stale）。注：分配权限 / 用户分配角色两弹窗的空集禁用未动（非 #17 范围，留作 REQ-10 后续跟进）。
  - **修 home 清空 bug（code-review 发现）**：后端 `update()` 全量替换（`setHome(command.home())`），抽屉 `fetchUpdateRole` 原不传 home → 编辑资料即清空默认首页。修：抽屉回传 `localRole.home`（弹窗内改 home 已同步进 localRole）。curl 复现（省略 home → 清空）+ 修复后点测（编辑描述、home 保留）验证。
  - **E2E（curl 直连 + 浏览器点测 3001）全通过**：status 启→禁→启（持久化）、status 筛选（禁用=仅该行）、SUPER_ADMIN 开关 disabled、home 下拉（4 个 route name 选项）选择→持久化 `home=manage_role`、编辑资料不清空 home；typecheck + lint 通过。
  - 文件：`src/views/manage/role/{index,modules/role-search,modules/menu-auth-modal,modules/role-operate-drawer}`、`src/service/api/system-manage.ts`（+`fetchUpdateRoleStatus`）、`src/typings/api/system-manage.d.ts`（Role +status/home、RoleSearchParams +status、RoleCreate/Update +home）。详见 issue admin-web#17。
- **主线安排：REQ-6 已提 + 并行做 T3（2026-07-29）** — REQ-1 解锁 sidebar 真数据 + 菜单管理页（SPEC #1 原 out-of-scope），但实测发现种子数据与前端错位 → REQ-6 已提后端（issue #8，见下），前端并行做 T3 角色管理页；REQ-6 回来后另立 spec 做 sidebar + 菜单管理页。**种子结构决策：加一层 GROUP**——一级「控制台」MENU + 「系统管理」GROUP 收纳 RBAC 叶子，双面板有真实两级内容可验证渲染（否决：保持扁平 → 二级面板永空无法验证；否决：一次提完整导航规划 → 超出 RBAC 范围）。

## 待决策（前端内部）

_（grilling 收尾——核心决策已定，剩余为实现细节，见下「实现约定」）_

## 需服务端支持（前端需求清单，待后端实现）

> 对接中凡需后端新增/修改的，由前端以需求形式提给后端，厘清职责：**前端定义需求 → 后端实现 → 前端对接**。

- **[REQ-1] `MenuResponse` 补 `type` 字段 → ✅ 后端已回复契约，前端已确认（2026-07-29）** — 前端 sidebar 双面板需区分 GROUP/MENU/DIVIDER，枚举领域层已有、仅 Response 未暴露。**后端回复（issue #1）并扩展契约**：① `type` 与深度正交（GROUP≠一级、MENU≠二级；深度由树推、type 决定组件。前端 issue 原措辞为简化，后端表述更准且与 sidebar mock 一致）；② DIVIDER 用 fake-row（`parentId`+`sortOrder` 定位、无 path、无子、name 不渲染）；③ **后端兜底排序（按 `sortOrder` 升序，修现状 HashMap 不排序）+ 裁剪（空 GROUP、悬空 DIVIDER 裁掉、祖先 GROUP 链补全）→ 前端选 A：naive 渲染、不自己排/裁**；④ 顺带修「叶子被分配但父 GROUP 未分配时静默丢弃」bug。**序列化**：type 整数 code（`BaseEnumSerializer`），`/menus` 与 `/auth/current` 每节点都带。**前端侧影响**：菜单管理页把 DIVIDER 当一类节点 CRUD。issue：https://github.com/ZhangColin/semgravio-admin/issues/1 。**优先级：高（阻塞 sidebar 真数据对接）**。
- **[REQ-2] 后端 RBAC 必修 bug —— ✅ 已核实通过（2026-07-28）** — 经读码核实，架构文档列的两个致命 bug 均已修：① loginType 三处（登录写入 / `StpInterface` / 拦截器）统一为默认 `"login"`，`@RequirePermission` 正常按权限码拦截；② 超管 bypass 经 `AuthorizationBypassResolver` SPI 插在「登录后、授权前」，超管也必须登录（无后门）。内置 admin(id=1) 删/禁/夺权均受保护（保留 ID 方案，非 system 列）。**结论：前端可放心依赖权限校验生效，无需后端再改。** 遗留仅 `/auth/captcha` 占位（见 REQ-3）。
- **[REQ-3] `/auth/captcha` 验证码 → ✅ 后端决策 won't fix，已移除占位（issue #2 CLOSED，2026-07-29）** — 后端判断内部员工后台无 botnet 撞库场景，图形验证码防不住内部威胁、收益≈0；未来防自动化走「失败 N 次锁定 + IP 限流」，届时另开 issue。已从放行名单移除占位路径（原为 404 误导性占位）。前端本就不调，**零影响**。issue：https://github.com/ZhangColin/semgravio-admin/issues/2 。
- **[REQ-4] 用户接口补 `roleIds` → ✅ 已提 issue（2026-07-28）** — 前端「分配角色」弹窗需回显用户当前角色，但 `AdminUserResponse`（列表与 `GET /users/{id}`）无 `roleIds`/`roleCodes`。**已提交**：https://github.com/ZhangColin/semgravio-admin/issues/3 （标签 `enhancement`）。需求：`GET /users/{id}` 返回 `roleIds`（或 `roles`）。**优先级：中（阻塞分配角色回显，不阻塞其他用户管理功能）**。**✅ 已实现并 CLOSED（issue #3，2026-07-31 核实）**：`AdminUserResponse.roles`（`@JsonInclude(NON_NULL)`，详情 `GET /users/{id}` 填充 `{id,name,code}`，列表/`/auth/current` 不含），被 `AdminUserRolesEchoIntegrationTest` 逐字段钉住。前端待接「分配角色」UI。
- **[REQ-6] 种子菜单数据对齐前端路由/图标/结构 → ✅ 已提后端 issue #8（2026-07-29）** — REQ-1 交付实测发现种子菜单与前端错位：路径 `/admin/*` vs 前端路由 `/dashboard/*`、图标 Lucide 名 vs Material Symbols、扁平结构 vs 双面板、含已决策不建页的「权限管理」。需求：两级结构（一级「控制台」MENU→`/dashboard` + 「系统管理」GROUP 收纳用户/角色/菜单三叶子）、移除权限管理菜单、**icon 契约 = Material Symbols 名**（前端原样渲染不映射）、角色菜单分配迁移不悬空。名称/图标可微调，前端强约束：path 前缀 `/dashboard/*`、icon Material Symbols 名、存在一层 GROUP。issue：https://github.com/ZhangColin/semgravio-admin/issues/8 ；需求详情见 `docs/backend-requirements/REQ-6-seed-menu-align-frontend-routes.md`。**优先级：高（阻塞 sidebar 真数据 + 菜单管理页 spec）。**
- **[REQ-7] 角色分配权限/菜单、用户分配角色全部 400 → 🐞 已提后端 issue #9（2026-07-30，T3 E2E 发现）** — `PUT /roles/{id}/permissions`、`/roles/{id}/menus`、`/users/{id}/roles` 均返回 `400 Invalid request`。读码定位两 bug：① 三张关联表实体（`AdminRoleMenu`/`AdminRolePermission`/`AdminUserRole`）`@GeneratedValue(IDENTITY)` 与 V1 DDL `id BIGINT PRIMARY KEY`（TSID 应用层生成、无自增）冲突 → INSERT 无 id 来源；② `sys_admin_role_permissions.permission_name` DDL NOT NULL，但服务层 `addPermission(code, null)` 传 null。对照：聚合根 `@Id` 无 GeneratedValue（框架 TSID），关联实体应一致。**影响：RBAC 分配写路径全灭**——阻塞 T3 分配权限/菜单、T4 分配角色。**✅ 已修复（2026-07-30，commit `8d09ec7`，issue CLOSED）**：关联实体 id 策略对齐 TSID、assignPermissions 回填 permission_name、AdminRole 只读 JoinColumn 修重新分配路径。**T3 分配菜单/权限 E2E 已验证打通**（curl + 浏览器点测 200 + 回显）；T4 用户分配角色 ✅ 已交付（#14）。issue：https://github.com/ZhangColin/semgravio-admin/issues/9 ；详情 + 复现见 `docs/backend-requirements/REQ-7-assign-relation-entity-id-strategy-400.md`。
- **[REQ-5] 用户删除软删未生效（查询不过滤 deleted）→ 🐞 已提后端 issue #7（2026-07-29，T2 E2E 发现）** — `DELETE /users/{id}` 返回 `200 Success` 但用户**仍存在**于 `GET /users` 与 `GET /users/{id}`。读码核实：`AdminUserManagementAppService.delete` 调 `adminUserRepository.delete(entity)` → 框架走 `entity.markAsDeleted()`（逻辑删，`updatedAt` 确有变化），但 `sys_admin_users` 仓储查询**未过滤 `deleted` 标志**（缺 `@SQLRestriction`/`@Where(deleted=false)` 或框架软删查询未启用）→ 已删记录仍被 `findAll`/`findById` 返回。curl 直连后端复现（绕过前端/反代）：DELETE 200 后 GET 仍 200 返回该用户。**影响：前端删除流（请求/toast/刷新）正确，但后端不真删 → 用户永驻列表。** **优先级：高（用户管理核心写操作失效）。** **前端侧无 workaround**（后端返回 200 即视为成功是正确语义）。issue：https://github.com/ZhangColin/semgravio-admin/issues/7 ；需求详情 + 复现脚本（口令已占位）见 `docs/backend-requirements/REQ-5-user-delete-softdelete-not-effective.md`。**状态（2026-07-29）：后端 OPEN，等待处理。** **✅ 已修复并验证（2026-07-31，T2 E2E）**——后端已修复软删查询过滤；前端 curl 全链路复测：DELETE 返回 200 后，`GET /users/{id}` → `404 管理员不存在`、`GET /users?username=...` → `total "0"`（用户确从列表消失）。用户删除流端到端打通。 注：本地 E2E 创建的测试号 `testops1` 已被多次「软删」（`deleted` 已置位），后端修此 bug 后将自动从列表消失。**补充（2026-07-30，T3 E2E）：Role 聚合同样中招**——`DELETE /roles/{id}` 返回 200 但 `GET /roles` 仍返回该角色（已在 issue #7 评论补证据，建议按聚合统一排查；Menu 未实测）。
- **[REQ-8] 后端对齐 Soybean 系统管理完整功能（用户/角色/菜单）→ ✅ 已提后端 issue #11（2026-07-31）** — 用户拍板 Soybean `example` 系统管理（用户/角色/菜单）**完整移植**：功能一切以 Soybean 为准，后端只保留通用结构（`ApiResponse`/`PageResponse` 外壳、路径风格、Long→string、整数枚举），其余字段/接口缺啥补啥。拆为 REQ-8~11（REQ-12 已撤，见末）：① **REQ-8 菜单扩成路由生成器**（`component`/`routeName`/`i18nKey`/`keepAlive`/`hideInMenu`/`buttons`/`status` + 分页扁平列表端点；**type 用 Soybean directory/menu 2 值——DIVIDER 随 nav-tree 旧方案废弃、REQ-1 被覆盖；icon 用 Soybean iconify+iconType——REQ-6 Material Symbols 作废**，二者均按 Soybean 既定、非开放项）；② **REQ-9 按钮权限模型**（per-menu `buttons` DB 管理 + 角色→按钮分配，按 Soybean 实现；注解扫描保留作后端守卫码来源，二者并存）；③ **REQ-10 角色增强**（status 启停 / home 默认首页 / 去 3 处 `@NotEmpty` 允许清空 / `GET /roles/all` 轻量字典）；④ **REQ-11 用户增强**（gender / 列表内 userRoles 回显 / phone 搜索）；⑤ ~~REQ-12 操作人审计~~ **已撤**——非 Soybean UI 需求（example 三列表均不渲染审计字段，已核实），审计单独待办 admin-web[#19](https://github.com/ZhangColin/semgravio-admin-web/issues/19)（等系统管理功能做完后前后端共审）、审计列 ticket #18 已关、前端不动 `CommonRecord`。**同时反转旧决策「菜单页重写不移植」→ 完整移植**。issue：https://github.com/ZhangColin/semgravio-admin/issues/11 ；详情见 `docs/backend-requirements/REQ-8-soybean-system-mgmt-full-alignment.md`。**优先级：高（阻塞 Soybean 系统管理完整功能落地）**。**前端侧安排（2026-07-31，已纠正 scope）**：**仅按钮权限（REQ-9 per-menu buttons）延后**——用户存疑（「可能跟我想得不太一样」），等后端 #11 落地先重新确认模型再做。**其余系统管理功能按「能做的就做」推进**：现在能做的 = 用户分配角色（REQ-4 后端已 CLOSED，不卡后端）；依赖 #11 的（菜单页 REQ-8、用户 gender/列表角色列/手机号搜索 REQ-11、角色 status/home REQ-10）等后端完成、用户通知后再做。**✅ 后端已交付（2026-08-01 核实，后端 PR #13/REQ-8 菜单 + #16/REQ-10 角色 + #17/REQ-11 用户 + #15 菜单分页软删测试）**：curl 实测 `GET /menus`(分页)节点已是完整 Soybean 路由生成器字段、`GET /menus/tree` 同字段树、`GET /roles/all`=`[{id,name,code}]`、`GET /roles` 项含 `status/home`、`GET /users` 项含 `gender/genderName/roles[]`、`AdminUserQuery` 加 `phone/gender`、`AdminRoleQuery` 加 `status`。**→ 后端对前端 #15(菜单页)/#16(用户字段)/#17(角色字段) 三 ticket 充分，可开做。** **「不出记录」已查清 = 陈旧后端构建**（curl 当前后端 items 正常、fresh dev 浏览器两表均出行），非字段/分页契约缺陷——重启后端+前端即恢复。**⚠️ 菜单字段改名（REQ-8 副作用）已修**：后端 `MenuResponse` 旧 `{name,path,type}` → 新 `{menuName,routePath,routeName,component,menuType,iconType,...}`（DIVIDER/type=3 废弃，仅 directory(1)/menu(2)）。前端跟进（2026-08-01）：`Api.Auth.BackendMenu` 类型对齐 Soybean 字段、`menu-auth-modal` `label-field="name"→"menuName"`、`menu-tree.ts` 去掉 DIVIDER 过滤（无第 3 值）、`fetchGetAllRoles` 由 `/roles` 大页兜底迁移到 `/roles/all`（+`RoleOption` 类型）。实测菜单树标签恢复（`首页/系统管理`）、用户分配角色下拉正常。**#15（菜单管理页）✅ 已交付**；**#17（角色 status/home）✅ 已交付**。**#16（gender 列/搜索/抽屉）✅ 已做**。
- **[REQ-13] 新增「我的导航」端点 `GET /menus/my` + `/auth/current` 移除 menus → ✅ 已交付并实测（2026-08-02，后端 issue [#20](https://github.com/ZhangColin/semgravio-admin/issues/20) CLOSED，拆票链 #21→#22→#23）** — 动态菜单 spec（admin-web#20）的阻塞边，按「身份 vs 导航」划界：① `GET /menus/my` 返 `{home, menus}`（登录即可、按角色裁剪、**只下发启用菜单**——directory 禁用整棵子树不下发、超管全量启用；home = 按 `(sortOrder, id)` 取第一个非空白角色 home）；② `/auth/current` 收敛 `{user, roleCodes, permissions}` 移除 menus；③ **范围外交付**：禁用角色在 roleCodes/permissions/菜单聚合中视为不存在（后端 #21，真实访问回收 200→403）。前端 curl 实测（2026-08-02）：`/auth/current` keys=[user,roleCodes,permissions]；`/menus/my` home='home'、菜单树 component 为 Soybean 格式；禁用 manage_menu 后 `/menus/my` 不下发、恢复后回来。需求详情 `docs/backend-requirements/REQ-13-my-menus-endpoint.md`。前端对接 = admin-web #21/#22/#23。
- **[REQ-14] 角色删除「使用中」检查未过滤已软删用户 → 🐞 已提后端 issue [#24](https://github.com/ZhangColin/semgravio-admin/issues/24)，后端处理中（2026-08-03 更新）** — 用户软删后其 `sys_admin_user_roles` 关联记录残留，`AdminRoleRepository.isUsedByAnyAdmin` 只按 `roleId` 计数、未 join 用户过滤 `deleted=false` → 角色永不可删。**后端方向：尽量放弃软删除，即使保留软删也由后端侧彻底处理（如级联清关联或在查询侧过滤），前端不 workaround。** 需求详情 + 复现脚本见 `docs/backend-requirements/REQ-14-role-delete-in-use-ignores-softdeleted-users.md`。
- **[REQ-18] account BFF 分页响应 `page` 0-based → 平台分页协议统一 → ✅ 已落地（2026-09-16 联调核实）** — account 列表响应 `page` 沿用 identity 0-based 回显（`AccountBffIntegrationTest` 钉死 `page()=0`），与 admin 北向既有域（system-manage/payment：请求 0-based / **响应 1-based**）相反——同壳不同义。**用户拍板路线**：前端↔admin BFF 约定一种，BFF account 归一化；再层层向各服务提 issue 统一平台分页协议。**最终落地形态比拍板更彻底**：全链 1-based（请求+响应）——admin#73「分页全链 1-based 收口」+ identity#78（迁移框架 Pagination），全链无 ±1（admin ADR-0012）。前端 #52 联调删去临时 ±1 适配（请求 `page` 回 1-based 直传），实测 page=1/2 回显与翻页正确、page=0 clamp 到 1。需求详情 `docs/backend-requirements/REQ-18-account-bff-page-zero-based-unify.md`。
- **[REQ-19] account 列表 createdFrom/createdTo 契约内 date-time 透传 502 → 🐞 已提后端 issue [#74](https://github.com/ZhangColin/semgravio-admin/issues/74)（2026-09-16，#52 E2E 联调发现）** — `GET /api/admin/accounts` 带注册时间区间 → BFF 502「Third-party service error」（其余五字段筛选全部正常）。契约内格式（带秒/不带秒 date-time）均 502 稳定复现，契约外格式正常 400——北向绑定没问题，炸在 BFF→identity 透传或 identity 侧解析。payment 域同形时间筛选正常，问题独见于 account 链路。**影响**：「注册时间区间」筛选不可用（六字段筛选缺一角），不阻塞主链路。需求详情 + 复现见 `docs/backend-requirements/REQ-19-account-created-range-filter-502.md`。
- **[identity] 登录失败累计自动锁定：触发源缺失 → 🐞 已提 identity issue [#79](https://github.com/ZhangColin/semgravio-identity/issues/79)（2026-09-16，#52 E2E 联调发现）** — 系统锁定轴（`Account.locked`）设计语义「登录失败累计自动触发」，但 identity 只有 `lock()` 原语、无任何登录失败路径调用它（无失败计数）；管理面只有解锁（#69）——**没有入口能把账号置 locked=true**（DB 直改除外）。管理后台「锁定标记/解锁」功能空转，防爆破基线缺失。#52 联调以 DB 置位模拟触发源，验证下游链路全通（列表/详情 locked 标记、锁定态登录 401「账号已锁定」、unlock 恢复）——只差触发源本身。

---

## 实现约定（开发规范，非决策）

> 下列为对接开发的技术约定，按后端契约对齐。

### Soybean 视角（2026-07-31 起，现行）

- **token**：`localStg`（前缀 `SOY_`）存 `token`；纯 SPA，路由守卫在 `router.beforeEach`（`src/router/guard/route.ts`）读 `localStg.get('token')` 判登录——**无 cookie 镜像、无 middleware**（Next.js 时代那套作废）。发请求走 `Authorization: Bearer <token>` header。
- **超管判定**：`roleCodes.includes('SUPER_ADMIN')`；static 模式下 `isStaticSuper`（`VITE_STATIC_SUPER_ROLE=SUPER_ADMIN`）→ 全静态路由可见。按钮级权限用 `useAuth().hasAuth(code)` + `v-if`（**Soybean v2 无 `v-auth` 指令**，旧博客会误导）。
- **分页 / 枚举**：请求 `page` 0-based（发 `current-1`）、响应 `PageResponse{items,total,page,size}`；`status` 整数（1=激活/0=禁用）。
- **错误提示**：后端 `message`（中文）做 toast；`code !== 200` 即失败——但错误走 `onError`（见上「本仓库决策」+ ADR-0001）。

> ⚠️ 下述子节（鉴权/token cookie 镜像、`useCan`/`<HasPermission>`、Next.js 类型与页面对接）为 **Next.js 时代**约定，**作废**，保留仅作历史。

### 鉴权 / token（Next.js，作废）
- token 镜像 cookie：登录成功 `document.cookie = 'admin_token=<token>; path=/'`，logout 清两边；middleware 读此 cookie 守卫。发请求仍走 `Authorization: Bearer <token>` header（cookie 仅作守卫存在性判断）。
- 超管判定：`roleCodes.includes('SUPER_ADMIN')` → `useCan` 恒 true。

### 权限控制（不变式 #2）
- 新增 `useCan(code: string)` hook + `<HasPermission code>` 组件，基于 `currentUser.permissions`（string[]）；超管放行。
- 不在 UI 硬编码角色判断。

### 类型修正
- `CurrentUserResponse.menus`: `any[]` → `MenuResponse[]`（对齐 store）。
- store `id` 保持 `string`（`String(loginId)`），避免 Long 精度丢失。

### 分页 / 枚举
- 请求分页 `page` 从 0 开始（第一页传 0）；响应 `page` 从 1 开始——展示用响应值，发请求 `请求页 = 展示页 - 1`。
- `status` 是整数（1=激活/0=禁用），非字符串；改状态 `?status=1|0`。

### 页面对接（RBAC 核心 4 页）
- **用户管理**（`/users`）：列表(PageResponse) + 增删改 + 启停状态 + 分配角色 + 重置密码。
- **角色管理**（`/roles`）：列表 + 增删改 + 分配菜单 + 分配权限。
- **菜单管理**（`/menus`）：树形 + 增删改（分层渲染依赖 [REQ-1] `type` 字段）。
- **权限管理 → 并入角色管理**（2026-07-28）：不单独建权限页。权限码字典（GET /permissions）在「角色管理 → 分配权限」里展示并勾选。

### 退出 / header
- header 读 `currentUser`（nickname/avatar），不再硬编码「超级管理员」。
- 退出按钮：`auth-store.logout()` + `POST /auth/logout` + 清 cookie + 跳 `/`。

### 错误提示
- 用后端返回 `message`（中文文案）做 toast；`code !== 200` 即失败。
