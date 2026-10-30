declare namespace Api {
  /**
   * namespace Payment
   *
   * backend api module: 支付管理（admin 后端 `/api/admin/payment/**`，BFF 透传 payment 能力域）。
   * 独立限界上下文（后端 `com.semgravio.admin.payment` 子包），体量最大，不并入 SystemManage。
   *
   * 分页约定同 SystemManage：请求 `page` **1-based**、响应 `PageResponse{ items, total, page(1-based), size }`。
   *
   * ⚠️ payment 枚举线上序列化（#54 对齐 admin ADR-0009/0011）：BaseEnum（PaymentStatus / PayMode / …）
   * 出口为 **Integer code → JSON number**（如 `status: 2`），配同名 `*Name` 中文名（`statusName` /
   * `payModeName` …，后端已透传，前端直读展示）；code 仅用于标签配色。**请求侧**（筛选下拉 value /
   * `statuses` 等查询参数）仍按 code 字符串提交——后端绑 Integer，见下方 code 字面量类型。
   * 纯 String token（LogType / result）按 token 字面量建模、原值展示。
   *
   * ⚠️ 金额（amount / refundAmount / 各分桶 amount / refundBacklog.pendingAmount …）单位 = **整数分**，
   * 类型一律 **string**（payment 域 `Long`，框架全局 Long→JSON string，admin BFF 同型透传、零换算——
   * ADR-0011）。前端算术/比较入口统一显式 `Number(...)`；展示经 `formatMoney`（内部 ÷100）；
   * 金额筛选 `amountMin/Max` 同样以分提交（UI 元换算）。
   */
  namespace Payment {
    // ---- 枚举字面量（请求侧 code 字符串）----
    //
    // payment 域枚举分两类（#54 对齐 admin ADR-0009/0011，契约源：payment domain enums + ContractTest）：
    //  1. BaseEnum（Integer code）：PaymentStatus / PayMode / AccessType / PaymentChannel /
    //     RefundStatus / AuditType / OperationType / OperationLogTargetType。**响应侧**经 admin BFF
    //     出口为 Integer code → JSON **number**（如 `status: 2`），配 `*Name` 中文名（后端已透传，
    //     前端直读展示）；code 仅用于标签配色（`enumTagColor` 经 String() 归一查表）。
    //     **请求侧**（筛选下拉 value / `statuses` 等查询参数）按下方 code 字符串字面量建模提交——
    //     后端绑 Integer，字符串 code 可直接绑定（NSelect value 也须 string）。
    //  2. 纯 String token（非 enum）：LogType（PaymentLog.logType 列）、OperationLog.result、
    //     lifecycle 的 action / outcome。取值稳定但非闭合，线上即 token 本身（如 `"PAYMENT_REQUEST"`），
    //     按 token 字面量建模、原值展示。

    /** 支付订单状态 code（payment PaymentStatus）：1=待支付 2=已支付 3=支付失败 4=已取消 5=已过期 */
    type PaymentStatus = '1' | '2' | '3' | '4' | '5';

    /** 支付方式 code（payment PayMode）：9=微信 10=支付宝 13=云闪付 */
    type PayMode = '9' | '10' | '13';

    /** 接入类型 code（payment AccessType）：5=APP 7=微信公众号 8=支付宝生活号 9=小程序 */
    type AccessType = '5' | '7' | '8' | '9';

    /** 支付通道 code（payment PaymentChannel）：1=工商银行 */
    type PaymentChannel = '1';

    /** 退款订单状态 code（payment RefundStatus）：1=待审核 2=已拒绝 3=已批准 4=退款中 5=退款成功 6=退款失败 */
    type RefundStatus = '1' | '2' | '3' | '4' | '5' | '6';

    /** 退款审核类型 code（payment AuditType）：1=免审 2=人工审核 */
    type AuditType = '1' | '2';

    /** 通道交互日志类型（payment PaymentLog.logType；纯 String token，非闭合） */
    type LogType =
      | 'PAYMENT_REQUEST'
      | 'PAYMENT_QUERY'
      | 'PAYMENT_CANCEL'
      | 'REFUND_REQUEST'
      | 'REFUND_QUERY'
      | 'PAYMENT_CALLBACK';

    /** 订单操作类型 code（payment OperationType）：1=审核通过 2=审核拒绝 3=通知重发 */
    type OperationType = '1' | '2' | '3';

    /** 订单操作记录目标类型 code（payment OperationLogTargetType）：1=支付订单 2=退款订单 */
    type OperationTargetType = '1' | '2';

    // ---- 支付订单（列表 / 筛选）----

    /**
     * 后端 PaymentOrderSummaryResponse（GET /payments 列表项）。
     * 各字段为 payment 原值透传；`amount` 为整数分（Long→JSON **string**，#54/ADR-0011）；
     * 各类 `*No` 为字符串（防 Long 精度丢失）；枚举 code 为 JSON **number**（Integer）。
     */
    interface PaymentOrderSummary {
      paymentOrderNo: string;
      businessOrderNo: string;
      businessSystemName: string | null;
      /** payment PaymentStatus 枚举 code（Integer→number；配色经 enumTagColor 归一查表） */
      status: number;
      /** 状态中文名（后端序列化，直读展示；枚举可空时为 null） */
      statusName: string | null;
      /** 支付金额（整数分，Long→string；展示经 formatMoney） */
      amount: string;
      /** payment PayMode 枚举 code（Integer→number） */
      payMode: number | null;
      /** 支付方式中文名（后端序列化，直读展示） */
      payModeName: string | null;
      /** payment AccessType 枚举 code（Integer→number） */
      accessType: number | null;
      /** 接入类型中文名（后端序列化，直读展示） */
      accessTypeName: string | null;
      /** payment PaymentChannel 枚举 code（Integer→number） */
      paymentChannel: number | null;
      /** 支付通道中文名（后端序列化，直读展示） */
      paymentChannelName: string | null;
      /** 支付时间，可空（未支付）；ISO 字符串 */
      paidAt: string | null;
      /** 创建时间，ISO 字符串 */
      createdAt: string;
    }

    /**
     * GET /payments 搜索参数（后端 PaymentOrderQuery + Spring Pageable）。
     * 请求 `page` 为 **1-based**（响应 PageResponse.page 亦 1-based）。
     *
     * - `statuses` 多选（admin PaymentOrderQuery 绑 `List<Integer>`，前端提交字符串 code 可直接绑——
     *   axios qs 默认 indices 格式）；
     * - 金额区间（`amountMin/Max`）与时间区间（`createdAtFrom/To`、`paidAtFrom/To`）均为可空，
     *   空值由调用方剔除；金额单位分、时间为 ISO 字符串（`YYYY-MM-DDTHH:mm:ss`）。
     */
    interface PaymentOrderSearchParams {
      paymentOrderNo?: string | null;
      businessOrderNo?: string | null;
      businessSystemName?: string | null;
      /** 状态多选；null/空 = 不过滤 */
      statuses?: PaymentStatus[] | null;
      payMode?: PayMode | null;
      accessType?: AccessType | null;
      paymentChannel?: PaymentChannel | null;
      /** 金额下限（整数分，含） */
      amountMin?: number | null;
      /** 金额上限（整数分，含） */
      amountMax?: number | null;
      /** 创建时间起（ISO，含） */
      createdAtFrom?: string | null;
      /** 创建时间止（ISO，含） */
      createdAtTo?: string | null;
      /** 支付时间起（ISO，含） */
      paidAtFrom?: string | null;
      /** 支付时间止（ISO，含） */
      paidAtTo?: string | null;
      /** 1-based */
      page: number;
      size: number;
    }

    /** 支付订单筛选载荷（搜索参数去分页——分页由列表页管）。搜索组件 emit、列表页接收。 */
    type PaymentOrderFilter = Omit<PaymentOrderSearchParams, 'page' | 'size'>;

    // ---- 支付订单详情（GET /payments/{no}）----

    /**
     * 后端 PaymentOrderDetailResponse（GET /payments/{paymentOrderNo}）。
     *
     * 与列表项 {@link PaymentOrderSummary} 字段面当前一致，但详情是完整聚合投影、独立演进
     * （payment 契约定型后详情可新增字段）——故单立类型、不与列表项共用。
     * `amount` 为整数分（Long→JSON **string**）；枚举 code 为 JSON **number**；其余约定同列表项。
     */
    interface PaymentOrderDetail {
      paymentOrderNo: string;
      businessOrderNo: string;
      businessSystemName: string | null;
      /** payment PaymentStatus 枚举 code（Integer→number） */
      status: number;
      /** 状态中文名（后端序列化，直读展示） */
      statusName: string | null;
      /** 支付金额（整数分，Long→string） */
      amount: string;
      /** payment PayMode 枚举 code（Integer→number） */
      payMode: number | null;
      /** 支付方式中文名（后端序列化，直读展示） */
      payModeName: string | null;
      /** payment AccessType 枚举 code（Integer→number） */
      accessType: number | null;
      /** 接入类型中文名（后端序列化，直读展示） */
      accessTypeName: string | null;
      /** payment PaymentChannel 枚举 code（Integer→number） */
      paymentChannel: number | null;
      /** 支付通道中文名（后端序列化，直读展示） */
      paymentChannelName: string | null;
      /** 支付时间，可空（未支付）；ISO 字符串 */
      paidAt: string | null;
      /** 创建时间，ISO 字符串 */
      createdAt: string;
    }

    // ---- 退款订单（列表 / 筛选）----

    /**
     * 后端 RefundOrderSummaryResponse（GET /refunds 列表项）。
     * 各字段为 payment 原值透传；`refundAmount` 为整数分（Long→JSON **string**，#54/ADR-0011）；
     * 各类 `*No` 为字符串（防 Long 精度丢失）；枚举 code 为 JSON **number**（Integer）。
     *
     * ⚠️ 审核人出口仅 `auditorName`——payment 从不发送 `auditorId`/`auditedAt`（ghost，admin #59 删，
     * #54 前端同步）；按审核人筛选走 query 侧 `auditorId`（见 {@link RefundOrderSearchParams}）。
     */
    interface RefundOrderSummary {
      refundOrderNo: string;
      paymentOrderNo: string;
      businessOrderNo: string;
      businessSystemName: string | null;
      /** payment RefundStatus 枚举 code（Integer→number） */
      status: number;
      /** 状态中文名（后端序列化，直读展示） */
      statusName: string | null;
      /** 退款金额（整数分，Long→string；展示经 formatMoney） */
      refundAmount: string;
      /** payment AuditType 枚举 code（Integer→number；1=免审 / 2=人工）；未审核可空 */
      auditType: number | null;
      /** 审核类型中文名（后端序列化，直读展示） */
      auditTypeName: string | null;
      /** 审核人姓名，可空 */
      auditorName: string | null;
      /** 创建时间，ISO 字符串 */
      createdAt: string;
    }

    /**
     * GET /refunds 搜索参数（后端 RefundOrderQuery + Spring Pageable）。
     * 请求 `page` 为 **1-based**（响应 PageResponse.page 亦 1-based）。
     *
     * - `statuses` 多选（admin RefundOrderQuery 绑 `List<Integer>`，前端提交字符串 code 可直接绑——
     *   axios qs 默认 indices 格式）；
     * - 退款金额区间 `refundAmountMin/Max`（整数分）与创建时间区间 `createdAtFrom/To`（ISO 串）均可空，
     *   空值由调用方剔除；
     * - `auditorId` 为 Long，前端按 **string** 处理防精度丢失，提交字符串由后端绑 Long
     *   （**query 侧保留**——payment 支持按审核人筛选，仅响应出口无该字段，#54/ADR-0011）。
     */
    interface RefundOrderSearchParams {
      refundOrderNo?: string | null;
      paymentOrderNo?: string | null;
      businessOrderNo?: string | null;
      businessSystemName?: string | null;
      /** 状态多选；null/空 = 不过滤 */
      statuses?: RefundStatus[] | null;
      auditType?: AuditType | null;
      /** 审核人 ID（Long）—— string 防精度丢失，后端绑 Long */
      auditorId?: string | null;
      /** 退款金额下限（整数分，含） */
      refundAmountMin?: number | null;
      /** 退款金额上限（整数分，含） */
      refundAmountMax?: number | null;
      /** 创建时间起（ISO，含） */
      createdAtFrom?: string | null;
      /** 创建时间止（ISO，含） */
      createdAtTo?: string | null;
      /** 1-based */
      page: number;
      size: number;
    }

    /** 退款订单筛选载荷（搜索参数去分页——分页由列表页管）。搜索组件 emit、列表页接收。 */
    type RefundOrderFilter = Omit<RefundOrderSearchParams, 'page' | 'size'>;

    // ---- 退款订单详情（GET /refunds/{no}）----

    /**
     * 后端 RefundOrderDetailResponse（GET /refunds/{refundOrderNo}）。
     *
     * 与列表项 {@link RefundOrderSummary} 字段面当前一致（#54 起**同样带 `*Name`** 中文名——
     * 旧「refund 详情不含 *Name」以 payment 现契约为准作废），但详情是完整聚合投影、独立演进
     * （payment 契约定型后详情可新增字段）——故单立类型、不与列表项共用。
     * `refundAmount` 为整数分（Long→JSON **string**）；枚举 code 为 JSON **number**；
     * 审核人出口仅 `auditorName`（同列表项，ghost 已删）。
     */
    interface RefundOrderDetail {
      refundOrderNo: string;
      paymentOrderNo: string;
      businessOrderNo: string;
      businessSystemName: string | null;
      /** payment RefundStatus 枚举 code（Integer→number） */
      status: number;
      /** 状态中文名（后端序列化，直读展示） */
      statusName: string | null;
      /** 退款金额（整数分，Long→string） */
      refundAmount: string;
      /** payment AuditType 枚举 code（Integer→number；1=免审 / 2=人工）；未审核可空 */
      auditType: number | null;
      /** 审核类型中文名（后端序列化，直读展示） */
      auditTypeName: string | null;
      /** 审核人姓名，可空 */
      auditorName: string | null;
      /** 创建时间，ISO 字符串 */
      createdAt: string;
    }

    /**
     * 退款审核请求体（POST /refunds/{refundOrderNo}/audit，后端 RefundAuditCommand）。
     *
     * 只承载运营人员的**决策意图**：`agreed=true` 通过 / `false` 拒绝，外加可选 `remark`（≤512）。
     * **不含** auditorId / auditorName——审核人身份由 admin 服务端从 RequestContext 注入、前端不可伪造
     * （见 payment-admin spec「操作者身份透传」、issue #42）。
     *
     * ⚠️ reject 时前端**强制**要求 remark（issue #48 验收：reject 必填 reason，空则禁提交）；
     * approve 时 remark 选填。后端校验 `agreed` 非空、`remark` ≤512。
     */
    interface RefundAuditRequest {
      /** 审核决策：true=通过（approve）、false=拒绝（reject） */
      agreed: boolean;
      /** 审核备注（选填，≤512；前端 reject 时必填） */
      remark?: string;
    }

    // ---- 通道交互日志（列表 / 筛选，GET /payment-logs）----

    /**
     * 后端 PaymentLogSummaryResponse（GET /payment-logs 列表项）。
     * payment 全字段为基础类型（无枚举语义），admin 原值透传、不做翻译。
     *
     * - `id` / `executionTime` 为 Long → 经全局 Jackson `Long→string` 序列化为 JSON **字符串**，按 string 处理防精度丢失；
     * - `httpStatus` 为 Integer → number；`success` 为 Boolean（均可空）；
     * - `logType` 取值稳定但非闭合，按 {@link LogType} 映射、未知值原值回退（见列表 renderEnum 范式）。
     */
    interface PaymentLogSummary {
      /** Long→string */
      id: string;
      paymentOrderNo: string | null;
      refundOrderNo: string | null;
      /** 日志类型（稳定 token，非闭合；前端按已知值映射 i18n、未知值原值展示） */
      logType: LogType | null;
      bankCode: string | null;
      bankInterface: string | null;
      /** Integer→number */
      httpStatus: number | null;
      returnCode: string | null;
      returnMsg: string | null;
      /** 执行耗时（毫秒），Long→string */
      executionTime: string | null;
      success: boolean | null;
      errorMessage: string | null;
      /** 创建时间，ISO 字符串 */
      createdAt: string;
    }

    /**
     * GET /payment-logs 搜索参数（后端 PaymentLogQuery + Spring Pageable）。
     * 请求 `page` 为 **1-based**（响应 PageResponse.page 亦 1-based）。
     *
     * - `logTypes` 多选（Spring 绑定 record List<String>，axios qs 默认 indices 格式可绑）；
     * - `success` 为 Boolean 单选；时间区间 `createdAtFrom/To`（ISO 串）均可空，空值由调用方剔除。
     */
    interface PaymentLogSearchParams {
      paymentOrderNo?: string | null;
      refundOrderNo?: string | null;
      /** 日志类型多选；null/空 = 不过滤 */
      logTypes?: LogType[] | null;
      bankInterface?: string | null;
      /** 是否成功；null = 不过滤 */
      success?: boolean | null;
      returnCode?: string | null;
      /** 创建时间起（ISO，含） */
      createdAtFrom?: string | null;
      /** 创建时间止（ISO，含） */
      createdAtTo?: string | null;
      /** 1-based */
      page: number;
      size: number;
    }

    /** 通道交互日志筛选载荷（搜索参数去分页——分页由列表页管）。搜索组件 emit、列表页接收。 */
    type PaymentLogFilter = Omit<PaymentLogSearchParams, 'page' | 'size'>;

    // ---- 订单操作记录（列表 / 筛选，GET /operation-logs）----

    /**
     * 后端 OperationLogSummaryResponse（GET /operation-logs 列表项）。
     * 记录行为者对订单的操作（审核通过/拒绝、通知重发等），admin 原值透传、不做翻译。
     *
     * - `id` / `operatorId` 为 Long → JSON **字符串**，按 string 处理防精度丢失；
     * - `targetType` / `operation` 枚举 code 为 JSON **number**（Integer），配 `*Name` 中文名直读展示；
     * - `result` 为自由稳定 token（非闭合集合：SUCCESS / DELIVERY_FAILED / SKIPPED …），原值展示。
     */
    interface OperationLogSummary {
      /** Long→string */
      id: string;
      /** 目标类型枚举 code（Integer→number） */
      targetType: number | null;
      /** 目标类型中文名（后端序列化，直读展示） */
      targetTypeName: string | null;
      /** 目标单号（支付订单号 / 退款订单号） */
      targetNo: string | null;
      /** 操作类型枚举 code（Integer→number） */
      operation: number | null;
      /** 操作类型中文名（后端序列化，直读展示） */
      operationName: string | null;
      /** 操作者 ID，Long→string */
      operatorId: string | null;
      operatorName: string | null;
      /** 来源系统（调用方 appName） */
      operatorSystem: string | null;
      /** 操作结果（自由稳定 token、非闭合枚举），原值展示 */
      result: string | null;
      remark: string | null;
      /** 创建时间，ISO 字符串 */
      createdAt: string;
    }

    /**
     * GET /operation-logs 搜索参数（后端 OperationLogQuery + Spring Pageable）。
     * 请求 `page` 为 **1-based**（响应 PageResponse.page 亦 1-based）。
     *
     * ⚠️ `operation` 为**单选**：payment 的 OperationLogQuery.operation 是单个 OperationType（EQUAL），
     * issue 文案的「operation 多选」以 payment 实现契约为准收敛为单值——向单值下游转发多值会静默丢过滤条件。
     *
     * - `operatorId` 为 Long，前端按 **string** 处理防精度丢失，提交字符串由后端绑 Long；
     * - `result` 为自由 token，走文本输入；时间区间 `createdAtFrom/To`（ISO 串）均可空，空值由调用方剔除。
     */
    interface OperationLogSearchParams {
      targetType?: OperationTargetType | null;
      targetNo?: string | null;
      /** 操作类型——单选（payment 单值 EQUAL 契约） */
      operation?: OperationType | null;
      /** 操作者 ID（Long）—— string 防精度丢失，后端绑 Long */
      operatorId?: string | null;
      operatorSystem?: string | null;
      result?: string | null;
      /** 创建时间起（ISO，含） */
      createdAtFrom?: string | null;
      /** 创建时间止（ISO，含） */
      createdAtTo?: string | null;
      /** 1-based */
      page: number;
      size: number;
    }

    /** 订单操作记录筛选载荷（搜索参数去分页——分页由列表页管）。搜索组件 emit、列表页接收。 */
    type OperationLogFilter = Omit<OperationLogSearchParams, 'page' | 'size'>;

    // ---- 订单生命周期（GET /orders/{no}/lifecycle）----

    /**
     * 生命周期事件来源（payment 已在 BFF 上游合并 PaymentLog + OperationLog 按 createdAt 排序返回）。
     * - `GATEWAY`：机机通道事件（与银行/通道网关的交互留痕）——performer=网关接口、
     *   performerSystem=银行 code、detail=返回消息/错误信息；
     * - `OPERATION`：人/系统行为者操作事件（审核/通知重发等）——performer=操作人、
     *   performerSystem=来源系统、detail=备注。
     * 两类来源共用同一组语义字段（无旧平表 union 的互斥字段组）。
     */
    type LifecycleSource = 'GATEWAY' | 'OPERATION';

    /**
     * 后端 OrderLifecycleResponse——payment 合并后时间线的**单个语义事件**（9 字段，#54 对齐
     * admin ADR-0011 / ContractTest）。
     *
     * 响应为 `ApiResponse<List<OrderLifecycleResponse>>` **扁平事件数组**——无 orderNo 包装
     * （orderNo 走路径参数）；`id` 为 Long → JSON **字符串**（框架 ToStringSerializer），
     * 按 string 处理防精度丢失。
     */
    interface LifecycleEvent {
      /** 源记录主键（Long→string，同时间排序的稳定键） */
      id: string;
      source: LifecycleSource;
      /** 发生时间（合并排序键，payment 已排好序）；ISO 字符串 */
      createdAt: string;
      /** 动作稳定 token（如 AUDIT_APPROVE / PAYMENT_REQUEST） */
      action: string;
      /** 动作中文名（后端已给，直读展示；GATEWAY 事件可能即 token 本身） */
      actionName: string;
      /** 结果 token（如 SUCCESS / FAILED） */
      outcome: string;
      /** 执行方：OPERATION=操作人名；GATEWAY=网关接口名（如 ICBC_PAY） */
      performer: string | null;
      /** 执行方系统：OPERATION=来源系统（如 admin-console）；GATEWAY=银行 code（如 ICBC） */
      performerSystem: string | null;
      /** 补充说明：OPERATION=备注；GATEWAY=返回消息/错误信息 */
      detail: string | null;
    }

    // ---- 统计（仪表盘，GET /stats/**）----
    //
    // admin BFF 逐字镜像 payment 聚合结果（#54 对齐 ADR-0011：字段名/类型/嵌套零加戏，契约源 =
    // admin 仓 PaymentClient*ContractTest）。序列化约定：Long（金额/笔数/id）→ JSON **字符串**、
    // Integer 枚举 code 与 BigDecimal 比率/均值 → JSON **number**、LocalDateTime → ISO 串。
    // 比率（successRate / refundRate / approvalRate）为 **小数 0–1 区间**（展示时 ×100）；
    // 均值（avgExecutionTimeMs / avgAuditDurationMinutes）保持 number 原单位；金额为整数分
    // （`formatMoney` 内 ÷100）。
    //
    // ⚠️ 6 个窗口端点（overview / gateway-health / operations-audit / by-business-system /
    // by-channel / operations-activity）`from`/`to` **必填**（payment 契约，admin 北向同步必填——
    // 旧 REQ-17「BFF 未转发」已随 admin #51/#55 修复）；status-distribution / anomalies 无时间窗。

    /** stats 时间窗查询参数（窗口端点必填；ISO 本地串 `YYYY-MM-DDTHH:mm:ss`，后端绑 LocalDateTime） */
    interface StatsWindowParams {
      /** 窗口起（含） */
      from: string;
      /** 窗口止（含） */
      to: string;
    }

    /** 计数·金额摘要（overview 与 by-business-system 共用：笔数·金额·成功笔数·成功金额·成功率） */
    interface StatsSummary {
      /** 笔数（Long→string） */
      count: string;
      /** 金额（整数分，Long→string） */
      amount: string;
      /** 成功笔数（Long→string） */
      successCount: string;
      /** 成功金额（整数分，Long→string） */
      successAmount: string;
      /** 成功率（小数 0–1，BigDecimal→number） */
      successRate: number;
    }

    /** overview 趋势分桶（某时间窗内的支付/退款笔数·金额快照，含成功子集） */
    interface PaymentOverviewTrendBucket {
      /** 时间桶起（LocalDateTime → ISO 串） */
      bucket: string;
      /** 支付笔数（Long→string） */
      paymentCount: string;
      /** 支付金额（整数分，Long→string） */
      paymentAmount: string;
      /** 支付成功笔数（Long→string） */
      paidCount: string;
      /** 支付成功金额（整数分，Long→string） */
      paidAmount: string;
      /** 退款笔数（Long→string） */
      refundCount: string;
      /** 退款金额（整数分，Long→string） */
      refundAmount: string;
      /** 退款成功笔数（Long→string） */
      refundedCount: string;
      /** 退款成功金额（整数分，Long→string） */
      refundedAmount: string;
    }

    /** GET /stats/payments/overview —— 支付/退款嵌套摘要 + 净额 + 趋势分桶（from/to 必填） */
    interface PaymentOverview {
      payment: StatsSummary;
      refund: StatsSummary;
      /** 净额（整数分，支付金额 − 退款金额；Long→string） */
      netAmount: string;
      trend: PaymentOverviewTrendBucket[];
    }

    /** 状态分桶（payment/refund 各状态在途笔数·金额） */
    interface OrderStatusBucket {
      /** 状态 code（PaymentStatus / RefundStatus 的 Integer code → JSON number） */
      status: number;
      /** 状态中文名（后端序列化，直读展示） */
      statusName: string | null;
      /** 笔数（Long→string） */
      count: string;
      /** 金额（整数分，Long→string；paymentStatuses=支付金额，refundStatuses=退款金额） */
      amount: string;
    }

    /** 退款待审核积压——PENDING 退款单的笔数与金额（#54 起嵌套，积压金额首次透出） */
    interface RefundBacklog {
      /** 积压笔数（Long→string） */
      pendingCount: string;
      /** 积压金额（整数分，Long→string） */
      pendingAmount: string;
    }

    /** GET /stats/orders/status-distribution —— 支付/退款各状态分布 + 退款待审核积压（无时间窗） */
    interface OrderStatusDistribution {
      paymentStatuses: OrderStatusBucket[];
      refundStatuses: OrderStatusBucket[];
      /** 嵌套积压（#54 对齐：旧扁平 refundPendingAuditCount 已废；契约恒有对象） */
      refundBacklog: RefundBacklog;
    }

    /** gateway 返回码分布（单一 returnCode 出现次数） */
    interface GatewayReturnCodeStat {
      returnCode: string;
      /** 出现次数（Long→string） */
      count: string;
    }

    /** 单一银行接口健康度（调用次数·成功率·平均耗时·返回码分布） */
    interface GatewayBankInterfaceStat {
      /** 银行 code（如 "ICBC"） */
      bankCode: string | null;
      /** 银行接口名（如 "ICBC_PAY"） */
      bankInterface: string;
      /** 调用次数（Long→string；旧名 callCount 已废） */
      totalCount: string;
      /** 成功次数（Long→string） */
      successCount: string;
      /** 成功率（小数 0–1） */
      successRate: number;
      /** 平均执行耗时（毫秒，BigDecimal→number） */
      avgExecutionTimeMs: number;
      returnCodes: GatewayReturnCodeStat[];
    }

    /** GET /stats/gateway/health —— 各银行接口调用统计 + 返回码分布（from/to 必填） */
    interface GatewayHealth {
      /** 列表名 interfaces（旧名 bankInterfaces 已废） */
      interfaces: GatewayBankInterfaceStat[];
    }

    /** 单一审核人统计（审核笔数·通过/拒绝数·通过率；无人均时长——payment 契约无该字段） */
    interface OperationsAuditorStat {
      /** 审核人 ID（Long→string） */
      auditorId: string;
      auditorName: string | null;
      /** 审核笔数（Long→string） */
      count: string;
      /** 通过笔数（Long→string） */
      approvedCount: string;
      /** 拒绝笔数（Long→string） */
      rejectedCount: string;
      /** 通过率（小数 0–1） */
      approvalRate: number;
    }

    /** GET /stats/operations/audit —— 审核笔数·通过/拒绝数·通过率·平均时长 + 按审核人聚合（from/to 必填） */
    interface OperationsAudit {
      /** 审核总笔数（Long→string；旧名 auditCount 已废） */
      totalAudits: string;
      /** 通过笔数（Long→string） */
      approvedCount: string;
      /** 拒绝笔数（Long→string） */
      rejectedCount: string;
      /** 通过率（小数 0–1） */
      approvalRate: number;
      /** 平均审核时长（**分钟**，BigDecimal→number；旧 avgAuditDurationSeconds 已废） */
      avgAuditDurationMinutes: number;
      /** 列表名 byAuditor（旧名 auditors 已废） */
      byAuditor: OperationsAuditorStat[];
    }

    /** 按业务系统细分——单一业务系统的支付/退款嵌套摘要 + 退款率 */
    interface BusinessSystemStat {
      /** 业务系统名（PaymentOrder/RefundOrder.businessSystemName，即调用方 callerAppName） */
      businessSystemName: string;
      payment: StatsSummary;
      refund: StatsSummary;
      /** 退款率（小数 0–1，退款笔数 / 支付笔数） */
      refundRate: number;
    }

    /** GET /stats/by-business-system —— 各业务系统支付/退款摘要·成功率·退款率（from/to 必填） */
    interface BusinessSystemStats {
      /** 列表名 businessSystems（旧名 systems 已废） */
      businessSystems: BusinessSystemStat[];
    }

    /** 渠道维度统计（payMode / accessType 两维度同构） */
    interface ChannelBreakdownStat {
      /** 渠道枚举 code（PayMode / AccessType 的 Integer code → JSON number） */
      channelCode: number;
      /** 渠道中文名（后端序列化，直读展示，如 微信 / 支付宝 / H5） */
      channelName: string;
      /** 笔数（Long→string） */
      count: string;
      /** 金额（整数分，Long→string） */
      amount: string;
      /** 成功笔数（Long→string） */
      successCount: string;
      /** 成功金额（整数分，Long→string） */
      successAmount: string;
      /** 成功率（小数 0–1） */
      successRate: number;
    }

    /**
     * GET /stats/by-channel —— 按 payMode / accessType 两维度聚合（from/to 必填）。
     * #54 对齐：旧 NAME-token 维度键（WECHAT/APP… read-model）已废——现行契约为
     * Integer code + `channelName` 中文名（与列表/详情同范式，直读展示）。
     */
    interface ChannelStats {
      byPayMode: ChannelBreakdownStat[];
      byAccessType: ChannelBreakdownStat[];
    }

    /** 滞留单统计（长时滞留订单的笔数 + 金额合计；阈值由 payment 定） */
    interface StuckOrdersStat {
      /** 笔数（Long→string） */
      count: string;
      /** 金额（整数分，Long→string） */
      amount: string;
    }

    /** 近期失败统计（总次数 + 按日志类型明细；失败窗口由 payment 定） */
    interface RecentFailuresStat {
      /** 总次数（Long→string） */
      totalCount: string;
      /** 按日志类型明细 */
      byType: { logType: string; failureCount: string }[];
    }

    /** GET /stats/anomalies —— 长时滞留支付/退款单（笔数·金额嵌套）+ 近期失败（无时间窗） */
    interface PaymentAnomalies {
      longPendingPayments: StuckOrdersStat;
      longRefundingRefunds: StuckOrdersStat;
      recentFailures: RecentFailuresStat;
    }

    /** 操作类型计数——单一操作类型的笔数（code + 中文名） */
    interface OperationCountStat {
      /** 操作类型枚举 code（Integer → JSON number） */
      operation: number;
      /** 操作类型中文名（后端序列化，直读展示） */
      operationName: string;
      /** 笔数（Long→string） */
      count: string;
    }

    /** 操作员活动——单一操作员的操作类型·笔数分布 + 全部操作总数 */
    interface OperatorActivityStat {
      /** 操作员 ID（Long→string；系统动作可空） */
      operatorId: string | null;
      operatorName: string | null;
      /** 该操作员全部操作总数（Long→string） */
      totalCount: string;
      operations: OperationCountStat[];
    }

    /** GET /stats/operations/activity —— 各操作员操作类型·笔数 + 通知重发汇总（from/to 必填） */
    interface OperationsActivity {
      /** 列表名 byOperator（旧名 operators 已废） */
      byOperator: OperatorActivityStat[];
      /** 通知重发汇总（总数 + 按来源业务系统；旧 per-operator notificationResendCount 已废） */
      notifyResend: {
        /** 重发总次数（Long→string） */
        totalCount: string;
        /** 按来源业务系统归组（来源可空——系统动作单列一组） */
        byBusinessSystem: { businessSystem: string | null; count: string }[];
      };
    }
  }
}
