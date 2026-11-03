/**
 * 付款核验域 E2E mock fixtures（#89，#79 A 批 T2）——字段形状派生自 admin HEAD DTO `@Schema`
 * （本地 :8081 未运行，T8 口径读源码；wire DTO：AiplatformPaymentPlanDetailWireResponse 三段
 * ＋ AiplatformPaymentNodes/Verify/RejectWireRequest 命令体＋AiplatformPaymentVoucherContentResponse）。
 *
 * 契约要点：id/orderId/contractId/nodeId/voucherId TSID 十进制串；金额类（amount/settledAmount/
 * remainingAmount/totalAmount/totalSettled/actualAmount/byteSize）Long 分 → JSON **string**；
 * 节点五态 Integer code 1..5 带 statusName；percentage 整数百分比（计划未录入节点时节点面不存在）；
 * 留痕 from/to 状态**无 *Name**（wire 如此——前端 mono 数字直读）；trails/history 新→旧。
 *
 * 样本布局（三单，挂 order-fixtures 既有订单——计划随合同生成，合同在场与订单态保持连贯）：
 * - PLAN_RICH → 订单 ……0010（校园社团招新小程序·已支付；合同 0011 SG-8K2QPD 签署进行中）：
 *   6 节点**五态全覆盖**（5 已到账/4 待核验×2/1 待支付/2 处理中/3 失败关闭——2/3 为渠道保留位
 *   展示样本，v1 真链不产出）、n1 全额到账（开工门·receivedAt·流水号）、n2 **部分核到账**
 *   （settled 8000 < amount 20000，remaining 12000——「不足留痕回待支付」后再传凭证回到 4 态）
 *   双凭证、n3 打回后再传（4 态·单凭证——打回 target）、附言码 SG-8K2QPD-K1..K6、trails 三行
 *   （全额核验/部分核验/打回——action 1/1/2）、history 一行（旧合同 SG-8K2QPA 撤回重建定格）。
 * - PLAN_EMPTY → 订单 ……0005（实验报告批改助手·已支付；合同 0010 SG-8JZMWB 待核对与签署）：
 *   节点空表（totalAmount 0）——**节点录入流靶**（支付活动未开始＝重录唯一窗口自然敞开）。
 * - 无计划 → 订单 ……0008（家校沟通助手·待报价·无合同）：GET payment-plan 404 ORD_036（5036）
 *   ——面板缺席 NEmpty 靶。
 *
 * 金额锚（分）：6 节点合计 86000＝合同 0011 amount（计划总额＝合同额口径）；
 * totalSettled 38000＝n1 30000＋n2 8000。凭证四张：V1 随 n1 核验关联、V2/V3 n2 双传、V4 n3 再传。
 */

/** 节点状态中文名（provider 出口值——mock 与 statusName 同源）。 */
export const PAYMENT_NODE_STATUS_NAMES = { 1: '待支付', 2: '支付处理中', 3: '支付失败或关闭', 4: '线下转账待核验', 5: '已到账' };

/** 留痕动作名（provider 出口值——actionName 同源）。 */
export const PAYMENT_ACTION_NAMES = { 1: '到账核验', 2: '打回' };

/** 写留痕/写落值统一时点（harness applyPayment* 落痕用）。 */
export const PAYMENT_ACTION_AT = '2026-11-03T10:00:00';

/** 凭证字节内容（内容端点直出——contentType/Disposition 按元数据行构造）。 */
export const VOUCHER_BYTES = 'e2e-mock-voucher-binary-content';

/** 计划详情（按 orderId 索引；harness applyPayment* 双端就地变异）。 */
export const PAYMENT_PLANS = {
  '7393120209100500010': {
    plan: {
      id: '7397110209101200021',
      orderId: '7393120209100500010',
      contractId: '7396110209101200011',
      contractNo: 'SG-8K2QPD',
      totalAmount: '86000',
      totalSettled: '38000',
      createdAt: '2026-10-12T09:30:00',
      nodes: [
        {
          id: '7398110209101200031',
          seq: 1,
          name: '首期开工款',
          amount: '30000',
          percentage: 35,
          status: 5,
          statusName: PAYMENT_NODE_STATUS_NAMES[5],
          remarkCode: 'SG-8K2QPD-K1',
          kickoffGate: true,
          channelType: 1,
          channelTypeName: '线下转账',
          channelRefNo: 'CNL-20261013-0001',
          settledAmount: '30000',
          remainingAmount: '0',
          receivedAt: '2026-10-13T09:30:00',
          vouchers: [
            {
              id: '7399110209101200041',
              nodeId: '7398110209101200031',
              fileName: '首期回单.pdf',
              contentType: 'application/pdf',
              byteSize: '204800',
              createdAt: '2026-10-12T18:00:00'
            }
          ]
        },
        {
          id: '7398110209101200032',
          seq: 2,
          name: '二期进度款',
          amount: '20000',
          percentage: 23,
          status: 4,
          statusName: PAYMENT_NODE_STATUS_NAMES[4],
          remarkCode: 'SG-8K2QPD-K2',
          kickoffGate: true,
          channelType: 1,
          channelTypeName: '线下转账',
          channelRefNo: 'CNL-20261012-0007',
          settledAmount: '8000',
          remainingAmount: '12000',
          receivedAt: null,
          vouchers: [
            {
              id: '7399110209101200042',
              nodeId: '7398110209101200032',
              fileName: '二期转账水单.png',
              contentType: 'image/png',
              byteSize: '524288',
              createdAt: '2026-10-12T15:00:00'
            },
            {
              id: '7399110209101300043',
              nodeId: '7398110209101200032',
              fileName: '二期补差说明.pdf',
              contentType: 'application/pdf',
              byteSize: '1048576',
              createdAt: '2026-10-13T11:00:00'
            }
          ]
        },
        {
          id: '7398110209101200033',
          seq: 3,
          name: '验收款',
          amount: '15000',
          percentage: 17,
          status: 4,
          statusName: PAYMENT_NODE_STATUS_NAMES[4],
          remarkCode: 'SG-8K2QPD-K3',
          kickoffGate: false,
          channelType: 1,
          channelTypeName: '线下转账',
          channelRefNo: null,
          settledAmount: '0',
          remainingAmount: '15000',
          receivedAt: null,
          vouchers: [
            {
              id: '7399110209140000044',
              nodeId: '7398110209101200033',
              fileName: '验收款回单.jpg',
              contentType: 'image/jpeg',
              byteSize: '819200',
              createdAt: '2026-10-14T09:10:00'
            }
          ]
        },
        {
          id: '7398110209101200034',
          seq: 4,
          name: '尾款',
          amount: '11000',
          percentage: 13,
          status: 1,
          statusName: PAYMENT_NODE_STATUS_NAMES[1],
          remarkCode: 'SG-8K2QPD-K4',
          kickoffGate: false,
          channelType: 1,
          channelTypeName: '线下转账',
          channelRefNo: null,
          settledAmount: '0',
          remainingAmount: '11000',
          receivedAt: null,
          vouchers: []
        },
        {
          id: '7398110209101200035',
          seq: 5,
          name: '资料费',
          amount: '5000',
          percentage: 6,
          status: 2,
          statusName: PAYMENT_NODE_STATUS_NAMES[2],
          remarkCode: 'SG-8K2QPD-K5',
          kickoffGate: false,
          channelType: 2,
          channelTypeName: '扫码',
          channelRefNo: 'SCAN-20261014-0031',
          settledAmount: '0',
          remainingAmount: '5000',
          receivedAt: null,
          vouchers: []
        },
        {
          id: '7398110209101200036',
          seq: 6,
          name: '加急费',
          amount: '5000',
          percentage: 6,
          status: 3,
          statusName: PAYMENT_NODE_STATUS_NAMES[3],
          remarkCode: 'SG-8K2QPD-K6',
          kickoffGate: false,
          channelType: 2,
          channelTypeName: '扫码',
          channelRefNo: 'SCAN-20261014-0032',
          settledAmount: '0',
          remainingAmount: '5000',
          receivedAt: null,
          vouchers: []
        }
      ]
    },
    trails: [
      {
        id: '7400110209101300051',
        nodeId: '7398110209101200031',
        action: 1,
        actionName: PAYMENT_ACTION_NAMES[1],
        fromStatus: 4,
        toStatus: 5,
        actualAmount: '30000',
        arrivedAt: '2026-10-13T09:30:00',
        voucherId: '7399110209101200041',
        basis: '全额到账，核验通过',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-10-13T10:00:00'
      },
      {
        id: '7400110209101200052',
        nodeId: '7398110209101200032',
        action: 1,
        actionName: PAYMENT_ACTION_NAMES[1],
        fromStatus: 4,
        toStatus: 1,
        actualAmount: '8000',
        arrivedAt: '2026-10-12T16:20:00',
        voucherId: '7399110209101200042',
        basis: '首笔到账，差额待补',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-10-12T16:40:00'
      },
      {
        id: '7400110209101100053',
        nodeId: '7398110209101200033',
        action: 2,
        actionName: PAYMENT_ACTION_NAMES[2],
        fromStatus: 4,
        toStatus: 1,
        actualAmount: null,
        arrivedAt: null,
        voucherId: null,
        basis: '回单模糊无法核对，请重传',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-10-11T09:00:00'
      }
    ],
    history: [
      {
        id: '7397110209100500020',
        contractId: '7396110209100500019',
        contractNo: 'SG-8K2QPA',
        nodeCount: 2,
        totalAmount: '86000',
        totalSettled: '0',
        createdAt: '2026-10-05T08:00:00'
      }
    ]
  },
  /** 空节点计划（totalAmount 0——节点录入流靶；重录唯一窗口自然敞开）。 */
  '7393120209091500005': {
    plan: {
      id: '7397110209100800022',
      orderId: '7393120209091500005',
      contractId: '7396110209100800010',
      contractNo: 'SG-8JZMWB',
      totalAmount: '0',
      totalSettled: '0',
      createdAt: '2026-10-08T14:00:00',
      nodes: []
    },
    trails: [],
    history: []
  }
};

/** 录入后节点 id 派生（harness applyPaymentNodes 生成行——TSID 形串递增）。 */
let enteredNodeSeq = 100;
export function nextEnteredNodeId() {
  enteredNodeSeq += 1;
  return `7398110211${String(enteredNodeSeq).padStart(8, '0')}`;
}

/** 留痕行 id 派生（harness applyPaymentVerify/Reject 落痕）。 */
let trailSeq = 60;
export function nextTrailId() {
  trailSeq += 1;
  return `7400110211${String(trailSeq).padStart(8, '0')}`;
}
