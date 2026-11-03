/**
 * 合同域 E2E mock fixtures（#87，#79 A 批 T1）——字段形状派生自 admin HEAD DTO `@Schema`
 * （本地 :8081 未运行，T8 口径读源码）：
 * - `AiplatformContractSummaryResponse`（清单行：id/contractNo/orderId/status·statusName/
 *   version/amount/currency/createdAt——**无 needsUpdate/签署位**，wire 如此）
 * - `AiplatformContractDetailResponse`（详情三段：contract 全字段 + prdSnapshot 全文 +
 *   transitions 时间线新→旧）
 * - `AiplatformContractTransitionResponse`（留痕行：action 六类/两侧状态/依据/操作者两肢/时间）
 *
 * 契约要点：id/orderId TSID 十进制串、contractNo SG- 串；amount Long（分）JSON **string**；
 * status Integer code 1..6 带 statusName；version int；needsUpdate boolean（仅详情）；
 * 双方签署位 boolean＋落签时点（未签 null）。清单新在前（TSID 倒序）——fixtures 按 id 降序。
 *
 * 六态样本布局（12 行＝两页 @size10；行-详情成对，harness applyContract* 双端就地变异）：
 * - ……0012 准备中 v2 needsUpdate（重录靶：留痕含草稿重录类）
 * - ……0011 签署进行中 双方未签（签署→末边推进全流靶；advance 可观测门控锚）
 * - ……0010 待核对与签署（行下拉 advance 1→2→3 靶……实为 2→3）
 * - ……0009 签署完成（终态；留痕含推进 3→4＋双签署标记＝完整签署故事）
 * - ……0008 签署失败或过期（终态；留痕含失败或过期类）
 * - ……0007 已撤回或作废·撤回（终态；留痕含撤回类）
 * - ……0006 已撤回或作废·作废（终态；留痕含作废类——与 0007 同态不同动作，审计分立锚）
 * - ……0005 准备中 v1（0006 作废后的重建行：同订单新号新合同、旧行终态保留）
 * - ……0004 待核对与签署（第二行同态样本）
 * - ……0003 签署进行中 仅甲方已签（ORD_028 幂等拒靶＋fail 自 3 可达靶）
 * - ……0002 准备中 v1（withdraw 靶）/ ……0001 签署完成（void 靶——作废自非终态 1|2|3 不可达，
 *   作废靶改用 0002……0001 为第二终态行）
 * 动作六类跨行全覆盖：1 推进（0009/0011…）/ 2 撤回（0007）/ 3 作废（0006）/ 4 签署标记
 * （0003/0009）/ 5 草稿重录（0012）/ 6 失败或过期（0008）。
 */

/** 状态中文名（provider 出口值——mock 与 statusName 同源）。 */
export const CONTRACT_STATUS_NAMES = { 1: '准备中', 2: '待核对与签署', 3: '签署进行中', 4: '签署完成', 5: '签署失败或过期', 6: '已撤回或作废' };

/** 动作名（provider 出口值——transition actionName 同源）。 */
export const CONTRACT_ACTION_NAMES = { 1: '推进', 2: '撤回', 3: '作废', 4: '签署标记', 5: '草稿重录', 6: '失败或过期' };

/** 写留痕统一时点（harness applyContract* 落痕用）。 */
export const CONTRACT_ACTION_AT = '2026-11-03T10:00:00';

/** 留痕行构造（新→旧数组 unshift 用；非迁移动作 from=to）。 */
function transition(action, from, to, basis, createdAt = '2026-09-20T10:00:00') {
  return {
    action,
    actionName: CONTRACT_ACTION_NAMES[action],
    fromStatus: from,
    fromStatusName: CONTRACT_STATUS_NAMES[from],
    toStatus: to,
    toStatusName: CONTRACT_STATUS_NAMES[to],
    basis,
    operatorId: '9',
    operatorName: '运营甲',
    createdAt
  };
}

/** 详情三段构造：contract 全字段（清单行超集）+ PRD 全文 + transitions（新→旧）。 */
function detail(row, extra, prdSnapshot, transitions) {
  return { contract: { ...row, ...extra }, prdSnapshot, transitions };
}

/** 合同清单行（降序＝新在前；amount 为分 string）。 */
export const CONTRACT_ROWS = [
  {
    id: '7396110209101500012',
    contractNo: 'SG-8K3F2A',
    orderId: '7393120209090500003',
    status: 1,
    statusName: CONTRACT_STATUS_NAMES[1],
    version: 2,
    amount: '75000',
    currency: 'CNY',
    createdAt: '2026-10-15T10:00:00'
  },
  {
    id: '7396110209101200011',
    contractNo: 'SG-8K2QPD',
    orderId: '7393120209100500010',
    status: 3,
    statusName: CONTRACT_STATUS_NAMES[3],
    version: 1,
    amount: '86000',
    currency: 'CNY',
    createdAt: '2026-10-12T09:30:00'
  },
  {
    id: '7396110209100800010',
    contractNo: 'SG-8JZMWB',
    orderId: '7393120209091500005',
    status: 2,
    statusName: CONTRACT_STATUS_NAMES[2],
    version: 1,
    amount: '152000',
    currency: 'CNY',
    createdAt: '2026-10-08T14:00:00'
  },
  {
    id: '7396110209100500009',
    contractNo: 'SG-8JYHTE',
    orderId: '7393120209100800011',
    status: 4,
    statusName: CONTRACT_STATUS_NAMES[4],
    version: 1,
    amount: '128000',
    currency: 'CNY',
    createdAt: '2026-10-05T11:00:00'
  },
  {
    id: '7396110209100200008',
    contractNo: 'SG-8JX4KN',
    orderId: '7393120209092000006',
    status: 5,
    statusName: CONTRACT_STATUS_NAMES[5],
    version: 1,
    amount: '35800',
    currency: 'CNY',
    createdAt: '2026-10-02T16:20:00'
  },
  {
    id: '7396110209092800007',
    contractNo: 'SG-8JVR7C',
    orderId: '7393120209101200012',
    status: 6,
    statusName: CONTRACT_STATUS_NAMES[6],
    version: 1,
    amount: '29900',
    currency: 'CNY',
    createdAt: '2026-09-28T10:12:00'
  },
  {
    id: '7396110209092500006',
    contractNo: 'SG-8JUQ0Z',
    orderId: '7393120209100200009',
    status: 6,
    statusName: CONTRACT_STATUS_NAMES[6],
    version: 1,
    amount: '49900',
    currency: 'CNY',
    createdAt: '2026-09-25T15:40:00'
  },
  {
    id: '7396110209092200005',
    contractNo: 'SG-8JTL5M',
    orderId: '7393120209100200009',
    status: 1,
    statusName: CONTRACT_STATUS_NAMES[1],
    version: 1,
    amount: '49900',
    currency: 'CNY',
    createdAt: '2026-09-22T09:00:00'
  },
  {
    id: '7396110209092000004',
    contractNo: 'SG-8JS98X',
    orderId: '7393120209101200012',
    status: 2,
    statusName: CONTRACT_STATUS_NAMES[2],
    version: 1,
    amount: '29900',
    currency: 'CNY',
    createdAt: '2026-09-20T13:30:00'
  },
  {
    id: '7396110209091500003',
    contractNo: 'SG-8JRW2F',
    orderId: '7393120209082000013',
    status: 3,
    statusName: CONTRACT_STATUS_NAMES[3],
    version: 1,
    amount: '99000',
    currency: 'CNY',
    createdAt: '2026-09-15T17:45:00'
  },
  {
    id: '7396110209091000002',
    contractNo: 'SG-8JQL6B',
    orderId: '7393120209081500014',
    status: 1,
    statusName: CONTRACT_STATUS_NAMES[1],
    version: 1,
    amount: '58800',
    currency: 'CNY',
    createdAt: '2026-09-10T08:20:00'
  },
  {
    id: '7396110209090500001',
    contractNo: 'SG-8JP31D',
    orderId: '7393120209081000015',
    status: 4,
    statusName: CONTRACT_STATUS_NAMES[4],
    version: 1,
    amount: '188000',
    currency: 'CNY',
    createdAt: '2026-09-05T12:10:00'
  }
];

/** 范围快照冻结三段 mock 文案（创建时取订单范围文本定格）。 */
const SCOPE = {
  deliverables: '1. 管理后台 Web 端\n2. 数据大屏',
  acceptance: '按 PRD 验收要点逐项验收，验收周期 5 个工作日',
  timeline: '合同签署后 30 个自然日交付'
};

/**
 * 详情（按 id 索引；12 行全配——抽屉任意行可开）。needsUpdate 仅草稿态可 true（0012 改价未重录）。
 */
export const CONTRACT_DETAILS = {
  '7396110209101500012': detail(
    CONTRACT_ROWS[0],
    {
      needsUpdate: true,
      partyA: null,
      partyB: null,
      projectScope: null,
      paymentPlan: null,
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 3,
      demoVersionNo: null,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 错题本同步工具 PRD（确认版 v3）\n\n## 目标\n错题拍照录入，按学科自动归类同步。',
    [transition(5, 1, 1, '首次改价后重录', '2026-10-01T09:00:00')]
  ),
  '7396110209101200011': detail(
    CONTRACT_ROWS[1],
    {
      needsUpdate: false,
      partyA: '王十二',
      partyB: '语义引力科技有限公司',
      projectScope: '小程序＋管理后台',
      paymentPlan: '开工款 50%，验收 50%',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 2,
      demoVersionNo: 1,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 校园社团招新小程序 PRD（确认版 v2）\n\n## 目标\n招新报名 + 简历收集 + 面试安排一体。',
    [transition(1, 2, 3, '双方线下核对完成，进入签署', '2026-10-11T15:00:00'), transition(1, 1, 2, '合同内容核对无误', '2026-10-10T10:00:00')]
  ),
  '7396110209100800010': detail(
    CONTRACT_ROWS[2],
    {
      needsUpdate: false,
      partyA: '郑十一',
      partyB: '语义引力科技有限公司',
      projectScope: '系统＋设计全案',
      paymentPlan: '一次性付清',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 4,
      demoVersionNo: 2,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 实验报告批改助手 PRD（确认版 v4）\n\n## 目标\n拍照上传实验报告，AI 批改＋教师复核。',
    [transition(1, 1, 2, '草稿定稿', '2026-10-07T11:00:00')]
  ),
  '7396110209100500009': detail(
    CONTRACT_ROWS[3],
    {
      needsUpdate: false,
      partyA: '运营甲（代）',
      partyB: '语义引力科技有限公司',
      projectScope: '绘本阅读数据看板',
      paymentPlan: '三期等额',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 1,
      demoVersionNo: null,
      partyASigned: true,
      partyASignedAt: '2026-10-04T09:00:00',
      partyBSigned: true,
      partyBSignedAt: '2026-10-04T15:30:00'
    },
    '# 幼儿绘本共读机器人 PRD（确认版 v1）\n\n## 目标\n共读留痕，家长周报推送。',
    [
      transition(1, 3, 4, '双方签署完成，合同生效', '2026-10-05T10:00:00'),
      transition(4, 3, 3, '乙方盖章回传', '2026-10-04T15:30:00'),
      transition(4, 3, 3, '甲方签字扫描件收到', '2026-10-04T09:00:00'),
      transition(1, 2, 3, '进入签署', '2026-10-03T14:00:00'),
      transition(1, 1, 2, '内容核对完成', '2026-10-02T09:00:00')
    ]
  ),
  '7396110209100200008': detail(
    CONTRACT_ROWS[4],
    {
      needsUpdate: false,
      partyA: '吴十',
      partyB: '语义引力科技有限公司',
      projectScope: '晨读跟读打分',
      paymentPlan: '开工款 30%，验收 70%',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 2,
      demoVersionNo: null,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 英语晨读陪练 PRD（确认版 v2）\n\n## 目标\n跟读录音 AI 打分，班级排行。',
    [transition(6, 2, 5, '客户超期未签，合同过期', '2026-10-02T16:20:00'), transition(1, 1, 2, '草稿定稿', '2026-10-01T10:00:00')]
  ),
  '7396110209092800007': detail(
    CONTRACT_ROWS[5],
    {
      needsUpdate: false,
      partyA: '王十二',
      partyB: '语义引力科技有限公司',
      projectScope: '排课冲突检测',
      paymentPlan: '一次性付清',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 1,
      demoVersionNo: 1,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 智能排课助手 PRD（确认版 v1）\n\n## 目标\n教师课表冲突自动检测。',
    [transition(2, 2, 6, '合同号变更，撤回重建', '2026-09-28T12:00:00'), transition(1, 1, 2, '草稿定稿', '2026-09-27T09:00:00')]
  ),
  '7396110209092500006': detail(
    CONTRACT_ROWS[6],
    {
      needsUpdate: false,
      partyA: '钱七',
      partyB: '语义引力科技有限公司',
      projectScope: '备课知识库检索',
      paymentPlan: '开工款 50%，验收 50%',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 3,
      demoVersionNo: null,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 教研备课知识库 PRD（确认版 v3）\n\n## 目标\n教案结构化沉淀，按学科检索。',
    [transition(3, 1, 6, '条款争议，作废重拟', '2026-09-25T16:00:00')]
  ),
  '7396110209092200005': detail(
    CONTRACT_ROWS[7],
    {
      needsUpdate: false,
      partyA: null,
      partyB: null,
      projectScope: null,
      paymentPlan: null,
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 3,
      demoVersionNo: null,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 教研备课知识库 PRD（确认版 v3）\n\n## 目标\n教案结构化沉淀，按学科检索。',
    []
  ),
  '7396110209092000004': detail(
    CONTRACT_ROWS[8],
    {
      needsUpdate: false,
      partyA: '王十二',
      partyB: '语义引力科技有限公司',
      projectScope: '课表冲突检测＋调课建议',
      paymentPlan: '一次性付清',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 1,
      demoVersionNo: 1,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 智能排课助手 PRD（确认版 v1）\n\n## 目标\n教师课表冲突自动检测。',
    [transition(1, 1, 2, '重建后草稿定稿', '2026-09-20T14:00:00')]
  ),
  '7396110209091500003': detail(
    CONTRACT_ROWS[9],
    {
      needsUpdate: false,
      partyA: '赵六',
      partyB: '语义引力科技有限公司',
      projectScope: '社团招新＋面试排期',
      paymentPlan: '开工款 50%，验收 50%',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 2,
      demoVersionNo: 1,
      partyASigned: true,
      partyASignedAt: '2026-09-15T09:00:00',
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 社团招新平台 PRD（确认版 v2）\n\n## 目标\n报名表单＋扫码签到。',
    [
      transition(4, 3, 3, '甲方签字扫描件收到', '2026-09-15T09:00:00'),
      transition(1, 2, 3, '进入签署', '2026-09-14T16:00:00'),
      transition(1, 1, 2, '草稿定稿', '2026-09-13T10:00:00')
    ]
  ),
  '7396110209091000002': detail(
    CONTRACT_ROWS[10],
    {
      needsUpdate: false,
      partyA: null,
      partyB: null,
      projectScope: null,
      paymentPlan: null,
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 1,
      demoVersionNo: null,
      partyASigned: false,
      partyASignedAt: null,
      partyBSigned: false,
      partyBSignedAt: null
    },
    '# 听力训练助手 PRD（确认版 v1）\n\n## 目标\n听力素材分段跟练。',
    []
  ),
  '7396110209090500001': detail(
    CONTRACT_ROWS[11],
    {
      needsUpdate: false,
      partyA: '张三',
      partyB: '语义引力科技有限公司',
      projectScope: '批改引擎私有化部署',
      paymentPlan: '预付 40%，部署验收 60%',
      scopeDeliverables: SCOPE.deliverables,
      scopeAcceptance: SCOPE.acceptance,
      scopeTimeline: SCOPE.timeline,
      prdVersionNo: 2,
      demoVersionNo: 3,
      partyASigned: true,
      partyASignedAt: '2026-09-04T10:00:00',
      partyBSigned: true,
      partyBSignedAt: '2026-09-04T16:00:00'
    },
    '# 作文批改引擎 PRD（确认版 v2）\n\n## 目标\n作文批量导入 AI 批改。',
    [
      transition(1, 3, 4, '双方签署完成', '2026-09-05T11:00:00'),
      transition(4, 3, 3, '乙方盖章回传', '2026-09-04T16:00:00'),
      transition(4, 3, 3, '甲方签字收到', '2026-09-04T10:00:00'),
      transition(1, 2, 3, '进入签署', '2026-09-03T15:00:00'),
      transition(1, 1, 2, '草稿定稿', '2026-09-02T09:00:00')
    ]
  )
};

/** 创建/重建新行（订单抽屉「创建合同」成功回执与清单新行——harness unshift 用）。 */
export const CREATED_CONTRACT = {
  id: '7396110209110100013',
  contractNo: 'SG-8K5W9E',
  orderId: '7393120209092000006',
  status: 1,
  statusName: CONTRACT_STATUS_NAMES[1],
  version: 1,
  amount: '35800',
  currency: 'CNY',
  createdAt: '2026-11-01T10:00:00'
};

/** 创建成功的详情三段（冻结集取订单现值；无留痕、四预览字段 null、双方未签）。 */
export const CREATED_DETAIL = detail(
  CREATED_CONTRACT,
  {
    needsUpdate: false,
    partyA: null,
    partyB: null,
    projectScope: null,
    paymentPlan: null,
    scopeDeliverables: SCOPE.deliverables,
    scopeAcceptance: SCOPE.acceptance,
    scopeTimeline: SCOPE.timeline,
    prdVersionNo: 2,
    demoVersionNo: null,
    partyASigned: false,
    partyASignedAt: null,
    partyBSigned: false,
    partyBSignedAt: null
  },
  '# 英语晨读陪练 PRD（确认版 v2）\n\n## 目标\n跟读录音 AI 打分，班级排行。',
  []
);
