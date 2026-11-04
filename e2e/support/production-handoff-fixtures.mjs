/**
 * 生产承接 E2E fixtures（#92）——形状逐字对齐 admin HEAD
 * `AiplatformProductionHandoffResponse`：id/projectId/orderId 为字符串；两态 1=待安排生产、
 * 2=生产中；transitions 新→旧，创建行 operatorId=system。读面不含「需用户补充」布尔。
 *
 * 两态样本：教研备课知识库＝待安排生产（四段有值＋信息更新/系统建档留痕）；校园社团招新
 * 小程序＝生产中（四段全 null＋推进/系统建档留痕），同时覆盖 null 如实「—」与稳态不出推进钮。
 */
export const PRODUCTION_HANDOFFS = {
  '7392120209100200009': {
    id: '7396120209100200001',
    projectId: '7392120209100200009',
    orderId: '7393120209100200009',
    status: 1,
    statusName: '待安排生产',
    contact: '钱老师（微信 qian-lesson）',
    nextStep: '确认教案模板与首批导入清单',
    progressNote: '已完成需求拆解，等待排期',
    estimatedStartAt: '2026-11-06T09:30:00',
    createdAt: '2026-11-03T10:00:00',
    transitions: [
      {
        action: 3,
        actionName: '信息更新',
        fromStatus: 1,
        fromStatusName: '待安排生产',
        toStatus: 1,
        toStatusName: '待安排生产',
        basis: '首次排期录入',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-11-03T11:20:00'
      },
      {
        action: 1,
        actionName: '创建',
        fromStatus: 1,
        fromStatusName: '待安排生产',
        toStatus: 1,
        toStatusName: '待安排生产',
        basis: '开工条件满足（合同签署完成且开工门节点全部到账），创建生产承接记录',
        operatorId: 'system',
        operatorName: '开工判定',
        createdAt: '2026-11-03T10:00:00'
      }
    ]
  },
  '7392120209100500010': {
    id: '7396120209100500002',
    projectId: '7392120209100500010',
    orderId: '7393120209100500010',
    status: 2,
    statusName: '生产中',
    contact: null,
    nextStep: null,
    progressNote: null,
    estimatedStartAt: null,
    createdAt: '2026-11-02T09:00:00',
    transitions: [
      {
        action: 2,
        actionName: '推进',
        fromStatus: 1,
        fromStatusName: '待安排生产',
        toStatus: 2,
        toStatusName: '生产中',
        basis: '排期落定，今日开工',
        operatorId: '9',
        operatorName: '运营甲',
        createdAt: '2026-11-02T09:30:00'
      },
      {
        action: 1,
        actionName: '创建',
        fromStatus: 1,
        fromStatusName: '待安排生产',
        toStatus: 1,
        toStatusName: '待安排生产',
        basis: '开工条件满足，系统建档',
        operatorId: 'system',
        operatorName: '开工判定',
        createdAt: '2026-11-02T09:00:00'
      }
    ]
  }
};
