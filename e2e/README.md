# E2E 测试 seam（#57 落地，#56 六域共用；#61 扩成本域、#62 扩单价表域、#63 扩素材域、#64 契约增量、#67 扩技能域（#68 指派）、#87 扩合同域、#88 扩模型供应商域、#89 扩付款核验域、#90 扩模型档位域）

headless Chrome（`playwright-core` 系统 channel，**免下载浏览器**）+ `page.route` 全量 mock。
mock fixtures 的字段形状**派生自 admin :8081 `/v3/api-docs`**（各域 `support/*-fixtures.mjs` 头注释标明
对照的 schema 名）；错误信封按 BFF `AiplatformUpstreamErrorAdvice` 形状：HTTP 状态照抄 provider、
`code`＝数字业务码（域码×1000＋序号）、`message` 原文透传。#64 起消费 admin#75 文档化增量
（cost 币种桶 / 对话条目四载荷 / kind=7 报价卡）。

## 运行

```bash
pnpm dev          # 终端 1：dev server 必须落在 :3001（CORS 只放行 3001；残留旧 server 会顺延 3002 导致登录 403）
node e2e/order.e2e.mjs
```

退出码：全部断言通过 = 0，任一 FAIL = 1。

## 结构

```
e2e/
  order.e2e.mjs            订单域验收流（列表/筛选/分页/抽屉/三写/下载/错误 toast）
  project.e2e.mjs          项目域验收流（列表/筛选/分页/抽屉五 tab：基本信息/对话史（#64 四载荷 +
                           报价卡 orderId 复制）/PRD/版本（#64 ClosingCard 结构化）/交付文件）
  workspace.e2e.mjs        沙箱域验收流（列表/期望态·实态过滤（漂移组合）/抽屉全字段/四写门控/直填+失败 toast）
  cost.e2e.mjs             成本域验收流（时间窗必填/五档 tile/双柱状（「—」桶 tooltip 锚定）/unpriced 卡
                           高亮⇄收起/项目成本表分页/行点击下钻/清窗停查/#64 币种桶四面（含空对象空态））
  price-entry.e2e.mjs      单价表域验收流（清单契约字段（含历史行 + operator 两列）/provider·model 精确
                           过滤/分页 1-based/原子改价（预填原串 REQ-20 + string→number + Instant UTC +
                           回执 closed/opened 两行 + 刷新入列）/停用即时关行/失败透传 toast）
  support/
    harness.mjs            断言台账 + /proxy-default/** mock 安装器（auth / menus.my / 各域端点全量；
                           installAiplatformMocks(page, { order?, project?, workspace?, cost?, priceEntry?, ... })
                           域 fixtures 可选挂载；账号档案 ACCOUNT_PROFILES 恒挂载——有码无页嵌件，
                           externalIdOwnerMap 由它派生＝订单/项目 externalId 筛选与档案端点同一批账号）
    order-fixtures.mjs     订单 fixtures（AiplatformOrderSummaryResponse / DetailResponse 形状）
    project-fixtures.mjs   项目 fixtures（ProjectSummary / Detail（costSummary 币种桶）/ Conversation
                           （#64 四载荷 + kind=7）/ Prd / Version / Files / FileContent 形状 + 文件拒读响应）
    workspace-fixtures.mjs 沙箱 fixtures（WorkspaceSummary / Detail 形状——期望态/实态全状态矩阵；
                           harness applyWorkspaceAction 按 action 变异基档回「动作后观测详情」）
    cost-fixtures.mjs      成本 fixtures（Overview / Unpriced / ProjectCost / Detail 形状——五档
                           primitive long 数字口径、cost 币种桶（admin#75 文档化——直读不折算 +
                           空对象空态）、agentKindName null、unpriced 事件时点窗敏感（UNPRICED_EVENT_AT））
    price-entry-fixtures.mjs 单价表 fixtures（AiplatformUnitPriceEntryResponse 形状——unitPrice BigDecimal
                           string 明文小数（请求侧 number，REQ-20）、历史行 + 种子行 operator null、
                           改价/停写变异由 harness 就地改行（刷新后清单如实呈现））
    material-fixtures.mjs  素材 fixtures（AiplatformMaterialSummary/DetailResponse 形状——kind string
                           裸值恒 "PRD"、status 1/2 两态矩阵、沉淀时间 9 月 ×10 vs 8 月 ×2（闭区间
                           过滤靶）、启停/删除变异由 harness 行·详情同步就地改）
    skill-fixtures.mjs     技能 fixtures（AiplatformSkillSummary/Detail/UpdateTraceResponse 形状——
                           id opaque 串两形制（builtin: 前缀 / TSID 十进制串）、内置 3 + 安装三包
                           （可更新 true/false/null 包级统一）、frontmatter 四型值（string/number/
                           array/object）；安装/更新/启停/卸载变异由 harness 就地改；#68 指派态
                           SKILL_ASSIGNMENTS 三槽初始指派——PUT 整包替换就地变异；#72 预检态
                           SKILL_PRECHECK（mode overlap/clean/notExecuted 三态切换＋delayMs 判定
                           延迟；PRECHECK_HINTS 两样本＝四字段全＋三 null「—」占位靶）只读不变异；
                           #69 智能体配置
                           AGENT_CONFIGS 两座（main 双覆盖靶/executor 全默认靶）＋AGENT_TRACES
                           （变化项过滤＋「（默认）」靶）＋AGENT_TOOL_SLOTS 三槽——工具开关窄幅写口
                           挂 main 行开关列（provider toggleTool 镜像），main 槽增强件挂载态由
                           harness 按 main 配置 flag 派生（同源不漂移））
  material.e2e.mjs        素材域验收流（清单契约字段（kind 裸值 + operator 两列）/status 单选·沉淀
                           时间闭区间（Instant UTC）·projectId 精确过滤/分页 1-based/详情抽屉（元数据 +
                           content 全文）/停用⇄启用按状态门控切换（抽屉 reload 二次回读——回执 summary
                           无 content）/删除（抽屉随行关闭 + 刷新后不可见）/失败透传 toast）
  skill.e2e.mjs           技能域验收流（清单契约字段（无分页、内置在前、null 占位、可更新三态）/
                           详情抽屉三节（全字段 + frontmatter 四型值格式化 + 正文全文）/安装单步表单
                           （tag 手输落参 + 回执态不关窗 + 失败留窗 502 SKL_004）/动作矩阵门控（互斥 +
                           安装行专属）/停用⇄启用/卸载（409 SKL_008 透传）/显式更新（回执 from→to +
                           移除名单 + 终态行集 + from==to 幂等呈现 + 409 SKL_013 透传）/更新留痕
                           （按来源包 query 时间线倒序 + 空态））
  skill-assignment.e2e.mjs 指派配置验收流（#68：三签 label 端侧映射＋切签/进入加载 GET 预填/
                           选项表不列 builtin＋停用行可勾与警示色实态/增减保存 PUT 整包＋toast 无
                           确认＋回读刷新/空勾选＝清空/空→非空/失败注入 400 SKL_011 透传；
                           #72 预检三态：手动钮空清单禁用＋loading＋POST body＝点击时快照/
                           overlap 逐条四字段＋null「—」占位/非阻断（hints 非空保存照常 PUT＋
                           预检失败不阻塞）/stale 保留＋标注＋复原消解/notExecuted 降级态不伪装
                           成无重叠（cssVars 背景色三态互异）/clean/切签结果随面板丢弃）
  agent-config.e2e.mjs    智能体配置验收流（#69：两座编辑卡（覆盖标记＋默认预览＋生效值预填）/
                           保存 PUT 四字段全量回传（两 flag 以 GET 原值透传防静默误开）＋清空回落
                           ＋标记复位/留痕时间线（倒序＋只渲染变化项＋null 显「（默认）」）/回滚
                           （$dialog 确认→old 四值 PUT 写回＝留新痕→双卡刷新）/工具面三槽位块
                           （slotName 直读＋kind 三值映射＋骨架/内建 disabled 恒开）/增强工具受控
                           开关即时 PUT＋失败回滚/失败透传 toast（400 PRJ_034＋403 PRJ_036））
  contract.e2e.mjs        合同域验收流（#87 A 批 T1：清单契约字段（contractNo/id/orderId mono＋
                           statusName tag＋version＋金额分格式化）/四维筛选（status 多选逗号＋
                           createdFrom·To＋orderId/contractNo 精确）/分页 1-based/详情抽屉 720
                           三段（全字段含 needsUpdate tag＋范围快照冻结三段＋双方签署位·时点＋
                           双版本引用/PRD 全文/transitions 时间线新→旧）/七写双入口＋六态×动作
                           门控矩阵（草稿/签署态选项集互异）/advance 末边双签可观测门控（未双签
                           不出推进钮→落签解锁）＋failNext 竞态 409 ORD_027 透传/sign party 单选＋
                           已落位 409 ORD_028 幂等拒透传/record 五肢整组（预填·空禁用·v+1·
                           needsUpdate 清零）/订单抽屉创建合同（常给＋409 ORD_024 透传＋成功
                           不跳转＋orderId 筛选可达新行））
  contract-fixtures.mjs   合同 fixtures（AiplatformContractSummary/Detail/TransitionResponse 形状——
                           六态 12 行（含撤回/作废同态不同动作对行）＋动作六类跨行全覆盖＋
                           Long id 恒 string；六写与创建变异由 harness applyContract* 行·详情
                           双端就地改（守卫族自然裁决：ORD_020/021/022/024/025/027/028/031））
  model-provider.e2e.mjs  模型供应商域验收流（#88 B 批 T1：清单无分页全量直灌（掩码/未配置
                           「—」两态＋enabled tag＋种子行 operator '- '）/创建 modal（apiKey 明文
                           ＝写面唯一明文口；POST 命令体验形状不锚原文——铁律钉子）/更新 modal
                           （baseUrl 终态替换预填＋apiKey 留空＝保持＋enabled 预填显式传）/
                           换 key 掩码变更回读/删除 $dialog（被引用 409 PRJ_072 自然＋竞态注入
                           双路透传）/远端清单拉取（行动作 POST 真拉重开再拉＋502 PRJ_077 错误
                           态不静默＋key 空 400 PRJ_076）/对照 drawer（建议入库 tag＋status
                           如实转述 Shutdown/活跃＋已入库键直读＋staleTiers 过时区块）/入库＝
                           drawer 内嵌轻量表单（勾选＋行内语义键→POST /model-tiers providerKey
                           ＝本通道 modelName 预填＋409 PRJ_068 留建议态）/留痕 drawer（时间
                           倒序＋掩码对＋创建痕标注＋回滚预填旧值 apiKey 恒空）＋全链明文
                           负向钉子（读面/留痕））
  model-provider-fixtures.mjs 模型供应商 fixtures（AiplatformModelProvider/Trace/RemoteCatalog/
                           ModelTierResponse 形状——通道三行掩码/未配置·启停·种子 operator 态
                           矩阵＋留痕按 providerKey 索引（创建痕 old 全 null）＋对照目录样本
                           （建议入库两态/已入库两档/staleTiers 两行）＋最小档位集 TIER_ROWS；
                           CRUD/入库变异由 harness applyProvider*/applyTierCreate 就地改——
                           **apiKey 即入即掩（maskApiKey 单点），fixture 永不存明文**（铁律））
  model-tier.e2e.mjs      模型档位域验收流（#90 B 批 T2：清单无分页全量直灌（tierKey/modelName
                           mono＋displayName null 回落灰显＋停用档＋种子行 operator）/创建 modal
                           （先建通道再挂档位 400 PRJ_071 透传留窗＋成功 POST 四肢全量）/更新
                           三肢终态替换＋displayName 空＝清空＋enabled 显式传/删除 $dialog（被
                           绑定 409 PRJ_073 自然＋竞态注入）/留痕 drawer 时间倒序＋创建/删除痕/
                           per-trace 回滚两路（行在＝编辑预填旧值、PUT body＝old 四件；行已删＝
                           创建预填重建、POST body＝删除痕 old 四件＋tierKey；跨行存活零特判＋
                           清单延迟竞态注入，删除成功同步移除本地行确保回滚必走创建））
  model-tier-fixtures.mjs 模型档位 fixtures（AiplatformModelTier/TraceResponse 形状——四行含
                           停用档/null displayName/种子 operator/被绑定档，留痕按 tierKey 索引
                           时间倒序；harness applyTier* 就地变异行·留痕，BOUND_TIER_KEYS 提供
                           删除引用守卫自然裁决，failNextTierDelete 注入竞态）
  payment.e2e.mjs         付款核验域验收流（#89 A 批 T2：订单抽屉两签——「付款核验」签切签挂载
                           即加载/无计划 404 ORD_036 面板缺席＋toast 透传/计划详情三段全量（概览
                           contractNo mono·总额·累计/节点表五态 statusName 直读＋附言码 mono＋
                           开工门 tag＋部分核到账·还需支付＋到账时点·流水号随行/凭证清单四张
                           平面/留痕时间线新→旧跨节点/历史计划行收起态）/核验 modal（元转分＋
                           arrivedAt ISO＋凭证清单选＋channelRefNo＋basis——足额自动转已到账＝
                           harness 累计核到账模拟、不足回待支付不清零）/打回 basis-only（回待支付
                           ＋钮随 4 态消失＋留痕）/凭证下载（无信封二进制＋Content-Disposition）/
                           节点录入整组替换（空计划首录·重录按钮切换·附言码自合同号定格）/
                           失败注入代表样 400 ORD_041＋409 ORD_044 透传）
  payment-fixtures.mjs    付款核验 fixtures（AiplatformPaymentPlanDetail/Nodes/Verify/Reject
                           wire 形状——金额 Long 分恒 string；三单：PLAN_RICH 六节点五态全覆盖
                           （已到账/待核验×2/待支付/处理中/失败关闭——2/3 渠道保留位展示样本）
                           ＋部分核到账＋双凭证＋trails 三类＋history 一行、PLAN_EMPTY 空节点
                           （录入流靶）、无计划单（ORD_036 靶）；三写变异由 harness
                           applyPaymentNodes/Verify/Reject 就地改——verify＝provider 全额判定
                           镜像（settled≥amount 转已到账、不足回待支付），守卫族
                           ORD_036/037/038/039/041/042/044/045 自然裁决）
```

技能域 fixtures 一并承载指派态（`SKILL_ASSIGNMENTS` 三槽初始指派——PUT 由 harness 就地整包替换，
回读如实）；指派 mock 分支先于 `/skills/{id}` 匹配（`/skills/assignments/{slot}` 路径同前缀），
precheck 分支再先于指派 GET/PUT 匹配（`/{slot}/precheck` 同前缀更长者，失败注入
`failNextSkillPrecheck`＝400 SKL_011 与 PUT 指派同族）。

账号档案嵌件（#56 收口，account:read 有码无页）无独立 e2e 文件——用例挂在订单/项目域尾部：
externalId 筛选在 ⇒ 抽屉嵌件点亮（GET `/aiplatform/accounts/{externalId}`），筛选缺省 ⇒ 不出档案区。

## 为新域加 E2E（T2–T7 照此扩展）

1. `support/<domain>-fixtures.mjs`：fixtures 字段对照 api-docs 对应 `*Response` schema 逐个核对。
2. `harness.mjs` 的 mock 安装器加该域端点分支（参照订单域 `listResponse` 的筛选/分页切片）。
3. `<domain>.e2e.mjs`：验收流按该票 acceptance criteria 展开。

## 口径备忘

- 登录走真实 UI（`/auth/login` → mock token → 守卫 → `/menus/my` 动态菜单），不直种 localStorage。
- 列表筛选断言看 `calls` 里最后一次清单请求的 query（订单 `status` 多选断言**解码后**为逗号单值 `1,5`；项目 `status` 三档单选**单值** `1`/`3`，两域有意不同）。
- 写失败 toast 断言透传 message 原文（mock 抛 409 + 数字业务码，形如 `订单已支付或已终结，无法报价（ORD_007）`）。
- 源码包/文件包为二进制流（`application/gzip`），mock 用 `zlib.gzipSync` 生成真 gzip 字节。
- 跨页导航用 `page.goto` 直达，不点侧栏菜单——动态路由模式下菜单点击与 addRoute 时序竞态，
  可能弹回 home（订单域 E2E 本就 home 直达；菜单渲染断言保留，链路 seam #57 已证）。
