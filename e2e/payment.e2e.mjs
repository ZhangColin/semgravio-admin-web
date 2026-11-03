/**
 * AI 平台付款核验域 E2E（#89 验收，#79 A 批 T2）——headless Chrome + page.route 全量 mock
 * （fixtures 派生自 admin HEAD DTO，见 support/payment-fixtures.mjs）。
 *
 * 覆盖验收六条：订单抽屉改两签（基本信息零丢失回归归 order.e2e；付款核验签按 payment:read
 * 显隐——hasAuth 门控机制同 account-profile 嵌件先例，mock 全码授予下断言签在场）／核验签
 * 分节（计划概览·附言码 mono＋开工门标志／节点表五态·statusName 直读·累计核到账·部分核到账
 * 余额／凭证清单点行下载 blob·Content-Disposition 透传／核验留痕时间线／历史计划行收起态）／
 * 节点录入整组替换（元转分、开工门、不预判重录窗口）／核验 modal（actualAmount 元转分＋
 * arrivedAt＋voucherId 凭证清单选＋channelRefNo＋basis）＋打回 basis-only／回执不消费
 * （toast＋回读 plan detail）／无计划 404 ORD_036 面板缺席／写失败代表样 409 ORD_044＋400
 * ORD_041 透传 toast／harness verify 累计核到账模拟（足额自动转已到账——全额判定归 provider）。
 *
 * 前置：dev server 跑在 :3001（`pnpm dev`）。运行：`node e2e/payment.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as orderFixtures from './support/order-fixtures.mjs';
import * as paymentFixtures from './support/payment-fixtures.mjs';

const BASE = 'http://localhost:3001';
const ORDER_ROW = '.n-data-table-tbody .n-data-table-tr';

/** 锚（fixtures 单一事实源——断言用具体样本值）。 */
const RICH_ORDER_ID = '7393120209100500010'; // 校园社团招新小程序（PLAN_RICH：六节点五态＋部分核到账）
const EMPTY_ORDER_ID = '7393120209091500005'; // 实验报告批改助手（PLAN_EMPTY：节点录入流靶）
const NO_PLAN_ORDER_ID = '7393120209092800008'; // 家校沟通助手（无合同 → 404 ORD_036 面板缺席靶）
const PLAN_RICH = paymentFixtures.PAYMENT_PLANS[RICH_ORDER_ID];
const NODE_PARTIAL = PLAN_RICH.plan.nodes[1]; // 待核验·部分核到账 8000/20000（verify 靶——补足转已到账）
const NODE_REJECT = PLAN_RICH.plan.nodes[2]; // 待核验（打回靶）
const VOUCHER_PARTIAL_LATE = NODE_PARTIAL.vouchers[1]; // 二期补差说明.pdf（核验关联凭证选）

const h = createHarness();
let browser = null;

/** 计划详情读次数（回读断言用——路径钉 orderId 防串单）。 */
function planReads(calls, orderId) {
  return calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/orders/${orderId}/payment-plan`).length;
}

/** 行定位器（按文本锚定——节点名/文件名/合同号均行内唯一）。 */
function rowBy(page, text) {
  return page.locator('.n-drawer .n-data-table-tbody .n-data-table-tr').filter({ hasText: text });
}

async function main() {
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-payment E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));

  const { calls, state } = await installAiplatformMocks(page, { order: orderFixtures, payment: paymentFixtures });

  /* ================= 1. 登录 → 订单页 ================= */
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  await page.locator(ORDER_ROW).first().waitFor({ timeout: 15000 });

  /** 开单 → 切「付款核验」签（抽屉两签——付款核验签 payment:read 门控在场）。 */
  async function openPaymentTab(orderId) {
    await page.locator(ORDER_ROW).filter({ hasText: orderId }).getByRole('button', { name: /详\s*情/ }).click();
    const drawer = page.locator('.n-drawer');
    await drawer.locator('.n-tabs-tab').filter({ hasText: '付款核验' }).waitFor({ timeout: 10000 });
    await drawer.locator('.n-tabs-tab').filter({ hasText: '付款核验' }).click();
    await sleep(400);
    return drawer;
  }

  /* ================= 2. 无付款计划（尚无合同）＝面板缺席（404 ORD_036 → NEmpty） ================= */
  let drawer = await openPaymentTab(NO_PLAN_ORDER_ID);
  await drawer.getByText('暂无付款计划').waitFor({ timeout: 10000 });
  h.check('无计划：面板缺席 NEmpty（暂无付款计划）', await drawer.getByText('暂无付款计划').isVisible());
  h.check('无计划：GET payment-plan 已发（404 ORD_036 走 onError 透传）', planReads(calls, NO_PLAN_ORDER_ID) >= 1);
  const noPlanToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_036')));
  h.check('无计划：404 ORD_036 toast 透传（不判码）', Boolean(noPlanToast), JSON.stringify(noPlanToast));
  await page.keyboard.press('Escape');
  await sleep(600);

  /* ================= 3. 计划详情三段全量渲染（六节点五态＋部分核到账＋凭证＋留痕＋历史） ================= */
  drawer = await openPaymentTab(RICH_ORDER_ID);
  await drawer.getByText('计划概览').waitFor({ timeout: 10000 });
  // 3a. 概览：合同号 mono（附言码正身源）＋总额/累计已核到账
  h.check('概览：合同号渲染（SG-8K2QPD）', await drawer.getByText('SG-8K2QPD', { exact: true }).isVisible());
  const contractNoCell = drawer.getByText('SG-8K2QPD', { exact: true }).first();
  h.check(
    '概览：合同号 mono',
    await contractNoCell.getAttribute('class').then(c => String(c).includes('font-mono'))
  );
  h.check('概览：计划总额 ¥860.00', await drawer.getByText('¥860.00', { exact: true }).first().isVisible());
  h.check('概览：累计已核到账 ¥380.00', await drawer.getByText('¥380.00', { exact: true }).first().isVisible());
  // 3b. 节点表：六节点五态全覆盖
  const nodeRows = drawer.locator('.n-data-table-tbody .n-data-table-tr').filter({ hasText: 'SG-8K2QPD-K' });
  await sleep(400);
  h.check('节点表：六节点渲染（录入序）', (await nodeRows.count()) === 6);
  const statusNames = ['已到账', '线下转账待核验', '待支付', '支付处理中', '支付失败或关闭'];
  const statusCounts = [];
  for (const name of statusNames) {
    statusCounts.push(`${name}:${await drawer.getByText(name, { exact: true }).count()}`);
  }
  h.check(
    '节点表：五态 statusName 直读全覆盖（5/4·4/1/2/3）',
    statusCounts.every(entry => Number(entry.split(':')[1]) >= 1),
    statusCounts.join('/')
  );
  h.check(
    '节点表：附言码 mono（SG-8K2QPD-K1）',
    await nodeRows
      .first()
      .getByText('SG-8K2QPD-K1')
      .getAttribute('class')
      .then(c => String(c).includes('font-mono'))
  );
  h.check('节点表：开工门标志（首期开工款·开工门 tag）', (await rowBy(page, '首期开工款').getByText('开工门').count()) === 1);
  h.check('节点表：开工门标志（二期进度款·开工门 tag）', (await rowBy(page, '二期进度款').getByText('开工门').count()) === 1);
  h.check('节点表：非开工门行无 tag（尾款行 "-"）', (await rowBy(page, '尾款').getByText('开工门').count()) === 0);
  h.check('节点表：部分核到账（二期 ¥80.00 / 还需 ¥120.00）', await rowBy(page, '二期进度款').getByText('¥80.00', { exact: true }).isVisible() && await rowBy(page, '二期进度款').getByText('¥120.00', { exact: true }).isVisible());
  h.check('节点表：到账时点随行（首期 2026-10-13 09:30:00）', (await rowBy(page, '首期开工款').getByText('2026-10-13 09:30:00').count()) >= 1);
  h.check('节点表：渠道流水号落值（CNL-20261013-0001）', (await rowBy(page, '首期开工款').getByText('CNL-20261013-0001').count()) >= 1);
  // 3c. 操作位按 4 态门控（互斥/不可达不出现——两待核验行各出核验/打回）
  h.check('节点表：核验/打回按钮仅两待核验行（4 态门控）', (await drawer.getByRole('button', { name: '到账核验', exact: true }).count()) === 2 && (await drawer.getByRole('button', { name: '打回', exact: true }).count()) === 2);
  // 3d. 凭证清单（四张平面、点行下载位在场）
  const voucherRows = drawer.locator('.n-data-table-tbody .n-data-table-tr').filter({ hasText: '.pdf' }).or(drawer.locator('.n-data-table-tbody .n-data-table-tr').filter({ hasText: '.png' })).or(drawer.locator('.n-data-table-tbody .n-data-table-tr').filter({ hasText: '.jpg' }));
  h.check('凭证清单：四张凭证平面渲染', (await voucherRows.count()) === 4, `实际 ${await voucherRows.count()}`);
  h.check('凭证清单：文件名＋所属节点（二期转账水单.png）', (await rowBy(page, '二期转账水单.png').count()) === 1);
  h.check('凭证清单：大小格式化（512 KB）', await drawer.getByText('512 KB', { exact: true }).first().isVisible());
  // 3e. 核验留痕时间线（新→旧：全额核验/部分核验/打回）
  h.check('留痕时间线：三行（跨节点新→旧）', (await drawer.locator('.n-timeline-item').count()) === 3);
  h.check('留痕时间线：动作名直读（到账核验/打回）', (await drawer.getByText('到账核验', { exact: true }).count()) >= 1 && (await drawer.getByText('打回', { exact: true }).count()) >= 1);
  h.check('留痕时间线：部分核验依据（首笔到账，差额待补）', (await drawer.getByText('首笔到账，差额待补').count()) >= 1);
  h.check('留痕时间线：实到金额＋操作者（¥300.00·运营甲）', (await drawer.getByText('¥300.00', { exact: true }).count()) >= 1 && (await drawer.getByText('运营甲').count()) >= 1);
  // 3f. 历史计划行收起态（摘要行——不含节点细节）
  h.check('历史计划：旧合同行渲染（SG-8K2QPA mono）', (await rowBy(page, 'SG-8K2QPA').count()) === 1);

  /* ================= 4. 到账核验（补足差额 → 足额自动转已到账——harness 累计核到账模拟） ================= */
  const readsBefore = planReads(calls, RICH_ORDER_ID);
  await rowBy(page, '二期进度款').getByRole('button', { name: '到账核验' }).click();
  const verifyModal = page.locator('.n-modal');
  await verifyModal.getByPlaceholder('请输入实到金额').fill('120');
  const dateInput = verifyModal.locator('.n-date-picker input');
  await dateInput.click();
  await dateInput.fill('2026-11-03 14:30:00');
  await dateInput.press('Tab');
  await verifyModal.locator('.n-select').click();
  await page.locator('.n-base-select-option', { hasText: '二期补差说明.pdf' }).click();
  await verifyModal.getByPlaceholder('选填', { exact: true }).fill('CNL-20261103-0099');
  await verifyModal.getByPlaceholder('选填，至多 1000 字').fill('差额补足到账');
  await verifyModal.getByRole('button', { name: '确认核验' }).click();
  const verifyToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('核验已录入')));
  h.check('核验成功 toast（回执不消费）', Boolean(verifyToast), JSON.stringify(verifyToast));
  const verifyCall = calls.findLast(c => c.path.endsWith(`/payment-nodes/${NODE_PARTIAL.id}/verify`) && c.method === 'POST');
  const verifyBody = JSON.parse(verifyCall?.body ?? '{}');
  h.check(
    'verify POST body（actualAmount 元转分/arrivedAt ISO/voucherId/channelRefNo/basis）',
    verifyBody.actualAmount === 12000 &&
      verifyBody.arrivedAt === '2026-11-03T14:30:00' &&
      verifyBody.voucherId === VOUCHER_PARTIAL_LATE.id &&
      verifyBody.channelRefNo === 'CNL-20261103-0099' &&
      verifyBody.basis === '差额补足到账',
    verifyCall?.body
  );
  h.check('核验成功后回读 plan detail（回执不含留痕全量）', planReads(calls, RICH_ORDER_ID) > readsBefore);
  await rowBy(page, '二期进度款').getByText('已到账', { exact: true }).waitFor({ timeout: 5000 });
  h.check('足额自动转已到账（全额判定归 provider）', (await rowBy(page, '二期进度款').getByText('已到账', { exact: true }).count()) === 1);
  h.check('累计核到账更新（二期 ¥200.00）', (await rowBy(page, '二期进度款').getByText('¥200.00', { exact: true }).count()) >= 1);
  h.check('概览累计更新（¥500.00）', await drawer.getByText('¥500.00', { exact: true }).first().isVisible());
  h.check('留痕顶行＝新核验（差额补足到账）', (await drawer.getByText('差额补足到账').count()) >= 1 && (await drawer.locator('.n-timeline-item').count()) === 4);

  /* ================= 5. 核验写失败代表样（400 ORD_041 注入——服务端裁决透传） ================= */
  state.failNextPaymentVerify = true;
  await rowBy(page, '验收款').getByRole('button', { name: '到账核验' }).click();
  await verifyModal.getByPlaceholder('请输入实到金额').fill('150');
  const failDate = verifyModal.locator('.n-date-picker input');
  await failDate.click();
  await failDate.fill('2026-11-03 15:00:00');
  await failDate.press('Tab');
  await verifyModal.getByRole('button', { name: '确认核验' }).click();
  const verifyFailToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_041')));
  h.check('核验写失败 400 ORD_041 透传 toast', Boolean(verifyFailToast), JSON.stringify(verifyFailToast));
  await verifyModal.getByRole('button', { name: /取\s*消/ }).click();
  await sleep(400);

  /* ================= 6. 打回（basis-only modal；回待支付不动累计） ================= */
  await rowBy(page, '验收款').getByRole('button', { name: '打回' }).click();
  const rejectModal = page.locator('.n-modal');
  const rejectConfirm = rejectModal.getByRole('button', { name: '确认打回' });
  h.check('打回：依据空时确认禁用（ORD_042 前端先行）', await rejectConfirm.isDisabled());
  await rejectModal.getByPlaceholder('必填，至多 1000 字').fill('回单仍不清晰，请重新上传');
  await rejectConfirm.click();
  const rejectToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已打回')));
  h.check('打回成功 toast', Boolean(rejectToast), JSON.stringify(rejectToast));
  const rejectCall = calls.findLast(c => c.path.endsWith(`/payment-nodes/${NODE_REJECT.id}/reject`) && c.method === 'POST');
  const rejectBody = JSON.parse(rejectCall?.body ?? '{}');
  h.check('reject POST body（basis-only：voucherId null＋依据）', rejectBody.voucherId === null && rejectBody.basis === '回单仍不清晰，请重新上传', rejectCall?.body);
  await rowBy(page, '验收款').getByText('待支付', { exact: true }).waitFor({ timeout: 5000 });
  h.check('打回后回「待支付」（核验/打回钮随 4 态消失）', (await rowBy(page, '验收款').getByText('待支付', { exact: true }).count()) === 1 && (await drawer.getByRole('button', { name: '到账核验', exact: true }).count()) === 0);
  h.check('打回留痕顶行（回单仍不清晰，请重新上传）', (await drawer.getByText('回单仍不清晰，请重新上传').count()) >= 1);

  /* ================= 7. 凭证下载（无信封二进制流＋Content-Disposition 透传） ================= */
  await rowBy(page, '二期转账水单.png').getByRole('button', { name: '下载' }).click();
  const downloadToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('凭证下载成功')));
  h.check('凭证下载成功 toast', Boolean(downloadToast), JSON.stringify(downloadToast));
  h.check(
    '凭证内容 GET payment-vouchers/{id}/content（二进制端点）',
    calls.some(c => c.method === 'GET' && c.path === '/aiplatform/payment-vouchers/7399110209101200042/content')
  );
  await page.keyboard.press('Escape');
  await sleep(600);

  /* ================= 8. 节点录入整组替换（空计划首录：元转分＋开工门＋附言码定格） ================= */
  drawer = await openPaymentTab(EMPTY_ORDER_ID);
  await drawer.getByText('待录入付款节点').waitFor({ timeout: 10000 });
  h.check('空计划：节点区 NEmpty（待录入付款节点）', await drawer.getByText('待录入付款节点').isVisible());
  const enterBtn = drawer.getByRole('button', { name: '录入付款节点' });
  h.check('空计划：录入按钮文案（首录）', (await enterBtn.count()) === 1);
  await enterBtn.click();
  const nodesModal = page.locator('.n-modal');
  await nodesModal.getByPlaceholder('如：首期开工款').fill('首期款');
  await nodesModal.getByPlaceholder('正数金额').fill('172');
  await nodesModal.locator('.n-switch').first().click(); // 首节点设开工门
  await nodesModal.getByRole('button', { name: '添加节点' }).click();
  const rowInputs = nodesModal.getByPlaceholder('如：首期开工款');
  await rowInputs.nth(1).fill('尾款');
  await nodesModal.getByPlaceholder('正数金额').nth(1).fill('43');
  await nodesModal.getByRole('button', { name: '整组提交' }).click();
  const nodesToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('付款节点已录入')));
  h.check('录入成功 toast（回执不消费）', Boolean(nodesToast), JSON.stringify(nodesToast));
  const nodesCall = calls.findLast(c => c.path.endsWith('/payment-plan/nodes') && c.method === 'POST' && c.path.includes(EMPTY_ORDER_ID));
  const nodesBody = JSON.parse(nodesCall?.body ?? '{}');
  h.check(
    'nodes POST body 整组（元转分＋开工门布尔）',
    JSON.stringify(nodesBody) ===
      JSON.stringify({ nodes: [
        { name: '首期款', amount: 17200, kickoffGate: true },
        { name: '尾款', amount: 4300, kickoffGate: false }
      ] }),
    nodesCall?.body
  );
  await rowBy(page, '首期款').waitFor({ timeout: 5000 });
  h.check('录入后回读：两节点渲染（附言码自合同号定格 K1/K2）', (await rowBy(page, '首期款').getByText('SG-8JZMWB-K1').count()) === 1 && (await rowBy(page, '尾款').getByText('SG-8JZMWB-K2').count()) === 1);
  h.check('录入后回读：待支付态＋计划总额 ¥215.00', (await rowBy(page, '首期款').getByText('待支付', { exact: true }).count()) === 1 && (await drawer.getByText('¥215.00', { exact: true }).count()) >= 1);

  /* ================= 9. 节点重录写失败代表样（409 ORD_044 注入——不预判窗口的兜底透传） ================= */
  state.failNextPaymentNodes = true;
  h.check('已录入：按钮文案切换（重录付款节点）', (await drawer.getByRole('button', { name: '重录付款节点' }).count()) === 1);
  await drawer.getByRole('button', { name: '重录付款节点' }).click();
  await nodesModal.getByRole('button', { name: '整组提交' }).click();
  const nodesFailToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_044')));
  h.check('重录写失败 409 ORD_044 透传 toast（弹窗保持可修正）', Boolean(nodesFailToast) && (await nodesModal.getByPlaceholder('如：首期开工款').count()) === 2, JSON.stringify(nodesFailToast));
  await nodesModal.getByRole('button', { name: /取\s*消/ }).click();
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 浏览器不关闭会挂住 node 事件循环（异常路径也要收口）
    if (browser) await browser.close();
    h.summary('aiplatform-payment E2E');
  });
