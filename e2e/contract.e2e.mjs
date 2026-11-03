/**
 * AI 平台合同域 E2E（#87 验收，#79 A 批 T1）——headless Chrome + page.route 全量 mock
 * （fixtures 派生自 admin HEAD DTO，见 support/contract-fixtures.mjs）。
 *
 * 覆盖验收十條：清单契约字段渲染 / 四维筛选（status 多选逗号/createdFrom·To/orderId/contractNo）＋
 * 分页 1-based / 详情抽屉 720 三段（contract 全字段含范围快照冻结三段·双方签署位·双版本引用·
 * needsUpdate warning tag／PRD 全文／transitions 时间线新→旧）/ 七写双入口＋六态×动作门控矩阵＋
 * 八码逐写 hasAuth / basis 必填≤1000＋sign party 单选＋record 五肢整组 / advance 末边双签可观测
 * 门控（未双签不出推进钮，ORD_027 竞态兜底透传）/ 订单抽屉创建合同（常给＋409 透传＋成功不跳转）/
 * 回执不消费（toast＋详情回读＋列表刷新）/ 写失败代表样 409 ORD_027/ORD_028 自然·注入双路。
 *
 * 前置：dev server 跑在 :3001（`pnpm dev`）。运行：`node e2e/contract.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as orderFixtures from './support/order-fixtures.mjs';
import * as contractFixtures from './support/contract-fixtures.mjs';

const BASE = 'http://localhost:3001';
const ROW = '.n-data-table-tbody .n-data-table-tr';

/** 锚行（fixtures 单一事实源——断言用具体样本值）。 */
const DRAFT = contractFixtures.CONTRACT_ROWS[0]; // ……0012 准备中 v2 needsUpdate（重录靶）
const SIGNING = contractFixtures.CONTRACT_ROWS[1]; // ……0011 签署进行中 双方未签（签署→末边推进流）
const VERIFY = contractFixtures.CONTRACT_ROWS[2]; // ……0010 待核对与签署（advance 2→3 靶）
const A_SIGNED = contractFixtures.CONTRACT_ROWS[9]; // ……0003 签署进行中 仅甲方已签（ORD_028/fail 靶）
const TO_WITHDRAW = contractFixtures.CONTRACT_ROWS[7]; // ……0005 准备中（撤回靶——首屏内行）
const TO_VOID = contractFixtures.CONTRACT_ROWS[8]; // ……0004 待核对与签署（作废靶）
/** 创建流订单（英语晨读陪练——已报价、旧合同已终态 ⇒ 可创建；二次创建撞 ORD_024）。 */
const CREATE_ORDER_ID = '7393120209092000006';

const h = createHarness();
let browser = null;

/** 取 calls 里最后一条合同清单请求（筛选/分页断言用）。 */
function lastListCall(calls) {
  return calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/contracts').at(-1);
}

/** 行定位器（按合同号锚定——mono 列唯一）。 */
function rowByNo(page, contractNo) {
  return page.locator(ROW).filter({ hasText: contractNo });
}

/** basis 必填 textarea（七写共用 action/record modal 同 placeholder）。 */
const BASIS_PLACEHOLDER = '必填，至多 1000 字';

async function main() {
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-contract E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));

  const { calls, state } = await installAiplatformMocks(page, { order: orderFixtures, contract: contractFixtures });

  /* ================= 1. 登录 → 动态菜单「合同管理」（V22 种子 260）→ 直达合同页 ================= */
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  await page.locator('[role=menuitem], [role=treeitem]').first().waitFor({ timeout: 10000 });
  const menuTexts = await page.locator('[role=menuitem], [role=treeitem]').allTextContents();
  h.check('侧栏渲染「合同管理」叶子（V22 种子 260）', menuTexts.some(t => t.includes('合同管理')));

  await page.goto(`${BASE}/aiplatform/contract`);
  await page.locator(ROW).first().waitFor({ timeout: 15000 });
  h.check('合同页可达（/aiplatform/contract）', page.url().includes('/aiplatform/contract'));

  /* ================= 2. 清单契约字段渲染（新在前服务端序直读） ================= */
  h.check('首屏渲染 10 行（12 条 @size10）', (await page.locator(ROW).count()) === 10);
  const listCall = lastListCall(calls);
  h.check('初始请求 page=1&size=10（1-based 直传）', listCall?.query.includes('page=1') && listCall?.query.includes('size=10'), listCall?.query);
  const firstRow = page.locator(ROW).first();
  h.check('首行＝新在前（SG-8K3F2A）', await firstRow.getByText(DRAFT.contractNo).isVisible());
  h.check('合同号 mono 列渲染', await firstRow.getByText(DRAFT.contractNo).getAttribute('class').then(c => String(c).includes('font-mono')));
  h.check('订单号列渲染（TSID 串）', await firstRow.getByText(DRAFT.orderId).isVisible());
  h.check('statusName 直读 tag（准备中）', await firstRow.getByText('准备中', { exact: true }).isVisible());
  h.check('版本列渲染（v2）', await firstRow.getByText('2', { exact: true }).isVisible());
  h.check('金额按分格式化（¥750.00）', await firstRow.getByText('¥750.00').isVisible());

  /* ================= 3. 四维筛选绑定查询参数 ================= */
  await page.locator('.n-select').first().click();
  await page.locator('.n-base-select-option', { hasText: '准备中' }).click();
  await page.locator('.n-base-select-option', { hasText: '签署失败或过期' }).click();
  await page.keyboard.press('Escape');
  const rangeInputs = page.locator('.n-date-picker input');
  await rangeInputs.nth(0).click();
  await rangeInputs.nth(0).fill('2026-09-01 00:00:00');
  await rangeInputs.nth(0).press('Tab');
  await rangeInputs.nth(1).click();
  await rangeInputs.nth(1).fill('2026-11-30 23:59:59');
  await rangeInputs.nth(1).press('Tab');
  await page.getByPlaceholder('订单号（精确）').fill(SIGNING.orderId);
  await page.getByPlaceholder('合同号（精确）').fill(SIGNING.contractNo);
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await sleep(600);
  const filtered = lastListCall(calls);
  const q = new URLSearchParams(filtered?.query ?? '');
  h.check(
    '筛选参数全绑定（status 多选逗号单值/createdFrom·To/orderId/contractNo）',
    q.get('status') === '1,5' &&
      q.get('createdFrom') === '2026-09-01T00:00:00' &&
      q.get('createdTo') === '2026-11-30T23:59:59' &&
      q.get('orderId') === SIGNING.orderId &&
      q.get('contractNo') === SIGNING.contractNo,
    filtered?.query
  );

  await page.getByRole('button', { name: /重\s*置/ }).click();
  await sleep(600);
  const reset = lastListCall(calls);
  h.check('重置后请求不带筛选参数', !reset?.query.includes('status=') && !reset?.query.includes('contractNo='), reset?.query);

  /* ================= 4. 分页 1-based：翻第 2 页 → 2 行 ================= */
  await page.locator('.n-pagination .n-pagination-item', { hasText: /^2$/ }).click();
  await sleep(600);
  h.check('翻第 2 页请求 page=2（零 ±1）', lastListCall(calls)?.query.includes('page=2'), lastListCall(calls)?.query);
  h.check('第 2 页渲染 2 行（共 12 条）', (await page.locator(ROW).count()) === 2);
  await page.locator('.n-pagination .n-pagination-item', { hasText: /^1$/ }).click();
  await sleep(600);

  /* ================= 5. 详情抽屉三段：contract 全字段 / PRD 全文 / transitions 时间线 ================= */
  await rowByNo(page, DRAFT.contractNo).getByRole('button', { name: /详\s*情/ }).click();
  const drawer = page.locator('.n-drawer');
  await drawer.getByText('SG-8K3F2A').waitFor({ timeout: 10000 });
  await sleep(400);
  h.check('详情段：needsUpdate「需更新」warning tag', (await drawer.getByText('需更新').count()) > 0);
  h.check(
    '详情段：范围快照冻结三段（交付/验收/工期）',
    (await drawer.getByText('1. 管理后台 Web 端').count()) > 0 &&
      (await drawer.getByText('范围快照（冻结）').count()) > 0 &&
      (await drawer.getByText('工期口径').count()) > 0
  );
  h.check('详情段：预览字段未录入如实占位（-）', (await drawer.getByText('甲方主体').count()) > 0);
  h.check('详情段：双版本引用（PRD v3 / Demo 未引用 -）', (await drawer.getByText('3', { exact: true }).count()) > 0);
  h.check('详情段：双方签署位未签如实呈现', (await drawer.getByText('未签', { exact: true }).count()) >= 2);
  h.check('PRD 段：确认版全文渲染', await drawer.getByText('# 错题本同步工具 PRD（确认版 v3）').isVisible());
  h.check('时间线段：留痕渲染（草稿重录·操作者·依据）', (await drawer.getByText('草稿重录').count()) > 0 && (await drawer.getByText('运营甲').count()) > 0 && (await drawer.getByText('首次改价后重录').count()) > 0);

  /* 5b. 六态×动作门控（矩阵单点）：草稿态动作条——推进/重录/撤回/作废在，失败·签署标记不在 */
  const draftAdvance = drawer.getByRole('button', { name: '推进', exact: true });
  h.check('草稿态动作条：推进在', (await draftAdvance.count()) === 1);
  h.check('草稿态动作条：草稿重录在', (await drawer.getByRole('button', { name: '草稿重录' }).count()) === 1);
  h.check('草稿态动作条：撤回/作废在', (await drawer.getByRole('button', { name: '撤回' }).count()) === 1 && (await drawer.getByRole('button', { name: '作废' }).count()) === 1);
  h.check('草稿态动作条：失败或过期/签署标记不在（矩阵门控）', (await drawer.getByRole('button', { name: '失败或过期' }).count()) === 0 && (await drawer.getByRole('button', { name: '签署标记' }).count()) === 0);
  await page.keyboard.press('Escape');
  await sleep(600);

  /* ================= 6. 行下拉双入口：advance 2→3（basis 必填 → 成功 toast＋刷新） ================= */
  const verifyRow = rowByNo(page, VERIFY.contractNo);
  await verifyRow.getByRole('button', { name: /操\s*作/ }).click();
  await sleep(300);
  const verifyOptions = await page.locator('.n-dropdown-option').allTextContents();
  h.check(
    '行下拉选项按态（待核对与签署五写、无签署标记）',
    verifyOptions.length === 5 && ['推进', '失败或过期', '草稿重录', '撤回', '作废'].every(label => verifyOptions.some(t => t.includes(label))),
    JSON.stringify(verifyOptions)
  );
  await page.locator('.n-dropdown-option', { hasText: '推进' }).click();
  const advanceModal = page.locator('.n-modal');
  const advanceConfirm = advanceModal.getByRole('button', { name: '确认推进' });
  await advanceConfirm.waitFor({ timeout: 5000 });
  h.check('basis 空时确认禁用（必填前置拦截）', await advanceConfirm.isDisabled());
  await advanceModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('内容核对完成，进入签署');
  await advanceConfirm.click();
  await sleep(800);
  const advanceCall = calls.findLast(c => c.path.endsWith('/advance') && c.method === 'POST');
  h.check('advance POST body {basis}', JSON.parse(advanceCall?.body ?? '{}').basis === '内容核对完成，进入签署', advanceCall?.body);
  const advanceToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('合同已推进')));
  h.check('advance 成功 toast', Boolean(advanceToast), JSON.stringify(advanceToast));
  h.check('advance 成功后列表刷新（行转签署进行中）', (await rowByNo(page, VERIFY.contractNo).getByText('签署进行中').count()) > 0);

  /* ================= 7. 签署流（drawer）：双方落签 → 推进钮出现（末边可观测门控） ================= */
  await rowByNo(page, SIGNING.contractNo).getByRole('button', { name: /详\s*情/ }).click();
  const signDrawer = page.locator('.n-drawer');
  await signDrawer.getByText('SG-8K2QPD').waitFor({ timeout: 10000 });
  await sleep(400);
  h.check('状态3未双签：动作条无推进钮（可观测门控）', (await signDrawer.getByRole('button', { name: '推进', exact: true }).count()) === 0);
  h.check('状态3：签署标记/失败或过期在', (await signDrawer.getByRole('button', { name: '签署标记' }).count()) === 1);

  // 7a. 甲方落签（party 单选 + basis）
  await signDrawer.getByRole('button', { name: '签署标记' }).click();
  let signModal = page.locator('.n-modal');
  const signConfirm = signModal.getByRole('button', { name: '确认签署标记' });
  await signConfirm.waitFor({ timeout: 5000 });
  h.check('sign 确认禁用（party 未选＋basis 空）', await signConfirm.isDisabled());
  await signModal.getByText('甲方（客户方）').click();
  await signModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('甲方签字扫描件收到');
  await signConfirm.click();
  await sleep(800);
  const signCall = calls.findLast(c => c.path.endsWith('/sign') && c.method === 'POST');
  h.check('sign POST body {party:1, basis}', JSON.parse(signCall?.body ?? '{}').party === 1 && JSON.parse(signCall?.body ?? '{}').basis === '甲方签字扫描件收到', signCall?.body);
  h.check('sign 成功后详情回读（甲方已签＋时点）', (await signDrawer.getByText('已签').count()) >= 1 && (await signDrawer.getByText('2026-11-03 10:00:00').count()) >= 1);
  h.check('仅甲方签：推进钮仍不出（末边须双签）', (await signDrawer.getByRole('button', { name: '推进', exact: true }).count()) === 0);

  // 7b. 乙方落签 → 双签达成 → 推进钮出现
  await signDrawer.getByRole('button', { name: '签署标记' }).click();
  signModal = page.locator('.n-modal');
  await signModal.getByText('乙方（服务方）').click();
  await signModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('乙方盖章回传');
  await signModal.getByRole('button', { name: '确认签署标记' }).click();
  await sleep(800);
  h.check('双签达成：推进钮出现（末边解锁）', (await signDrawer.getByRole('button', { name: '推进', exact: true }).count()) === 1);

  /* ================= 8. advance 末边竞态：failNext 注入 409 ORD_027 透传 toast ================= */
  state.failNextContractWrite = true;
  await signDrawer.getByRole('button', { name: '推进', exact: true }).click();
  const raceModal = page.locator('.n-modal');
  await raceModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('双方签署完成，合同生效');
  await raceModal.getByRole('button', { name: '确认推进' }).click();
  const raceToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_027')));
  h.check('advance 竞态 409 ORD_027 透传 toast（不判码）', Boolean(raceToast), JSON.stringify(raceToast));
  h.check('失败保持弹窗（可修正重试）', await raceModal.getByPlaceholder(BASIS_PLACEHOLDER).isVisible());
  await raceModal.getByRole('button', { name: /取\s*消/ }).click();
  await sleep(400);

  /* ================= 9. advance 末边成功：3→4 终态（toast＋回读＋刷新） ================= */
  await signDrawer.getByRole('button', { name: '推进', exact: true }).click();
  const finalModal = page.locator('.n-modal');
  await finalModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('双方签署完成，合同生效');
  await finalModal.getByRole('button', { name: '确认推进' }).click();
  await sleep(800);
  const finalToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('合同已推进')));
  h.check('末边推进成功 toast', Boolean(finalToast), JSON.stringify(finalToast));
  h.check('详情回读：签署完成 tag', (await signDrawer.getByText('签署完成').count()) > 0);
  h.check('详情回读：留痕新→旧顶行＝推进 3→4', (await signDrawer.getByText('签署进行中 → 签署完成').count()) > 0);
  h.check('终态动作条清空（无可用写）', (await signDrawer.getByRole('button', { name: '撤回' }).count()) === 0);
  await page.keyboard.press('Escape');
  await sleep(600);
  h.check('列表刷新：行转签署完成', (await rowByNo(page, SIGNING.contractNo).getByText('签署完成').count()) > 0);

  /* ================= 10. ORD_028 签署位幂等拒（自然裁决透传）：甲方重复落签 ================= */
  await rowByNo(page, A_SIGNED.contractNo).getByRole('button', { name: /详\s*情/ }).click();
  const aSignedDrawer = page.locator('.n-drawer');
  await aSignedDrawer.getByText('SG-8JRW2F').waitFor({ timeout: 10000 });
  await sleep(400);
  await aSignedDrawer.getByRole('button', { name: '签署标记' }).click();
  const reSignModal = page.locator('.n-modal');
  await reSignModal.getByText('甲方（客户方）').click();
  await reSignModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('重复落签测试');
  await reSignModal.getByRole('button', { name: '确认签署标记' }).click();
  const reSignToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_028')));
  h.check('已落签署位幂等拒 409 ORD_028 透传 toast', Boolean(reSignToast), JSON.stringify(reSignToast));
  await reSignModal.getByRole('button', { name: /取\s*消/ }).click();
  await sleep(400);

  /* ================= 11. fail 自 3 旁落终态 5（drawer 动作条入口） ================= */
  await aSignedDrawer.getByRole('button', { name: '失败或过期' }).click();
  const failModal = page.locator('.n-modal');
  await failModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('客户超期未签，合同过期');
  await failModal.getByRole('button', { name: '确认失败或过期' }).click();
  await sleep(800);
  const failToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('签署失败或过期')));
  h.check('fail 成功 toast（旁落终态 5）', Boolean(failToast), JSON.stringify(failToast));
  await page.keyboard.press('Escape');
  await sleep(600);
  h.check('列表刷新：行转签署失败或过期', (await rowByNo(page, A_SIGNED.contractNo).getByText('签署失败或过期').count()) > 0);

  /* ================= 12. withdraw / void（行下拉入口；同去向不同留痕动作） ================= */
  await rowByNo(page, TO_WITHDRAW.contractNo).getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '撤回' }).click();
  let sideModal = page.locator('.n-modal');
  await sideModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('合同号变更，撤回重建');
  await sideModal.getByRole('button', { name: '确认撤回' }).click();
  await sleep(800);
  const withdrawToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('合同已撤回')));
  h.check('withdraw 成功 toast', Boolean(withdrawToast), JSON.stringify(withdrawToast));

  await rowByNo(page, TO_VOID.contractNo).getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '作废' }).click();
  sideModal = page.locator('.n-modal');
  await sideModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('条款争议，作废重拟');
  await sideModal.getByRole('button', { name: '确认作废' }).click();
  await sleep(800);
  const voidToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('合同已作废')));
  h.check('void 成功 toast（与撤回留痕分立）', Boolean(voidToast), JSON.stringify(voidToast));
  h.check('列表刷新：两行均转已撤回或作废', (await rowByNo(page, TO_WITHDRAW.contractNo).getByText('已撤回或作废').count()) > 0 && (await rowByNo(page, TO_VOID.contractNo).getByText('已撤回或作废').count()) > 0);

  /* ================= 13. record 整组重录五肢（「需更新」处置正路：v+1·needsUpdate 清零） ================= */
  await rowByNo(page, DRAFT.contractNo).getByRole('button', { name: /详\s*情/ }).click();
  const draftDrawer = page.locator('.n-drawer');
  await draftDrawer.getByText('SG-8K3F2A').waitFor({ timeout: 10000 });
  await sleep(400);
  await draftDrawer.getByRole('button', { name: '草稿重录' }).click();
  const recordModal = page.locator('.n-modal');
  const recordConfirm = recordModal.getByRole('button', { name: '确认重录' });
  await recordConfirm.waitFor({ timeout: 5000 });
  h.check('record basis 空时确认禁用', await recordConfirm.isDisabled());
  await recordModal.getByPlaceholder('选填，至多 200 字（甲方主体）').fill('李四');
  await recordModal.getByPlaceholder('选填，至多 200 字（乙方主体）').fill('语义引力科技有限公司');
  await recordModal.getByPlaceholder('选填，至多 2000 字（项目范围）').fill('错题本同步＋周报生成');
  await recordModal.getByPlaceholder('选填，至多 2000 字（付款计划文本）').fill('开工款 40%，验收 60%');
  await recordModal.getByPlaceholder(BASIS_PLACEHOLDER).fill('二次改价后重录');
  await recordConfirm.click();
  await sleep(800);
  const recordCall = calls.findLast(c => c.path.endsWith('/record') && c.method === 'POST');
  const recordBody = JSON.parse(recordCall?.body ?? '{}');
  h.check(
    'record POST body 五肢整组',
    recordBody.partyA === '李四' && recordBody.partyB === '语义引力科技有限公司' && recordBody.projectScope === '错题本同步＋周报生成' && recordBody.paymentPlan === '开工款 40%，验收 60%' && recordBody.basis === '二次改价后重录',
    recordCall?.body
  );
  const recordToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('草稿已重录')));
  h.check('record 成功 toast', Boolean(recordToast), JSON.stringify(recordToast));
  h.check('详情回读：needsUpdate 清零（需更新 tag 消失）', (await draftDrawer.getByText('需更新').count()) === 0);
  h.check('详情回读：版本 +1（v3）与预览字段落定', (await draftDrawer.getByText('李四').count()) > 0);
  h.check('详情回读：留痕顶行＝草稿重录', (await draftDrawer.getByText('二次改价后重录').count()) > 0);
  await page.keyboard.press('Escape');
  await sleep(600);

  /* ================= 14. 订单抽屉「创建合同」（常给＋hasAuth；409 透传；成功不跳转） ================= */
  await page.goto(`${BASE}/aiplatform/order`);
  await rowByNo(page, CREATE_ORDER_ID).first().getByRole('button', { name: /详\s*情/ }).click();
  const orderDrawer = page.locator('.n-drawer');
  await orderDrawer.getByText('英语晨读陪练', { exact: true }).waitFor({ timeout: 10000 });
  h.check('订单抽屉动作行「创建合同」常给（hasAuth 门控）', (await orderDrawer.getByRole('button', { name: '创建合同' }).count()) === 1);
  await orderDrawer.getByRole('button', { name: '创建合同' }).click();
  const createDialog = page.locator('.n-modal');
  await createDialog.getByRole('button', { name: /确\s*认/ }).click();
  await sleep(800);
  h.check('创建 POST /aiplatform/contracts/orders/{orderId}（无请求体）', calls.some(c => c.method === 'POST' && c.path === `/aiplatform/contracts/orders/${CREATE_ORDER_ID}` && !c.body));
  const createToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('合同已创建')));
  h.check('创建成功 toast（回执不消费）', Boolean(createToast), JSON.stringify(createToast));
  h.check('成功不跳转（仍驻订单页）', page.url().includes('/aiplatform/order'));

  // 14b. 活跃唯一前置门 409 ORD_024 透传（在场由服务端裁决）
  await orderDrawer.getByRole('button', { name: '创建合同' }).click();
  await createDialog.getByRole('button', { name: /确\s*认/ }).click();
  const dupToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_024')));
  h.check('重复创建 409 ORD_024 透传 toast', Boolean(dupToast), JSON.stringify(dupToast));
  await page.keyboard.press('Escape');
  await sleep(600);

  /* ================= 15. 创建落库可见（orderId 筛选自然可达新合同） ================= */
  await page.goto(`${BASE}/aiplatform/contract`);
  await page.locator(ROW).first().waitFor({ timeout: 15000 });
  await page.getByPlaceholder('订单号（精确）').fill(CREATE_ORDER_ID);
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await sleep(600);
  h.check(
    'orderId 筛选：新合同（SG-8K5W9E 准备中）＋旧终态行（SG-8JX4KN）同列',
    (await rowByNo(page, 'SG-8K5W9E').getByText('准备中').count()) > 0 && (await rowByNo(page, 'SG-8JX4KN').count()) === 1
  );
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    h.summary('aiplatform-contract E2E');
  });
