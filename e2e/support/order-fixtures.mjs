/**
 * 订单域 E2E mock fixtures（#57）——字段形状派生自 admin :8081 `/v3/api-docs`：
 * - `AiplatformOrderSummaryResponse`（列表行）
 * - `AiplatformOrderDetailResponse`（详情：append-only 价目史新→旧 + 状态时点组）
 *
 * 契约要点（api-docs 实测 2026-09-16）：id/projectId 为 TSID 字符串；amount 为 Long（分）
 * JSON **string**（待报价 null）；status Integer code 1..5 带 statusName；价目行带操作者
 * （存量行 null）。清单新单在前（TSID 倒序，provider 定死）——fixtures 按 id 降序排。
 * #76 增量：deliverableType Integer code 1..3（1=设计 2=系统 3=系统＋设计）带
 * deliverableTypeName——三型全覆盖（下载按钮按型自适应的断言锚：010=系统走源码包、
 * 009=系统＋设计走设计资产包；1/3 共用同一设计包分支，008=设计兼作待报价行类型呈现锚）。
 */

/** 列表行（12 条 = 两页 @size10；五态全覆盖 + 缺档 owner 一行）。 */
export const ORDER_ROWS = [
  {
    id: '7393120209101200012',
    projectId: '7392120209101200012',
    projectName: '智能排课助手',
    ownerDisplayName: '王十二',
    status: 5,
    statusName: '已取消',
    deliverableType: 1,
    deliverableTypeName: '设计',
    amount: '29900',
    currency: 'CNY',
    createdAt: '2026-09-12T10:12:00',
    quotedAt: '2026-09-12T10:40:00'
  },
  {
    id: '7393120209100800011',
    projectId: '7392120209100800011',
    projectName: '幼儿绘本共读机器人',
    ownerDisplayName: null,
    status: 4,
    statusName: '已归档',
    deliverableType: 2,
    deliverableTypeName: '系统',
    amount: '128000',
    currency: 'CNY',
    createdAt: '2026-09-11T16:03:00',
    quotedAt: '2026-09-11T17:22:00'
  },
  {
    id: '7393120209100500010',
    projectId: '7392120209100500010',
    projectName: '校园社团招新小程序',
    ownerDisplayName: '赵六',
    status: 3,
    statusName: '已支付',
    deliverableType: 2,
    deliverableTypeName: '系统',
    amount: '86000',
    currency: 'CNY',
    createdAt: '2026-09-11T09:30:00',
    quotedAt: '2026-09-11T10:05:00'
  },
  {
    id: '7393120209100200009',
    projectId: '7392120209100200009',
    projectName: '教研备课知识库',
    ownerDisplayName: '钱七',
    status: 2,
    statusName: '已报价',
    deliverableType: 3,
    deliverableTypeName: '系统＋设计',
    amount: '49900',
    currency: 'CNY',
    createdAt: '2026-09-10T14:20:00',
    quotedAt: '2026-09-10T15:00:00'
  },
  {
    id: '7393120209092800008',
    projectId: '7392120209092800008',
    projectName: '家校沟通助手',
    ownerDisplayName: '孙八',
    status: 1,
    statusName: '待报价',
    deliverableType: 1,
    deliverableTypeName: '设计',
    amount: null,
    currency: 'CNY',
    createdAt: '2026-09-09T11:00:00',
    quotedAt: null
  },
  {
    id: '7393120209092500007',
    projectId: '7392120209092500007',
    projectName: '口算天天练',
    ownerDisplayName: '周九',
    status: 4,
    statusName: '已归档',
    deliverableType: 2,
    deliverableTypeName: '系统',
    amount: '66000',
    currency: 'CNY',
    createdAt: '2026-09-09T08:45:00',
    quotedAt: '2026-09-09T09:10:00'
  },
  {
    id: '7393120209092000006',
    projectId: '7392120209092000006',
    projectName: '英语晨读陪练',
    ownerDisplayName: '吴十',
    status: 2,
    statusName: '已报价',
    deliverableType: 1,
    deliverableTypeName: '设计',
    amount: '35800',
    currency: 'CNY',
    createdAt: '2026-09-08T18:22:00',
    quotedAt: '2026-09-08T19:00:00'
  },
  {
    id: '7393120209091500005',
    projectId: '7392120209091500005',
    projectName: '实验报告批改助手',
    ownerDisplayName: '郑十一',
    status: 3,
    statusName: '已支付',
    deliverableType: 3,
    deliverableTypeName: '系统＋设计',
    amount: '152000',
    currency: 'CNY',
    createdAt: '2026-09-07T13:37:00',
    quotedAt: '2026-09-07T14:02:00'
  },
  {
    id: '7393120209091000004',
    projectId: '7392120209091000004',
    projectName: '班会课素材生成器',
    ownerDisplayName: '王五',
    status: 5,
    statusName: '已取消',
    deliverableType: 2,
    deliverableTypeName: '系统',
    amount: null,
    currency: 'CNY',
    createdAt: '2026-09-06T10:05:00',
    quotedAt: null
  },
  {
    id: '7393120209090500003',
    projectId: '7392120209090500003',
    projectName: '错题本同步工具',
    ownerDisplayName: '李四',
    status: 2,
    statusName: '已报价',
    deliverableType: 1,
    deliverableTypeName: '设计',
    amount: '75000',
    currency: 'CNY',
    createdAt: '2026-09-05T15:44:00',
    quotedAt: '2026-09-05T16:20:00'
  },
  {
    id: '7393120209090100002',
    projectId: '7392120209090100002',
    projectName: '听力训练助手',
    ownerDisplayName: '张三',
    status: 1,
    statusName: '待报价',
    deliverableType: 3,
    deliverableTypeName: '系统＋设计',
    amount: null,
    currency: 'CNY',
    createdAt: '2026-09-04T09:12:00',
    quotedAt: null
  },
  {
    id: '7393120209082800001',
    projectId: '7392120209082800001',
    projectName: '作文批改引擎',
    ownerDisplayName: '张三',
    status: 3,
    statusName: '已支付',
    deliverableType: 2,
    deliverableTypeName: '系统',
    amount: '200000',
    currency: 'CNY',
    createdAt: '2026-09-03T17:26:00',
    quotedAt: '2026-09-03T18:00:00'
  }
];

/** 详情（按 id 索引；E2E 只打开这三单：改价目标 / 重试归档目标 / 首次报价目标）。 */
export const ORDER_DETAILS = {
  /** 已报价——改价场景：价目史两行（新→旧），一行操作者留痕、一行存量 null。 */
  '7393120209100200009': {
    id: '7393120209100200009',
    projectId: '7392120209100200009',
    projectName: '教研备课知识库',
    ownerDisplayName: '钱七',
    status: 2,
    statusName: '已报价',
    deliverableType: 3,
    deliverableTypeName: '系统＋设计',
    amount: '49900',
    currency: 'CNY',
    note: '首版报价（含 3 轮迭代）',
    priceEntries: [
      {
        id: '7394120209100200002',
        amount: '49900',
        currency: 'CNY',
        note: '首版报价（含 3 轮迭代）',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-09-10T15:00:00'
      },
      {
        id: '7394120209100200001',
        amount: '42000',
        currency: 'CNY',
        note: '初拟（存量迁移行）',
        operatorId: null,
        operatorName: null,
        createdAt: '2026-09-10T09:30:00'
      }
    ],
    prdSnapshot:
      '# 教研备课知识库\n\n## 背景\n组内教案分散在个人网盘，检索困难。\n\n## 目标\n1. 教案结构化沉淀\n2. 按学科/年级检索\n3. 备课组协同批注',
    createdAt: '2026-09-10T14:20:00',
    quotedAt: '2026-09-10T15:00:00',
    paidAt: null,
    archivedAt: null,
    archiveOperatorId: null,
    archiveOperatorName: null,
    cancelledAt: null,
    cancelReason: null,
    cancelOperatorId: null,
    cancelOperatorName: null
  },
  /** 已支付未归档——重试归档场景。 */
  '7393120209100500010': {
    id: '7393120209100500010',
    projectId: '7392120209100500010',
    projectName: '校园社团招新小程序',
    ownerDisplayName: '赵六',
    status: 3,
    statusName: '已支付',
    deliverableType: 2,
    deliverableTypeName: '系统',
    amount: '86000',
    currency: 'CNY',
    note: '固定价目',
    priceEntries: [
      {
        id: '7394120209100500001',
        amount: '86000',
        currency: 'CNY',
        note: '固定价目',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-09-11T10:05:00'
      }
    ],
    prdSnapshot: '# 校园社团招新小程序\n\n## 目标\n招新报名 + 简历收集 + 面试安排一体。',
    createdAt: '2026-09-11T09:30:00',
    quotedAt: '2026-09-11T10:05:00',
    paidAt: '2026-09-11T20:15:00',
    archivedAt: null,
    archiveOperatorId: null,
    archiveOperatorName: null,
    cancelledAt: null,
    cancelReason: null,
    cancelOperatorId: null,
    cancelOperatorName: null
  },
  /** 待报价——首次报价场景（金额 null、价目史空）。 */
  '7393120209092800008': {
    id: '7393120209092800008',
    projectId: '7392120209092800008',
    projectName: '家校沟通助手',
    ownerDisplayName: '孙八',
    status: 1,
    statusName: '待报价',
    deliverableType: 1,
    deliverableTypeName: '设计',
    amount: null,
    currency: 'CNY',
    note: null,
    priceEntries: [],
    prdSnapshot: '# 家校沟通助手\n\n## 目标\n周报自动生成 + 事项触达。',
    createdAt: '2026-09-09T11:00:00',
    quotedAt: null,
    paidAt: null,
    archivedAt: null,
    archiveOperatorId: null,
    archiveOperatorName: null,
    cancelledAt: null,
    cancelReason: null,
    cancelOperatorId: null,
    cancelOperatorName: null
  },
  /**
   * 已报价（#87 合同域增量——创建合同流目标单：旧合同已终态 ⇒ 可创建、二次创建撞 ORD_024；
   * 既有订单域用例不涉此单，新增仅扩充 fixtures 不动既有断言）。
   */
  '7393120209092000006': {
    id: '7393120209092000006',
    projectId: '7392120209092000006',
    projectName: '英语晨读陪练',
    ownerDisplayName: '吴十',
    status: 2,
    statusName: '已报价',
    deliverableType: 1,
    deliverableTypeName: '设计',
    amount: '35800',
    currency: 'CNY',
    note: '首版报价',
    priceEntries: [
      {
        id: '7394120209092000001',
        amount: '35800',
        currency: 'CNY',
        note: '首版报价',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-09-08T19:00:00'
      }
    ],
    prdSnapshot: '# 英语晨读陪练\n\n## 目标\n跟读录音 AI 打分，班级排行。',
    createdAt: '2026-09-08T18:22:00',
    quotedAt: '2026-09-08T19:00:00',
    paidAt: null,
    archivedAt: null,
    archiveOperatorId: null,
    archiveOperatorName: null,
    cancelledAt: null,
    cancelReason: null,
    cancelOperatorId: null,
    cancelOperatorName: null
  }
};

/** 写操作回执（AiplatformOrderResponse——回执价目行不带操作者，与 detail 有意不同）。 */
export function writeAck(orderId) {
  const detail = ORDER_DETAILS[orderId];
  const base = detail ?? ORDER_ROWS.find(row => row.id === orderId);
  return {
    code: 200,
    message: 'ok',
    data: {
      id: base.id,
      projectId: base.projectId,
      status: base.status,
      statusName: base.statusName,
      deliverableType: base.deliverableType,
      deliverableTypeName: base.deliverableTypeName,
      amount: base.amount,
      currency: base.currency,
      note: base.note ?? null,
      quotedAt: base.quotedAt ?? null,
      priceEntries: (detail?.priceEntries ?? []).map(({ id, amount, currency, note, createdAt }) => ({
        id,
        amount,
        currency,
        note,
        createdAt
      })),
      createdAt: base.createdAt,
      cancelledAt: detail?.cancelledAt ?? null,
      paidAt: detail?.paidAt ?? null,
      archivedAt: detail?.archivedAt ?? null
    },
    requestId: 'e2e-mock',
    errors: null
  };
}
