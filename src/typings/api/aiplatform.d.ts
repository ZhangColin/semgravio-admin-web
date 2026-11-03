/**
 * AI 平台（aiplatform，#56/#57/#58/#60/#61）——类型契约。
 *
 * 消费 admin BFF `/api/admin/aiplatform/**`（admin#62 定稿、#63–#73 落地；契约正本 =
 * admin :8081 `/v3/api-docs`，逐字镜像 aiplatform provider `/api/backoffice/**`）。
 * 契约事实（api-docs 实测，2026-09-16）：
 * - `id`/`projectId` 为 Long/TSID → JSON **字符串**；`amount` 为 Long（分）→ JSON **string**（同 payment，框架全局序列化）。
 * - 枚举带 `statusName`/`typeName`/`kindName` 中文名（ADR-0009 直读，不做端侧 code→中文映射）；本体为 Integer code。
 * - 订单状态五态（controller 文档 + provider OrderStatus 印证）：1=待报价 2=已报价(=待支付) 3=已支付 4=已归档 5=已取消。
 *   未支付态 = 1|2（报价/取消守卫）；重试归档 = 3（已支付未归档卡单）。
 * - 项目状态两档（provider 文档「1=进行中, 3=已归档」，码位 2 已注销不复用）：筛选三档单选 =
 *   全部(缺省)/进行中(1)/已归档(3)——与订单 status 多选逗号串有意不同（单值直传）。
 * - 项目类型 1=官网 2=电商（v1 单模板，分类仅展示，typeName 随行）。
 * - 对话史 kind 1=user 2=agent 3=question 4=answer 5=closing 6=guide 7=quote；全量同序（id 升序=对话序）；
 *   question/closing/attachments/quote 为事件载荷原样（admin#75 已钉进 swagger @Schema——结构见
 *   各 payload 接口注释；载荷缺失/形状不符走空态不报错）。kindName 中文名随行直读（7=报价卡）。
 * - 版本列表 = 容器 git log 新→旧；回滚版本 runId 空、rollbackFrom 锚定源版本；
 *   版本详情 closing 为收尾卡载荷（与对话史 kind=5 同载荷 #88，可空——收尾卡缺位/回滚版本无收尾卡）。
 * - costSummary.cost 为按币种分桶（admin#75 已文档化）；unpriced=true 成本不完整。
 * - 价目史 `priceEntries` append-only 全量、新→旧，每条带操作者（存量行操作者为 null）。
 * - 分页全链 1-based（ADR-0012），请求 `page` 直传零 ±1。
 * - `status` 多选筛选项（订单域）：逗号分隔单值（`status=1,5`，BFF 拼串透传 provider 签名协议）。
 * - 沙箱域（#60，provider 枚举印证）：期望态 1=运行 2=休眠 3=封存（DB 意图侧）/实态 1=运行中
 *   2=已停止 3=无容器 4=未知（docker 探查一瞥，不落库）两列如实分示——「期望运行而实态无容器」
 *   即漂移行；置备状态 1=置备中 2=就绪 3=失败；环境类型 1=开发 2=测试 3=生产（v1 仅 DEV）。
 *   四写守卫链 WSP_001→007(非 DEV)→015(run 在途)→009(置备在途/封存态)→017：唤醒无状态限制
 *   （封存走深度唤醒、漂移行幂等重建），休眠/重建/封存同拒置备中(1)/封存态(3)。
 *   四写响应＝动作后的观测详情（WorkspaceDetail，区别于订单 OrderWriteAck——响应即新事实，
 *   前端直接回填抽屉免二次回读）；错误码数字形＝域码 1×1000＋序号（1001/1009/1015/1016/1017）。
 * - 成本域（#61，4 读端点）：时间窗 from/to **必填**（BFF 不设默认窗口；半开 [from,to)、
 *   ISO-8601 Instant UTC 带 Z）；五档 token 为 primitive long → JSON **数字**（非 Long-string）；
 *   `cost` 按币种分桶（admin#75 已文档化——键 = ISO 4217 币种码、值 = 金额直读不折算，
 *   swagger number 可能带小数，**不做分→元换算**；空对象 = 无用量或全未配价不伪装 0）；
 *   byAgentKind 的 agentKindName 为 null 落「—」桶
 *   （辅助标记）；项目成本清单排序服务端定死成本降序（全未配价排后 allUnpriced=true）。
 * - 单价表域（#62，3 端点）：`unitPrice` BigDecimal → JSON **string** 明文小数、**请求侧为 number**
 *   （REQ-20 #75——预填保响应原串勿经 Number() 往返，微小价位会落科学计数法形）；改价＝同事务
 *   关当前行+开新行（closed 行保留原开行操作者不被改写，opened 行落 X-User 落痕）；`effectiveTo`
 *   null 即当前行（改价/停用目标位，METER_007 目标非当前行 409）；无「开行」端点（种子脚本通道）。
 * - 素材域（#63，5 端点）：status 单选两态（1=启用 2=停用，缺省全部——与订单多选逗号串有意不同）；
 *   `kind` 为 **string 裸值**（v1 业务口径恒 "PRD"，无 *Name 字段——专有名词直显，不映射）；
 *   sunkFrom/sunkTo **闭区间含两端**、ISO-8601 Instant UTC 带 Z（同成本域时间窗口径，区别于
 *   订单/项目创建区间的本地串）；排序服务端定死沉淀时间倒序（新在前）。停用⇄启用可逆且重复幂等、
 *   删除不可逆（治理移除，不动来源项目；回执＝删除前终态 summary——确认移除了什么）。错误码数字形
 *   ＝域码 2×1000＋序号（KNW_005→2005 查无 404 / KNW_006→2006 缺 X-User 头 400 / KNW_007→2007
 *   未知 status 400）。
 *
 * 技能域（#67 技能管理，技能线 8 端点）：清单**无分页**（有界目录）、服务端排序内置在前；
 *   id 为 opaque 串两形制（内置＝`builtin:<技能名>` / 安装＝TSID 十进制串）——一律 string 透传、
 *   禁止数值化；source 1=内置 2=安装、status 1=启用 2=停用（与素材域同构），`*Name` 随行直读。
 *   安装命令无 tag/ref 字段（repoUrl＋excludeDirs[]，版本恒＝装时 HEAD commit）。回执三形：
 *   install＝装入条目 summary[] / uninstall·启停＝单个 summary（uninstall＝删除前终态）/
 *   update＝from→to＋removedSkillNames[]＋终态行集（from==to＝幂等未落痕未写行）。
 *   `updateAvailable` 为来源包级标记（true=远端 HEAD≠装时版本；null=未检查过、内置恒 null）
 *   ——**不门控更新动作**（provider 不保证检查过）。留痕 append-only 倒序、卸载不删痕。
 *   错误码数字形＝域码 7×1000＋序号（SKL_001→7001 查无 404 / SKL_002–007 安装失败族 /
 *   SKL_008→7008 有指派在身 409 / SKL_013→7013 更新整体拒绝 409）。
 *
 * 智能体配置域（#69 智能体配置，技能线 agent-configs 3 + agent-tools 2 端点）：两座智能体
 *   （main/executor）覆盖态读写——PUT 全量终态（null/缺省/纯空白＝清覆盖回落枚举默认；
 *   webSearch/fetchUrl 两 flag **缺省＝true 开**→保存四字段全量回传防静默误开）；变更留痕
 *   append-only 倒序（值面有动才落痕、幂等回执零写入）、回滚＝old* 快照写回（无专用端点）。
 *   工具开关窄幅写口 PUT /agent-tools/{toolName} 仅增强两件（web_search/fetch_url——挂 main
 *   行开关列，与配置写共表共留痕）；骨架/harness 内建 403 PRJ_036 锁死、enabled 缺省 400
 *   PRJ_037。错误码数字形＝PRJ 4xxx（4033 查无 404 / 4034 操作者缺 400 / 4035 工具无 404 /
 *   4036 锁死 403 / 4037 目标态缺 400）。
 *
 * 合同域（#87，A 批 T1，9 端点；契约正本＝admin HEAD DTO `@Schema`，逐字镜像 provider
 *   BackofficeContract*）：六态人工推进 1=准备中→2=待核对与签署→3=签署进行中→4=签署完成
 *   （末边须双方均签），旁落 5=签署失败或过期（自 2/3）、旁支终态 6=已撤回或作废（1/2/3 可达）；
 *   终态 4/5/6 永不物理删除，撤回/作废后重建＝换新号（POST /contracts/orders/{orderId} 无请求体，
 *   旧行终态保留）。清单行**不带** needsUpdate/签署位（wire 如此——两字段仅详情 contract 段可观测）；
 *   needsUpdate＝草稿态（1/2）且冻结集与订单现值不一致的派生标志（record 重录即清零）。
 *   七写回执均＝单段合同体（Contract，非三段 detail——前端不消费，toast＋回读＋刷新）；
 *   留痕 transitions 六类动作（1=推进 2=撤回 3=作废 4=签署标记 5=草稿重录 6=失败或过期，
 *   非迁移动作 from=to）；签署标记不自动迁移状态（「签署完成」由 advance 显式推进）；
 *   错误族 ORD_02x 数字码透传不判码（ORD_020 查无/021 无边/022·023 依据/024 活跃唯一/
 *   025·026 冻结集前置/027 双签门禁/028 签署位幂等/031 重录窗口/032 内容超长）。
 */
declare namespace Api {
  namespace Aiplatform {
    /** 订单状态（五态）：1=待报价 2=已报价 3=已支付 4=已归档 5=已取消。 */
    type OrderStatus = 1 | 2 | 3 | 4 | 5;

    /** 交付物类型（#96 三值，下单冻结自项目终点类型）：1=设计 2=系统 3=系统＋设计。 */
    type OrderDeliverableType = 1 | 2 | 3;

    /** 价目史行（append-only；detail 响应带操作者两列）。 */
    interface OrderPriceEntry {
      id: string;
      /** Long（分）→ JSON string */
      amount: string;
      /** ISO 4217；v1 恒 CNY */
      currency: string;
      note: string | null;
      /** 操作者留痕（存量行为 null） */
      operatorId: string | null;
      operatorName: string | null;
      createdAt: string;
    }

    /** 订单列表行（GET /orders items 元素）。 */
    interface OrderSummary {
      /** TSID → string */
      id: string;
      projectId: string;
      projectName: string;
      /** 下单账号昵称（缺档为 null） */
      ownerDisplayName: string | null;
      status: OrderStatus;
      statusName: string;
      /** 交付物类型（#96：下单冻结自项目终点类型）——取件端点按型自适应。 */
      deliverableType: OrderDeliverableType;
      deliverableTypeName: string;
      /** Long（分）→ JSON string；待报价 null */
      amount: string | null;
      currency: string;
      createdAt: string;
      quotedAt: string | null;
    }

    /** 订单详情（GET /orders/{id}；价目史全量新→旧 + PRD 快照 + 状态时点组）。 */
    interface OrderDetail {
      id: string;
      projectId: string;
      projectName: string;
      ownerDisplayName: string | null;
      status: OrderStatus;
      statusName: string;
      deliverableType: OrderDeliverableType;
      deliverableTypeName: string;
      amount: string | null;
      currency: string;
      /** 最新报价备注 */
      note: string | null;
      priceEntries: OrderPriceEntry[];
      /** 下单冻结的 PRD 快照正文 */
      prdSnapshot: string | null;
      createdAt: string;
      quotedAt: string | null;
      paidAt: string | null;
      archivedAt: string | null;
      archiveOperatorId: string | null;
      archiveOperatorName: string | null;
      cancelledAt: string | null;
      cancelReason: string | null;
      cancelOperatorId: string | null;
      cancelOperatorName: string | null;
    }

    /** 写操作回执（quote/cancel/retry-archive；成功后前端不回读此体、自行回详情+刷列表）。 */
    interface OrderWriteAck {
      id: string;
      projectId: string;
      status: OrderStatus;
      statusName: string;
      deliverableType: OrderDeliverableType;
      deliverableTypeName: string;
      amount: string | null;
      currency: string;
      note: string | null;
      quotedAt: string | null;
      /** 写回执的价目行不带操作者两列（契约如此，消费方不用） */
      priceEntries: Omit<OrderPriceEntry, 'operatorId' | 'operatorName'>[];
      createdAt: string;
      cancelledAt: string | null;
      paidAt: string | null;
      archivedAt: string | null;
    }

    /** GET /orders 查询参数。分页 1-based 直传；`status` 多选逗号拼接。 */
    interface OrderSearchParams {
      page: number;
      size: number;
      /** 状态多选（序列化为逗号分隔单值 status=1,5） */
      status?: OrderStatus[];
      /** 创建时间起（含），ISO-8601 本地串（如 2026-09-01T00:00:00） */
      createdFrom?: string;
      createdTo?: string;
      /** 下单账号 externalId 精确（换算不到＝空清单 200） */
      externalId?: string;
      /** 订单号精确（TSID 十进制；查无/非数值→空清单 200） */
      orderId?: string;
    }

    type OrderFilter = Omit<OrderSearchParams, 'page' | 'size'>;

    /** POST /orders/{id}/quote body——amount 整数分（Jackson Long 兼容 number）。 */
    interface QuoteOrderCommand {
      amount: number;
      note?: string;
    }

    /** POST /orders/{id}/cancel body——reason 必填（空禁用确认）。 */
    interface CancelOrderCommand {
      reason: string;
    }

    /** 项目状态（两档）：1=进行中 3=已归档（码位 2 已注销不复用）。 */
    type ProjectStatus = 1 | 3;

    /** 项目类型：1=官网 2=电商（v1 单模板，分类仅展示）。 */
    type ProjectType = 1 | 2;

    /** 对话史条目 kind：1=user 2=agent 3=question 4=answer 5=closing 6=guide 7=quote（aiplatform#203）。 */
    type ConversationEntryKind = 1 | 2 | 3 | 4 | 5 | 6 | 7;

    /**
     * 问答卡载荷（kind=3 携带，其余 kind 为 null）——question-raised 事件 payload 原样
     * （admin#75 @Schema 文档化）。呈现投影 = `data.questions`；`data.toolCalls` 为答复续跑
     * 重建所需的待确认工具最小面（服务侧语义，不呈现）。
     */
    interface QuestionCardPayload {
      runId?: string;
      sessionId?: string;
      engine?: string;
      /** 单句概括（多问并一卡时为首个问题的原文） */
      summary?: string;
      engineRef?: string;
      data?: {
        toolCalls?: { id?: string; name?: string; input?: Record<string, unknown> }[];
        /** 问答卡投影（呈现主体）；custom 恒 true 可自由输入 */
        questions?: {
          header?: string;
          question?: string;
          multiple?: boolean;
          custom?: boolean;
          options?: { label?: string }[];
        }[];
      };
    }

    /** 收尾卡文件变更行（closing.files 元素）。 */
    interface ClosingFileChange {
      path: string;
      added: number;
      removed: number;
    }

    /**
     * 收尾卡载荷（kind=5 携带 / 版本详情锚定，#88 同载荷两承载面）——run-finish 收口扩载
     * 原样（admin#75 @Schema 文档化）。**可缺省键＝该轮无该事实**（全字段可选，按存在渲染）；
     * durationBreakdown 为平台分析口径，呈现可忽略（文档明示，不渲染）。
     */
    interface ClosingCardPayload {
      summary?: string;
      prdChanged?: boolean;
      prdNote?: string;
      systemChanged?: boolean;
      systemNote?: string;
      files?: ClosingFileChange[];
      durationMs?: number;
      selfTest?: { total?: number };
      /** 锚定版本 commit hash（全量 64 位十六进制） */
      version?: string;
      durationBreakdown?: {
        llmMs?: number;
        toolsMs?: number;
        selfTestMs?: number;
        closingMs?: number;
        attempts?: number[];
      };
    }

    /**
     * 圈注附件（kind=1 用户发言可携带，#97）——结构化定位＋标注类型，据此重建圈注 chip
     * （非截图）。annotation.kind 三值：select=点选锚定 / circle=拖框圈区域 / comment=历史兼容。
     */
    interface AnnotationAttachment {
      /** 恒 "annotation"（v1 唯一附件类型） */
      attachmentType?: string;
      annotation?: {
        kind?: string;
        anchor?: {
          /** CSS 选择器（select 点选） */
          selector?: string;
          /** 锚定文本（select 点选） */
          text?: string;
          /** 拖框区域（circle 圈选，页面坐标） */
          region?: { x: number; y: number; width: number; height: number };
        };
        note?: string;
      };
    }

    /**
     * 报价卡载荷（kind=7 携带，其余 kind 为 null，aiplatform#203）——仅事件＋订单引用，
     * **不含金额**（视镜非快照，aiplatform ADR-0017——金额/备注/状态呈现时取订单当前态）。
     */
    interface QuoteCardPayload {
      /** Long → JSON string（防 JS 精度丢失） */
      orderId: string;
      /** quoted=报价已出 / repriced=报价已更新（改价即刻对用户可见） */
      event: 'quoted' | 'repriced';
    }

    /** 项目列表行（GET /projects items 元素；清单 TSID 倒序=新项目在前，服务端定死）。 */
    interface ProjectSummary {
      /** TSID → string */
      id: string;
      name: string;
      /** 归属账号昵称（缺档/无主为 null） */
      ownerDisplayName: string | null;
      type: ProjectType;
      typeName: string;
      status: ProjectStatus;
      statusName: string;
      /** 归档标记（与 status=3 同派生自 archived_at） */
      archived: boolean;
      createdAt: string;
      updatedAt: string;
    }

    /** 订单引用（项目详情 activeOrder/latestOrder 内嵌摘要）。 */
    interface OrderBrief {
      id: string;
      status: OrderStatus;
      statusName: string;
    }

    /**
     * 成本指针（cost 按币种分桶，admin#75 已文档化——键 = ISO 4217 币种码、值 = 金额直读不折算；
     * 空对象 = 无用量或全未配价，空态文案不伪装 0。unpriced=true 成本不完整，无用量＝false 空态）。
     */
    interface CostSummary {
      /** 按币种分桶（金额 swagger number 直读——非平台 Long 分口径，不做 ÷100 换算） */
      cost?: Record<string, number>;
      unpriced: boolean;
    }

    /** 项目详情（GET /projects/{id}；清单字段全量 + 工作区引用 + 订单引用双档 + 成本指针）。 */
    interface ProjectDetail {
      id: string;
      name: string;
      ownerDisplayName: string | null;
      /** 工作区引用（沙箱域下钻锚点） */
      workspaceId: string;
      type: ProjectType;
      typeName: string;
      status: ProjectStatus;
      statusName: string;
      archived: boolean;
      createdAt: string;
      updatedAt: string;
      prdProducedAt: string | null;
      generatedAt: string | null;
      /** 未终结订单（1|2）——有值即冻结迭代；支付归档后转空 */
      activeOrder: OrderBrief | null;
      /** 最近一张任意状态订单（activeOrder 转空后承接完整取单面；从未下单两者皆空） */
      latestOrder: OrderBrief | null;
      /** 成本汇总指针——恒在：无用量＝空 cost＋unpriced:false 明确空态（provider 文档钉死） */
      costSummary: CostSummary;
    }

    /** 对话史条目（GET /projects/{id}/conversation；id 升序=对话序全量同序）。 */
    interface ConversationEntry {
      /** Long → JSON string（对话序锚点，仅排序用不渲染） */
      id: string;
      kind: ConversationEntryKind;
      kindName: string;
      /**
       * 会话来源（#77，admin#98）：2=设计会话——每设计物独立会话流；null=主会话**缺省**
       * （JSON 在场为 null、非字段缺省——降级口径下作用域改稿发言不标注，勿当未知值补归属）。
       */
      sessionSource: number | null;
      /** 中文名随行直读（仅 sessionSource=2 条目渲染标注时消费） */
      sessionSourceName: string | null;
      /** 锚定构建 run（用户发言/平台引导为 null） */
      runId: string | null;
      /** 话语正文——question/closing/quote 条目为 null（载荷入正文区渲染） */
      text: string | null;
      /** 问答卡载荷（kind=3 携带；缺失/形状不符走空态） */
      question?: QuestionCardPayload | null;
      /** 收尾卡载荷（kind=5 携带；与版本详情 #88 同载荷，ClosingCard 共组件渲染） */
      closing?: ClosingCardPayload | null;
      /** 圈注附件（kind=1 用户发言可携带；缺失/形状不符走空态） */
      attachments?: AnnotationAttachment[] | null;
      /** 报价卡载荷（kind=7 携带；视镜语义不含金额） */
      quote?: QuoteCardPayload | null;
      /** 问答卡作答标记（kind=3 语义：false=挂起待答；其余 kind 恒 false 不渲染） */
      answered: boolean;
      at: string;
    }

    /** PRD 全文（GET /projects/{id}/prd；工作区 docs/PRD.md 直读，v1 无版本链只最新版）。 */
    interface PrdContent {
      projectId: string;
      content: string;
      /** 文件 mtime */
      updatedAt: string;
    }

    /** 版本列表行（GET /projects/{id}/versions；git log 新→旧，零版本=空列表非错误）。 */
    interface VersionSummary {
      commitHash: string;
      subject: string;
      /** 锚定构建 run（回滚版本为 null） */
      runId: string | null;
      /** 回滚版本锚定源版本 hash（run 版本为 null） */
      rollbackFrom: string | null;
      committedAt: string;
    }

    /** 版本详情（GET /projects/{id}/versions/{ref}；+ 收尾卡载荷，可空）。 */
    interface VersionDetail {
      commitHash: string;
      subject: string;
      runId: string | null;
      rollbackFrom: string | null;
      committedAt: string;
      /** 收尾卡载荷（#88 与对话史 kind=5 同载荷，ClosingCard 共组件）——收尾卡缺位/回滚版本为 null */
      closing: ClosingCardPayload | null;
    }

    /** 文件树条目（GET /projects/{id}/files 的 files 元素）。只列文件——目录由前端按路径段合成；size Long（字节）→ JSON string。 */
    interface FileEntry {
      /** 工作区相对路径（服务端按路径稳定排序） */
      path: string;
      /** Long（字节）→ JSON string */
      size: string;
    }

    /** 文件树（GET /projects/{id}/files；交付口径 = dev 工作区剔 data/、.platform/、node_modules/ 与 .env——与源码包同口径）。 */
    interface ProjectFiles {
      projectId: string;
      files: FileEntry[];
    }

    /** 文本文件内容（GET /projects/{id}/files/content?path=；provider 只读策略全裁决——机密/超 1MiB/非文本拒读走 HTTP 非 2xx）。 */
    interface FileContent {
      /** 原样回显请求 path */
      path: string;
      /** 工作区文件原样文本 */
      content: string;
    }

    /** GET /projects 查询参数。分页 1-based 直传；status 三档单选单值直传（缺省=全部）。 */
    interface ProjectSearchParams {
      page: number;
      size: number;
      /** 状态三档单选（1=进行中 3=已归档；缺省＝全部，归档项目缺省含） */
      status?: ProjectStatus;
      /** 创建时间起（含），ISO-8601 本地串（如 2026-09-01T00:00:00） */
      createdFrom?: string;
      createdTo?: string;
      /** 归属账号 externalId 精确（换算不到＝空清单 200） */
      externalId?: string;
      /** 项目 id 精确（TSID 十进制；查无/非数值→空清单 200） */
      projectId?: string;
    }

    type ProjectFilter = Omit<ProjectSearchParams, 'page' | 'size'>;

    /** 沙箱环境类型：1=开发 2=测试 3=生产（v1 仅 DEV；四写非 DEV 拒 WSP_007——TEST/PROD 纯运行不开放干预）。 */
    type WorkspaceEnvKind = 1 | 2 | 3;

    /** 沙箱置备状态：1=置备中 2=就绪 3=失败（置备中＝重活三写的 WSP_009 拒绝位）。 */
    type WorkspaceProvisioningStatus = 1 | 2 | 3;

    /** 期望态（DB 意图侧，ADR-0016）：1=运行 2=休眠 3=封存。 */
    type WorkspaceDesiredState = 1 | 2 | 3;

    /** 容器实态（docker 探查一瞥，不落库）：1=运行中 2=已停止 3=无容器 4=未知（探查失败的诚实位）。 */
    type WorkspaceContainerState = 1 | 2 | 3 | 4;

    /** 沙箱四写动作（wake/hibernate/rebuild/seal，均无 body）。 */
    type WorkspaceAction = 'wake' | 'hibernate' | 'rebuild' | 'seal';

    /** 中间件资源观测（详情 resources 元素）。kind 无 *Name 字段（契约如此）——专有名词端侧小映射（constants）。 */
    interface WorkspaceMiddlewareResource {
      /** 1=PostgreSQL 2=Redis（provider MiddlewareKind） */
      kind: 1 | 2;
      containerName: string;
      /** 连接串原文（容器内回环形态，排障用） */
      internalUrl: string;
    }

    /** 所属项目引用（软引用可空——工作区先于项目存在）。 */
    interface WorkspaceProjectRef {
      projectId: string;
      name: string;
      archived: boolean;
    }

    /** 沙箱列表行（GET /workspaces items 元素；新沙箱在前＝TSID 倒序，服务端定死）。 */
    interface WorkspaceSummary {
      /** TSID → string */
      workspaceId: string;
      containerName: string;
      kind: WorkspaceEnvKind;
      kindName: string;
      status: WorkspaceProvisioningStatus;
      statusName: string;
      desiredState: WorkspaceDesiredState;
      desiredStateName: string;
      containerState: WorkspaceContainerState;
      containerStateName: string;
      lastTouchAt: string;
      /** Long（字节）→ JSON string；封存容缺（卷已删）/探查失败为 null */
      volumeSizeBytes: string | null;
      sealedAt: string | null;
      /** Long（字节）→ JSON string；未封存为 null */
      archiveSizeBytes: string | null;
      /** 所属项目引用（无所属项目为 null） */
      project: WorkspaceProjectRef | null;
    }

    /** 沙箱详情（GET /workspaces/{id}；清单行超集——另带网络名/置备失败原因/封存包寻址键/审计列/中间件资源）。 */
    interface WorkspaceDetail extends WorkspaceSummary {
      networkName: string;
      /** 置备失败原因（FAILED 态非 null，其余 null） */
      provisionError: string | null;
      /** 封存包寻址键（未封存为 null） */
      archivePath: string | null;
      createdAt: string;
      updatedAt: string;
      resources: WorkspaceMiddlewareResource[];
    }

    /** GET /workspaces 查询参数。分页 1-based 直传；desired/actual 单选单值、可组合、均可缺省（缺省=全量）。 */
    interface WorkspaceSearchParams {
      page: number;
      size: number;
      /** 期望态单选（1=运行 2=休眠 3=封存） */
      desired?: WorkspaceDesiredState;
      /** 容器实态单选（1=运行中 2=已停止 3=无容器 4=未知）——漂移清单=desired 1+actual 3 组合 */
      actual?: WorkspaceContainerState;
    }

    type WorkspaceFilter = Omit<WorkspaceSearchParams, 'page' | 'size'>;

    /* ---- 成本域（#61）---- */

    /**
     * token 用量五档（成本域四端点共用载荷）。与订单金额的 Long-string 口径**有意不同**：
     * 后端 DTO 为 primitive long → JSON **数字**（swagger integer/int64；非包装 Long 的字符串序列化）。
     */
    interface TokenUsage {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      reasoning: number;
    }

    /** 分模型聚合项（provider + model 为单价表匹配键）。 */
    interface ModelUsage {
      provider: string;
      model: string;
      tokens: TokenUsage;
    }

    /** 分智能体聚合项（agentKind 裸维度串原值；辅助标记 agentKindName 为 null——前端落「—」桶）。 */
    interface AgentKindUsage {
      agentKind: string | null;
      agentKindName: string | null;
      tokens: TokenUsage;
    }

    /** 平台成本全局总览（GET /costs/overview）。 */
    interface CostOverview {
      from: string;
      to: string;
      total: TokenUsage;
      /** 按币种分桶（admin#75 已文档化——ISO 4217 码 → 金额直读不折算；空对象＝无用量或全未配价） */
      cost?: Record<string, number>;
      byModel: ModelUsage[];
      byAgentKind: AgentKindUsage[];
    }

    /**
     * 全局 unpriced 档位项（tokenKind 1=输入…5=推理 6=按张 + tokenKindName 随行；tokens 只计无价
     * 分量——按张行 tokens=张数，#77）。tokenKind 故意宽 number：档位枚举语义归单价表域
     * PriceTokenKind 钉、本域只直读档位名。
     */
    interface UnpricedTierUsage {
      provider: string;
      model: string;
      tokenKind: number;
      tokenKindName: string;
      tokens: number;
    }

    /** unpriced 全局警示（GET /costs/unpriced；空窗/无未配价用量 = 空 items 非错误）。 */
    interface UnpricedUsage {
      from: string;
      to: string;
      items: UnpricedTierUsage[];
    }

    /** 项目成本清单行（GET /costs/projects items；排序服务端定死成本降序、全未配价排后）。 */
    interface ProjectCost {
      /** 计量 subject 原值（TSID 十进制串；已删项目照列——项目名归前端互查，不解释存在性） */
      projectId: string;
      total: TokenUsage;
      /** 按币种分桶（admin#75 已文档化——ISO 4217 码 → 金额直读不折算；空对象＝无用量或全未配价） */
      cost?: Record<string, number>;
      /** 全未配价标注（有用量但无任何已配价分量——true 时成本不完整） */
      allUnpriced: boolean;
    }

    /**
     * 单项目下钻 unpriced 档位项（**无 tokens**——bySubject 口径无 token 计数，档位用量汇总走
     * 全局 unpriced 端点；下钻端点 description 自述）。swagger `UnpricedTier` 同名 schema 与全局
     * 端点嵌套 record 撞名合并成带 tokens 的单形——以下钻端点 description 为准（tokens 不渲染）。
     */
    interface UnpricedTierMark {
      provider: string;
      model: string;
      tokenKind: number;
      tokenKindName: string;
    }

    /** 单项目成本下钻（GET /costs/projects/{projectId}；无用量/查无此号 = 全零 total + 空结构，非 404）。 */
    interface ProjectCostDetail {
      projectId: string;
      from: string;
      to: string;
      total: TokenUsage;
      /** 按币种分桶（admin#75 已文档化——ISO 4217 码 → 金额直读不折算；空对象＝无用量或全未配价） */
      cost?: Record<string, number>;
      unpriced: UnpricedTierMark[];
      byModel: ModelUsage[];
      byAgentKind: AgentKindUsage[];
    }

    /** 成本域时间窗（from/to 必填——BFF 不设默认窗口，缺参 400；半开 [from,to)）。 */
    interface CostWindowParams {
      /** ISO-8601 Instant UTC 带 Z（如 2026-09-01T00:00:00Z） */
      from: string;
      to: string;
    }

    /** GET /costs/projects 查询参数（时间窗 + 分页 1-based 直传）。 */
    interface CostProjectSearchParams extends CostWindowParams {
      page: number;
      size: number;
    }

    /* ---- 单价表域（#62）---- */

    /** token 档位（单价表）：1=输入 2=输出 3=缓存读 4=缓存写 5=推理 6=按张（tokenKindName 中文名随行直读）。 */
    type PriceTokenKind = 1 | 2 | 3 | 4 | 5 | 6;

    /**
     * 单价行（清单行 = 改价回执 closed/opened 行 = 停用回执，同 schema `AiplatformUnitPriceEntryResponse`）。
     * 清单含历史行全量（价史全貌），排序服务端定死＝生效起点倒序（新段在前，同起点 id 倒序稳定）；
     * `effectiveTo` null 即当前行（改价/停用目标位，其余为已关历史行）。operator 两列为该行**最近
     * 管理动作**留痕（开行或停用；种子行 null）。
     */
    interface UnitPriceEntry {
      /** TSID → string */
      id: string;
      provider: string;
      model: string;
      tokenKind: PriceTokenKind;
      tokenKindName: string;
      /** BigDecimal 明文小数 → JSON string（请求侧 number——REQ-20 #75）；按 token 计价，非每千 token */
      unitPrice: string;
      /** ISO 4217 */
      currency: string;
      /** ISO-8601 Instant UTC 带 Z */
      effectiveFrom: string;
      /** null = 当前行 */
      effectiveTo: string | null;
      operatorId: string | null;
      operatorName: string | null;
    }

    /** GET /price-entries 查询参数。provider/model 为匹配键成分＝精确等值过滤、均可缺省（缺省=全量行）。 */
    interface PriceEntrySearchParams {
      page: number;
      size: number;
      provider?: string;
      model?: string;
    }

    type PriceEntryFilter = Omit<PriceEntrySearchParams, 'page' | 'size'>;

    /**
     * POST /price-entries/{id}/reprice body——unitPrice JSON **number**（BigDecimal 语义，区别于响应
     * string）；currency ISO 4217（非 ISO 400 METER_010）；effectiveFrom ISO-8601 Instant UTC 带 Z
     * （未来时点=预发布，重叠校验 provider 裁决 409 METER_008）。
     */
    interface RepriceCommand {
      unitPrice: number;
      currency: string;
      effectiveFrom: string;
    }

    /** 原子改价回执（同事务两步=库内事实）：closed 保留原开行操作者、effectiveTo=新起点；opened 敞口生效。 */
    interface RepriceReceipt {
      closed: UnitPriceEntry;
      opened: UnitPriceEntry;
    }

    /* ---- 素材域（#63）---- */

    /** 素材状态（两态）：1=启用 2=停用——停用可逆（enable 恢复命中），两写重复均幂等。 */
    type MaterialStatus = 1 | 2;

    /** 素材治理三写动作（disable/enable 可逆开关 + delete 不可逆移除；权限码 Record 的键约束）。 */
    type MaterialAction = 'disable' | 'enable' | 'delete';

    /**
     * 素材列表行（GET /materials items 元素 = 三写回执，同 schema `AiplatformMaterialSummaryResponse`）。
     * 排序服务端定死沉淀时间倒序（新沉淀在前）；operator 两列＝最近管理动作留痕（未治理过为 null）。
     */
    interface MaterialSummary {
      /** TSID → string */
      id: string;
      /** 素材类别裸值（v1 恒 "PRD"——无 *Name 字段，专有名词直显） */
      kind: string;
      projectId: string;
      projectName: string;
      title: string;
      status: MaterialStatus;
      statusName: string;
      /** 首沉淀时间（重沉淀与治理动作不改） */
      sunkAt: string;
      operatorId: string | null;
      operatorName: string | null;
    }

    /** 素材详情（GET /materials/{id}；清单行超集——content＝块按 seq 空行拼接的素材全文）。 */
    interface MaterialDetail extends MaterialSummary {
      content: string;
    }

    /** GET /materials 查询参数。分页 1-based 直传；status 单选单值（缺省＝全部）。 */
    interface MaterialSearchParams {
      page: number;
      size: number;
      /** 状态单选（1=启用 2=停用；缺省＝全部） */
      status?: MaterialStatus;
      /** 沉淀时间区间（首沉淀，闭区间含两端）——ISO-8601 Instant UTC 带 Z */
      sunkFrom?: string;
      sunkTo?: string;
      /** 来源项目 id 精确（登记面字符串，查无＝空清单 200） */
      projectId?: string;
    }

    type MaterialFilter = Omit<MaterialSearchParams, 'page' | 'size'>;

    /* ---- 技能域（#67 技能管理——技能线 8 端点；#71 观测扩展）---- */

    /** 技能来源（三态）：1=内置 2=安装 3=自产（sourceName 中文名随行直读；自产行 sourcePackage/version＝虚拟值 self）。 */
    type SkillSource = 1 | 2 | 3;

    /** 技能状态（两态）：1=启用 2=停用——与素材域同构；内置恒 1（启停对内置行的裁决归 provider 透传）。 */
    type SkillStatus = 1 | 2;

    /** 技能管理五写动作（install 单独门控触发按钮；disable⇄enable 互斥；uninstall/update 仅安装行）。 */
    type SkillAction = 'install' | 'disable' | 'enable' | 'uninstall' | 'update';

    /**
     * 技能列表行（GET /skills 全量元素 = install 回执条目 = update 回执终态行集，同 schema
     * `AiplatformSkillSummaryResponse`）。清单无分页（有界目录）、服务端排序内置在前。
     */
    interface SkillSummary {
      /**
       * 技能柄（opaque 串两形制，详情寻址键）：内置＝`builtin:<技能名>` / 安装＝TSID 十进制串
       * ——一律 string 透传，禁止数值化。
       */
      id: string;
      name: string;
      description: string;
      source: SkillSource;
      sourceName: string;
      /** 来源包标识（安装仓库规范化地址）；内置 null、自产＝固定虚拟值 `self`（清单扫视面 `-` 占位、详情如实直读） */
      sourcePackage: string | null;
      /** 版本标识（装时/上次更新 commit）；内置 null、自产＝固定虚拟值 `self` */
      version: string | null;
      status: SkillStatus;
      statusName: string;
      operatorId: string | null;
      operatorName: string | null;
      /**
       * 远端有新版标记（来源包级）：true=远端 HEAD≠装时版本；null=未检查过（内置恒 null 不适用）
       * ——展示性标记，**不门控更新动作**（provider 不保证检查过，更新永远显式点）。
       */
      updateAvailable: boolean | null;
      /**
       * 加载次数（使用计数观测面，#71）：**JSON string 形态**（Long 全局序列化同 id 口径——
       * "5"/"0"/null 三态）；口径＝load 实际发生（指派/启停/清单重建不计数）；"0"＝从未被
       * 加载过、null＝内置不适用。呈现三态：千分位 / 「从未加载」 / 「内置不适用」。
       */
      loadCount: string | null;
      /** 最近加载时刻（使用计数观测面，#71）；null＝从未被加载过（内置恒 null）。 */
      lastLoadedAt: string | null;
    }

    /** 技能详情（GET /skills/{id}；清单行超集——frontmatter 解析态 + 正文全文 + scripts/ 资源面）。 */
    interface SkillDetail extends SkillSummary {
      /** SKILL.md frontmatter 全量（自由 map——审核面所见即运行时注入面，键值原样直出） */
      frontmatter: Record<string, unknown>;
      /** SKILL.md 正文（frontmatter 剥离后全文） */
      content: string;
      /**
       * scripts/ 资源面（#71 观测扩展）：相对路径→内容全文；**仅 Detail**、无 scripts/内置行
       * 恒空对象 `{}`（非 null——空对象不渲染节）。
       */
      resources: Record<string, string>;
    }

    /** POST /skills/install body——安装命令无 tag/ref 字段，版本恒＝装时 HEAD commit。 */
    interface InstallSkillCommand {
      /** 技能仓库 git 地址（https/ssh/本地路径——clone 走宿主 git 凭据） */
      repoUrl: string;
      /** 排除目录段名单（可缺省）：仓库相对路径任一段命中即不入库（段名精确匹配） */
      excludeDirs?: string[];
    }

    /** POST /skills/update body——sourcePackage 取技能清单行原值回传。 */
    interface UpdateSkillCommand {
      sourcePackage: string;
    }

    /**
     * 显式更新回执（POST /skills/update）：from==to＝远端未前进（幂等，未落痕未写行）；
     * removedSkillNames＝本次移除的技能名（有指派在身的移除会令整体 409 SKL_013，不至此）；
     * skills＝更新后该来源包全部条目（同名行原地翻新保留 id/状态/指派）。
     */
    interface SkillUpdateReceipt {
      sourcePackage: string;
      fromVersion: string;
      toVersion: string;
      removedSkillNames: string[];
      operatorId: string;
      operatorName: string;
      skills: SkillSummary[];
    }

    /** 更新留痕行（GET /skills/update-traces?sourcePackage=；倒序 append-only、卸载不删痕）。 */
    interface SkillUpdateTrace {
      sourcePackage: string;
      fromVersion: string;
      toVersion: string;
      operatorId: string;
      operatorName: string;
      operatedAt: string;
    }

    /* ---- 草稿域（#71 草稿审核——技能线 drafts 4 端点；admin #92 镜像 aiplatform #259 自产线）---- */

    /**
     * 草稿状态：1=在途 2=已晋升 3=已拒绝——**清单＝活跃面恒 1**（终态不列活跃面）；
     * 详情任意状态可查（终态留档——拒绝回执即终态详情直读）。
     */
    type SkillDraftStatus = 1 | 2 | 3;

    /**
     * 写入前静态扫描判定（两值封闭）：SAFE=安全 / CAUTION=注意——DANGEROUS 已在写入口
     * 拒收不落库（值域不可达）；label/tag 端侧映射。
     */
    type SkillScanVerdict = 'SAFE' | 'CAUTION';

    /** 草稿两审核写动作（晋升/拒绝；权限码 Record 的键约束）。 */
    type SkillDraftAction = 'promote' | 'reject';

    /**
     * 草稿清单行（GET /skills/drafts 全量元素＝在途活跃面，**不分页**、自荐时间倒序——
     * 有界人审队列不造分页）。id 为 TSID 十进制串透传；血统三件（projectId/runId/slot）为
     * 审核溯源锚（来源 run 的外部资料接触史必查——人审职责，前端仅呈现材料）。
     */
    interface SkillDraftSummary {
      /** 草稿柄（详情/审核操作寻址，TSID 十进制串勿做数值假设；未寻址 404 SKL_015） */
      id: string;
      /** 技能名（撞名判断键——晋升时撞名复查 SKL_016） */
      name: string;
      description: string;
      /** 来源槽位稳定键（main/executor/subagent——复用指派域 SkillSlot；响应无 slotName，label 端侧映射） */
      slot: SkillSlot;
      /** 来源项目 id（血统三件之一） */
      projectId: string;
      /** 来源 run 标识（血统三件之一） */
      runId: string;
      /** 写入前静态扫描判定（SAFE/CAUTION） */
      scanVerdict: SkillScanVerdict;
      /** 状态 code（清单＝活跃面恒 1） */
      status: SkillDraftStatus;
      statusName: string;
      /** 自荐时刻（清单按此刻倒序） */
      createdAt: string;
    }

    /**
     * 草稿详情（GET /skills/drafts/{id}；清单行超集＝人审判读承载面，**任意状态可查**——
     * 终态留档）。scanFindings 为 untyped map 清单逐字透传（七键 patternId/severity/category/
     * file/line/matchText/description 仅 swagger 描述层——投影缺键跳过、值直显）；空列表＝无发现。
     * 终态留痕四字段在途恒 null（拒绝回执即本形状直读——唯一终态留痕呈现面）。
     */
    interface SkillDraftDetail extends SkillDraftSummary {
      /** 技能正文全文（自产 a-only 无 scripts；判读主体，不经截断/改写） */
      content: string;
      /** 扫描 findings 留档（untyped map；空列表＝无发现） */
      scanFindings: Record<string, unknown>[];
      /** 终态审核操作者 id（在途为 null） */
      operatorId: string | null;
      /** 终态审核操作者名（在途为 null） */
      operatorName: string | null;
      /** 终态时刻（晋升/拒绝落定时刻；在途为 null） */
      reviewedAt: string | null;
      /** 拒绝理由（已拒绝态携带；其余 null） */
      rejectReason: string | null;
    }

    /** POST /skills/drafts/{id}/reject body——理由合法性由 provider 裁决（空白 400 SKL_018 兜底；前端必填先行拦截）。 */
    interface RejectSkillDraftCommand {
      reason: string;
    }

    /* ---- 指派域（#68 指派配置＋#72 预检——技能线 assignments 2＋precheck 1 端点，每槽位一个 GET/PUT/POST）---- */

    /** 职能槽位（三槽，路径段寻址）：main=主智能体 / executor=run 执行体 / subagent=子智能体——响应无 slotName，label 端侧映射。 */
    type SkillSlot = 'main' | 'executor' | 'subagent';

    /**
     * 槽位指派读面（GET/PUT /skills/assignments/{slot} 回执同形）：slot 回显 + 已指派技能清单行
     * （与技能清单行共形、含停用行——「指派了但已停用」实态如实呈现；停用行不参与装配合成，
     * 停用不解除指派）。装配生效语义＝动态查库：变更后智能体下一轮自然生效。
     */
    interface SlotAssignment {
      slot: SkillSlot;
      skills: SkillSummary[];
    }

    /**
     * PUT /skills/assignments/{slot} body——skillIds 即该槽位终态（整包替换：未列入＝解绑、
     * 空清单＝清空）；只收安装库行 TSID 柄，内置 `builtin:` 柄 400 SKL_011（装配按配置挂载）。
     */
    interface SkillAssignCommand {
      skillIds: string[];
    }

    /* ---- 指派预检（#72 指派配置——技能线 precheck 1 端点，非阻断重叠判定）---- */

    /**
     * 预检重叠提示（回执 hints 成员）：skills＝涉及的**候选技能名**清单（非柄，直渲免映射）；
     * counterpart（「工作协议」或对侧技能名）/ overlap / resolution 三 String 可 null——模型
     * 输出解析态，出 JSON null 如实在场、按「—」占位呈现不臆造兜底文案。
     */
    interface PrecheckHint {
      skills: string[];
      counterpart: string | null;
      overlap: string | null;
      resolution: string | null;
    }

    /**
     * POST /skills/assignments/{slot}/precheck 回执——指派双头预检（对照＝该槽生效工作协议 ∪
     * 该槽已指派启用技能 ∪ 候选集内其他技能；模型判定 15s 档、可降级不重试）。两态纪律：
     * executed=true 且 hints 空＝确认无重叠；executed=false＝**未执行**（判定失败/超时/输出
     * 不可解析，hints 恒空）——不得当「无重叠」呈现。非阻断：预检结果不拦 PUT 指派。
     */
    interface SkillAssignmentPrecheck {
      executed: boolean;
      hints: PrecheckHint[];
    }

    /* ---- 智能体配置域（#69 智能体配置，技能线 agent-configs 3 + agent-tools 2 端点）---- */

    /** 配置座稳定键（两座，路径段寻址）：main=主智能体 / executor=run 执行体——未知键 404 PRJ_033（4033）。 */
    type AgentKey = 'main' | 'executor';

    /**
     * 工具面类别（string 裸值三态，**无 *Name 字段**——端侧小映射）：SKELETON=骨架
     * （编排链路＋项目事实只读件，结构性锁死）/ ENHANCEMENT=增强（联网搜索·网页抓取，
     * 窄幅可开关）/ HARNESS_BUILTIN=harness 内建编码工具（呈现口径，不可开关）。
     */
    type AgentToolKind = 'SKELETON' | 'ENHANCEMENT' | 'HARNESS_BUILTIN';

    /**
     * 智能体配置读面（GET/PUT /agent-configs/{agentKey} 回执同形）：生效值（库覆盖值或枚举
     * 默认）＋覆盖标记＋默认预览＋两增强工具开关＋最近写者。覆盖标记与生效值分治：false 时
     * 生效值即 default* 原文；operator 两列 null＝从未配置。
     */
    interface AgentConfig {
      agentKey: AgentKey;
      /** 展示名（主智能体/run 执行体——契约直读） */
      agentName: string;
      /** 生效 systemPrompt（装配实取值；覆盖时非 default 原文） */
      systemPrompt: string;
      /** 生效模型档位裸名 */
      modelId: string;
      systemPromptOverridden: boolean;
      modelIdOverridden: boolean;
      /** 枚举默认 systemPrompt（预览：清空覆盖即落此值） */
      defaultSystemPrompt: string;
      /** 枚举默认模型档位（清空覆盖即落此值） */
      defaultModelId: string;
      /** 联网搜索开关生效态（关即退出槽位装配面） */
      webSearchEnabled: boolean;
      /** 网页抓取开关生效态 */
      fetchUrlEnabled: boolean;
      operatorId: string | null;
      operatorName: string | null;
      updatedAt: string | null;
    }

    /**
     * PUT /agent-configs/{agentKey} body——全量终态：systemPrompt/modelId null/缺省/纯空白＝
     * 清空覆盖回落枚举默认；webSearchEnabled/fetchUrlEnabled **缺省＝true（开）**——前端保存
     * 时四字段全量回传（两 flag 以 GET 回显原值透传，防静默误开）。值面无动＝幂等回执
     * （不落痕不写行）。
     */
    interface AgentConfigUpdateCommand {
      systemPrompt: string | null;
      modelId: string | null;
      webSearchEnabled: boolean;
      fetchUrlEnabled: boolean;
    }

    /**
     * 配置变更留痕行（GET /agent-configs/{agentKey}/traces；服务端定死 operatedAt 倒序＝最近先）：
     * old/new 四件对全量快照，null＝缺省回落态；**无专用回滚端点**——回滚＝old 四值快照
     * PUT 写回（＝一次新变更、留新痕）。
     */
    interface AgentConfigTrace {
      /** TSID 十进制串 */
      id: string;
      oldSystemPrompt: string | null;
      oldModelId: string | null;
      oldWebSearchEnabled: boolean;
      oldFetchUrlEnabled: boolean;
      newSystemPrompt: string | null;
      newModelId: string | null;
      newWebSearchEnabled: boolean;
      newFetchUrlEnabled: boolean;
      operatorId: string;
      operatorName: string;
      operatedAt: string;
    }

    /** 工具面行（GET /agent-tools tools 元素 = PUT /agent-tools/{toolName} 回执，同 schema）：骨架/harness 内建恒 true 锁死、增强按运营配置生效态。 */
    interface AgentTool {
      /** 工具注册名（模型可见名＝开关按名寻址键；清单读面即全集） */
      name: string;
      kind: AgentToolKind;
      /** 挂载态（false＝在册但退出装配面——模型不可见） */
      enabled: boolean;
      description: string;
    }

    /**
     * 工具面槽位块（GET /agent-tools 元素）：slot 与技能槽位同键、slotName 中文名随行直读；
     * 呈现序＝平台资产在前、harness 内建在后。增强两件挂载态＝main 座配置 flag（开关窄幅写口
     * 挂 main 行开关列）——读面两入口同源。
     */
    interface AgentToolSlot {
      slot: SkillSlot;
      slotName: string;
      tools: AgentTool[];
    }

    /** PUT /agent-tools/{toolName} body——enabled 必填无缺省（缺省 null 400 PRJ_037）。 */
    interface AgentToolToggleCommand {
      enabled: boolean;
    }

    /**
     * 账号档案（GET /accounts/{externalId}；有码无页——订单/项目详情抽屉嵌件按 externalId 查，
     * 认交易对手）。externalId＝OIDC sub＝identity 账户 Id；未命中 404 IDN_004（业务码 6004）。
     */
    interface AccountProfile {
      /** aiplatform 侧账号 TSID → 十进制 string */
      id: string;
      externalId: string;
      displayName: string;
      createdAt: string;
    }

    /* ---- 合同域（#87 A 批 T1——contracts 9 端点：读 2＋创建重建 1＋六写口；六态人工承接）---- */

    /**
     * 合同状态（六态人工推进）：1=准备中 2=待核对与签署 3=签署进行中 4=签署完成
     * 5=签署失败或过期 6=已撤回或作废。线性单向 1→2→3→4（末边须双方均签）；
     * 5 自 2/3 旁落、6 自 1/2/3 旁支（撤回/作废守卫同、留痕 action 分立）；4/5/6 终态不删。
     */
    type ContractStatus = 1 | 2 | 3 | 4 | 5 | 6;

    /** 合同七写动作（门控矩阵与权限码 Record 的键约束；create 重建走订单抽屉入口不在此列）。 */
    type ContractAction = 'advance' | 'fail' | 'withdraw' | 'void' | 'sign' | 'record';

    /** 留痕动作 code（transitions.action）：1=推进 2=撤回 3=作废 4=签署标记 5=草稿重录 6=失败或过期。 */
    type ContractTransitionAction = 1 | 2 | 3 | 4 | 5 | 6;

    /**
     * 合同清单行（GET /contracts items 元素）——**不带** needsUpdate/签署位（wire 如此，
     * 两字段仅详情可观测）。新在前（TSID 倒序服务端定死）；version 草稿同号重录 +1、重建从 1 起。
     */
    interface ContractSummary {
      /** 合同标识（TSID 十进制串） */
      id: string;
      /** 合同号（SG- 风格全局唯一，创建即定格） */
      contractNo: string;
      /** 所属订单标识（TSID 十进制串） */
      orderId: string;
      status: ContractStatus;
      statusName: string;
      version: number;
      /** Long（分）→ JSON string */
      amount: string;
      /** v1 恒 CNY */
      currency: string;
      createdAt: string;
    }

    /**
     * 合同全字段（详情 contract 段＝七写回执共用同构）——清单行超集：needsUpdate 派生标志、
     * 四个后台录入预览字段（未录入 null）、范围快照冻结三段（创建/重录时取订单范围文本定格，
     * 此后不漂移）、双版本引用、双方签署位＋落签时点。签署标记不自动迁移状态（advance 显式推进）。
     */
    interface Contract extends ContractSummary {
      /** 「需更新」派生标志：草稿态（1/2）且冻结集与订单现值不一致；非草稿态恒 false */
      needsUpdate: boolean;
      /** 甲方主体（客户方；后台录入，未录入 null） */
      partyA: string | null;
      /** 乙方主体（服务方；后台录入，未录入 null） */
      partyB: string | null;
      /** 项目范围（后台录入，未录入 null） */
      projectScope: string | null;
      /** 付款计划文本面（后台录入，未录入 null；节点对象归付款计划域） */
      paymentPlan: string | null;
      /** 范围快照·交付清单（冻结副本） */
      scopeDeliverables: string;
      /** 范围快照·验收方式（冻结副本） */
      scopeAcceptance: string;
      /** 范围快照·工期口径（冻结副本） */
      scopeTimeline: string;
      /** PRD 确认版本号（下单冻结集冗余） */
      prdVersionNo: number | null;
      /** Demo 确认版本号引用（下单冻结集；无 Demo 交付的订单 null） */
      demoVersionNo: number | null;
      /** 甲方签署位（未签 false） */
      partyASigned: boolean;
      /** 甲方落签时点（未签 null） */
      partyASignedAt: string | null;
      /** 乙方签署位 */
      partyBSigned: boolean;
      /** 乙方落签时点（未签 null） */
      partyBSignedAt: string | null;
    }

    /**
     * 合同详情（GET /contracts/{id}）——承接核对全量面三段：contract 全字段＋PRD 确认版全文
     * 冗余拷贝（合同自含，报价/录内容的依据面）＋动作留痕时间线（新→旧 append-only 全量）。
     */
    interface ContractDetail {
      contract: Contract;
      prdSnapshot: string;
      transitions: ContractTransition[];
    }

    /** 合同动作留痕行（transitions 元素，新→旧）——迁移类如实记两侧状态、非迁移类（签署标记/草稿重录）from=to。 */
    interface ContractTransition {
      action: ContractTransitionAction;
      actionName: string;
      fromStatus: ContractStatus;
      fromStatusName: string;
      toStatus: ContractStatus;
      toStatusName: string;
      /** 依据（人工动作留痕正身，必填） */
      basis: string;
      operatorId: string;
      operatorName: string;
      createdAt: string;
    }

    /** GET /contracts 查询参数。分页 1-based 直传；`status` 多选逗号拼接（同订单域 BFF 签名协议）。 */
    interface ContractSearchParams {
      page: number;
      size: number;
      /** 状态多选（序列化为逗号分隔单值 status=1,5） */
      status?: ContractStatus[];
      /** 创建时间起（含），ISO-8601 本地串 */
      createdFrom?: string;
      createdTo?: string;
      /** 所属订单精确（TSID 十进制） */
      orderId?: string;
      /** 合同号精确（SG- 串） */
      contractNo?: string;
    }

    type ContractFilter = Omit<ContractSearchParams, 'page' | 'size'>;

    /** POST /contracts/{id}/advance|fail|withdraw|void body——依据必填（至多 1000 字，provider 裁决 ORD_022/023）。 */
    interface ContractActionCommand {
      basis: string;
    }

    /** 签署方（sign 命令 party）：1=甲方（客户方） 2=乙方（服务方）。 */
    type ContractSignParty = 1 | 2;

    /** POST /contracts/{id}/sign body——落一方签署位（已落签幂等拒 409 ORD_028；仅签署进行中可达）。 */
    interface ContractSignCommand {
      party: ContractSignParty;
      basis: string;
    }

    /**
     * POST /contracts/{id}/record body——草稿重录五肢整组（仅草稿态 1/2 可达，ORD_031）：
     * 四预览字段整组录入（空白归一 null＝未录入）＋冻结集取订单现值重新定格＋version+1＋
     * needsUpdate 清零。内容长度 provider 裁决（ORD_032：主体 200/其余 2000）。
     */
    interface ContractRecordCommand {
      partyA: string | null;
      partyB: string | null;
      projectScope: string | null;
      paymentPlan: string | null;
      basis: string;
    }
  }
}
