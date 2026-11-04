/**
 * AI 平台订单域 E2E（#57 验收）——headless Chrome（playwright-core 系统 channel，免下载浏览器）
 * + page.route 全量 mock（fixtures 派生自 /v3/api-docs，见 support/order-fixtures.mjs）。
 *
 * 覆盖验收六条：列表渲染契约字段 / 四维筛选绑定查询参数（1-based 分页）/ 抽屉价目史 /
 * 三写（报价·改价 / 取消 reason 必填 / 重试归档）成功后回读+刷新 / 源码包二进制流 / 写失败透传 toast。
 * #76 增量：类型列/栅格三色 tag 直读（含待报价行）+ 下载按钮按交付物类型自适应
 * （2=系统→源码包；1=设计/3=系统＋设计→设计资产包）——两下载路由计数分立断言。
 *
 * 前置：dev server 跑在 :3001（`pnpm dev`）。运行：`node e2e/order.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as fixtures from './support/order-fixtures.mjs';

const BASE = 'http://localhost:3001';
const ORDER_ROW = '.n-data-table-tbody .n-data-table-tr';

const h = createHarness();

/** 浏览器引用提升（main 的 finally 要收口关闭；不关闭会挂住 node 事件循环）。 */
let browser = null;

/** 取 calls 里最后一条订单清单请求（筛选/分页断言用）。 */
function lastListCall(calls) {
  const listCalls = calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/orders');
  return listCalls.at(-1);
}

async function main() {
  // ---- 前置：dev server 须在 :3001（CORS 只放行 3001，残留旧 server 会顺延 3002） ----
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-order E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));

  const { calls, state } = await installAiplatformMocks(page, { order: fixtures });

  /* ================= 1. 登录 → 动态菜单点亮「AI 平台 / 订单管理」 ================= */
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  h.check('登录落 /aiplatform/order（动态菜单 home）', page.url().includes('/aiplatform/order'));
  // Soybean 侧栏菜单渲染为 treeitem 角色（非 .n-menu 类）；等待其渲染（动态菜单经 /menus/my 异步下发）
  await page.locator('[role=menuitem], [role=treeitem]').first().waitFor({ timeout: 10000 });
  const menuItemTexts = await page.locator('[role=menuitem], [role=treeitem]').allTextContents();
  h.check('侧栏渲染「AI 平台」目录', menuItemTexts.some(t => t.includes('AI 平台')));
  h.check('侧栏渲染「订单管理」叶子', menuItemTexts.some(t => t.includes('订单管理')));

  /* ================= 2. 列表渲染契约字段（金额 Long 分格式化 / statusName 直读） ================= */
  await page.locator(ORDER_ROW).first().waitFor({ timeout: 15000 });
  h.check('列表首屏渲染 10 行（size=10）', (await page.locator(ORDER_ROW).count()) === 10);
  const listCall = lastListCall(calls);
  h.check('初始请求 page=1&size=10（1-based 直传）', listCall?.query.includes('page=1') && listCall?.query.includes('size=10'), listCall?.query);
  const firstRow = page.locator(ORDER_ROW).first();
  h.check('金额按分格式化（¥299.00）', await firstRow.getByText('¥299.00').isVisible());
  h.check('statusName 直读渲染（已取消）', await firstRow.getByText('已取消').isVisible());
  h.check('ownerDisplayName 渲染（王十二）', await firstRow.getByText('王十二').isVisible());
  h.check('待报价行金额占位（-）', await page.locator(ORDER_ROW).filter({ hasText: '家校沟通助手' }).getByText('待报价').isVisible());

  /* ================= 2b. 交付物类型列（#76：三型 tag 直读 deliverableTypeName） ================= */
  // exact 钉住全等——「设计」是「系统＋设计」的子串，默认子串匹配会串行
  h.check('类型列 tag（设计——首行智能排课助手）', await firstRow.getByText('设计', { exact: true }).isVisible());
  h.check(
    '类型列 tag（系统——校园社团招新小程序）',
    await page.locator(ORDER_ROW).filter({ hasText: '校园社团招新小程序' }).getByText('系统', { exact: true }).isVisible()
  );
  h.check(
    '类型列 tag（系统＋设计——教研备课知识库）',
    await page.locator(ORDER_ROW).filter({ hasText: '教研备课知识库' }).getByText('系统＋设计', { exact: true }).isVisible()
  );
  h.check(
    '待报价行类型照常呈现（设计——区别于金额 NULL）',
    await page.locator(ORDER_ROW).filter({ hasText: '家校沟通助手' }).getByText('设计', { exact: true }).isVisible()
  );

  /* ================= 3. 四维筛选绑定查询参数 ================= */
  // 3a. 状态多选：待报价 + 已取消（逗号单值 status=1,5）
  await page.locator('.n-select').first().click();
  await page.locator('.n-base-select-option', { hasText: '待报价' }).click();
  await page.locator('.n-base-select-option', { hasText: '已取消' }).click();
  await page.keyboard.press('Escape');
  // 3b. 创建时间区间（Naive datetimerange：fill 后 Tab 提交——Enter 不吃）
  const rangeInputs = page.locator('.n-date-picker input');
  await rangeInputs.nth(0).click();
  await rangeInputs.nth(0).fill('2026-09-01 00:00:00');
  await rangeInputs.nth(0).press('Tab');
  await rangeInputs.nth(1).click();
  await rangeInputs.nth(1).fill('2026-09-30 23:59:59');
  await rangeInputs.nth(1).press('Tab');
  // 3c. externalId + 3d. orderId 精确
  await page.getByPlaceholder('账号 External ID').fill('ext-zhaoliu');
  await page.getByPlaceholder('订单号（精确）').fill('7393120209100500010');
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await sleep(600);

  const filtered = lastListCall(calls);
  const q = new URLSearchParams(filtered?.query ?? '');
  h.check(
    '筛选参数全绑定（status 多选逗号单值/createdFrom/To/externalId/orderId）',
    q.get('status') === '1,5' &&
      q.get('createdFrom') === '2026-09-01T00:00:00' &&
      q.get('createdTo') === '2026-09-30T23:59:59' &&
      q.get('externalId') === 'ext-zhaoliu' &&
      q.get('orderId') === '7393120209100500010',
    filtered?.query
  );

  // 重置 → 参数清空
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await sleep(600);
  const reset = lastListCall(calls);
  h.check('重置后请求不带筛选参数', !reset?.query.includes('status=') && !reset?.query.includes('externalId='), reset?.query);

  /* ================= 4. 分页：翻第 2 页 → page=2（1-based） ================= */
  await page.locator('.n-pagination .n-pagination-item', { hasText: /^2$/ }).click();
  await sleep(600);
  h.check('翻第 2 页请求 page=2（零 ±1）', lastListCall(calls)?.query.includes('page=2'), lastListCall(calls)?.query);
  h.check('第 2 页渲染 2 行（共 12 条）', (await page.locator(ORDER_ROW).count()) === 2);
  await page.locator('.n-pagination .n-pagination-item', { hasText: /^1$/ }).click();
  await sleep(600);

  /* ================= 5. 写失败透传 toast（provider 信封 message 原样；行下拉报价路径） ================= */
  state.failNextQuote = true;
  const pendingRow = page.locator(ORDER_ROW).filter({ hasText: '家校沟通助手' });
  await pendingRow.getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '报价' }).click();
  const failQuoteModal = page.locator('.n-modal');
  await failQuoteModal.getByPlaceholder('请输入报价金额').waitFor({ timeout: 5000 });
  await failQuoteModal.getByPlaceholder('请输入报价金额').fill('100');
  await failQuoteModal.getByRole('button', { name: '确认报价' }).click();
  const errorToastSeen = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_007')));
  h.check('写失败 toast 透传 provider message（ORD_007）', Boolean(errorToastSeen), JSON.stringify(errorToastSeen));
  const failQuoteCall = calls.findLast(c => c.path.endsWith('/quote') && c.method === 'POST');
  h.check('行下拉报价 POST body amount=10000（无预填 note）', JSON.parse(failQuoteCall?.body ?? '{}').amount === 10000, failQuoteCall?.body);
  // 失败设计如此：弹窗不关（用户可修正重试）——关掉再进下一步
  await failQuoteModal.getByRole('button', { name: /取\s*消/ }).click();
  await sleep(400);

  /* ================= 6. 详情抽屉：价目史（append-only 带操作者）+ PRD 快照 ================= */
  const quotedRow = page.locator(ORDER_ROW).filter({ hasText: '教研备课知识库' });
  await quotedRow.getByRole('button', { name: /详\s*情/ }).click();
  const drawer = page.locator('.n-drawer');
  await drawer.getByText('价目历史').waitFor({ timeout: 10000 });
  const priceRows = drawer.locator('.n-data-table-tbody .n-data-table-tr');
  await sleep(400);
  h.check('抽屉渲染价目史两行（append-only 新→旧）', (await priceRows.count()) === 2);
  h.check('价目行带操作者（运营甲）', (await drawer.getByText('运营甲').count()) > 0);
  h.check('存量行操作者占位（-）', (await priceRows.filter({ hasText: '初拟（存量迁移行）' }).getByText('-').count()) > 0);
  h.check('PRD 快照渲染', await drawer.getByText('PRD 快照').isVisible());
  h.check('抽屉回显金额 ¥499.00', (await drawer.getByText('¥499.00').count()) >= 2);
  // #76 详情栅格类型项：status 后同款 tag（此单=系统＋设计）
  h.check('详情栅格类型项 tag（系统＋设计）', await drawer.getByText('系统＋设计', { exact: true }).isVisible());

  /* 6b. #92 双版本＋scope 三段读面＋未支付范围整组录入（ORD_033 竞态透传后成功回读） */
  h.check('详情双版本缺字段如实「—」（admin HEAD 详情未下发）',
    (await drawer.getByText('PRD 版本号', { exact: true }).locator('xpath=following-sibling::*[1]').textContent()) === '—' &&
      (await drawer.getByText('Demo 版本号', { exact: true }).locator('xpath=following-sibling::*[1]').textContent()) === '—');
  h.check('详情 scope 三段（交付/验收/工期）',
    (await drawer.getByText('管理后台＋小程序（含 5 个核心页面）').count()) > 0 &&
      (await drawer.getByText('按 PRD v3 逐项验收').count()) > 0 &&
      (await drawer.getByText('4 周（含 1 周联调）').count()) > 0);

  const scopeDetailReadsBefore = calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/orders/7393120209100200009').length;
  await drawer.getByRole('button', { name: '范围录入' }).click();
  const scopeModal = page.locator('.n-modal').filter({ hasText: '订单范围录入' });
  await scopeModal.getByPlaceholder('交付清单（空＝清空该段）').fill('管理后台＋小程序（含 6 个核心页面）');
  await scopeModal.getByPlaceholder('验收方式（空＝清空该段）').fill('');
  await scopeModal.getByPlaceholder('工期口径（空＝清空该段）').fill('5 周（含 1 周联调）');
  state.failNextOrderScope = true;
  await scopeModal.getByRole('button', { name: '整组提交' }).click();
  const scopeError = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_033')));
  h.check('范围录入 409 ORD_033 透传 toast', Boolean(scopeError), JSON.stringify(scopeError));
  h.check('范围录入失败保持弹窗可修正重试', await scopeModal.isVisible());
  await scopeModal.getByRole('button', { name: '整组提交' }).click();
  await drawer.getByText('管理后台＋小程序（含 6 个核心页面）').waitFor({ timeout: 10000 });
  const scopeCall = calls.findLast(c => c.method === 'POST' && c.path === '/aiplatform/orders/7393120209100200009/scope');
  const scopeBody = JSON.parse(scopeCall?.body ?? '{}');
  h.check('scope 三段整组提交（空段=null）',
    scopeBody.scopeDeliverables === '管理后台＋小程序（含 6 个核心页面）' &&
      scopeBody.scopeAcceptance === null &&
      scopeBody.scopeTimeline === '5 周（含 1 周联调）',
    scopeCall?.body);
  h.check('scope 成功回读订单详情（新值与空段「—」）',
    calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/orders/7393120209100200009').length === scopeDetailReadsBefore + 1 &&
      (await drawer.getByText('管理后台＋小程序（含 6 个核心页面）').count()) > 0 &&
      (await drawer.getByText('5 周（含 1 周联调）').count()) > 0 &&
      (await drawer.getByText('—', { exact: true }).count()) > 0);


  /* ================= 7. 三写之一：改价（已报价=改价，amount 元→分 + note） ================= */
  const detailCallsBefore = calls.filter(c => c.method === 'GET' && c.path.includes('/aiplatform/orders/7393120209100200009')).length;
  const listCallsBefore = calls.filter(c => c.path === '/aiplatform/orders').length;
  await drawer.getByRole('button', { name: /改\s*价/ }).click();
  const quoteModal = page.locator('.n-modal');
  await quoteModal.getByPlaceholder('请输入报价金额').fill('599.5');
  await quoteModal.getByPlaceholder('选填，至多 1000 字').fill('第二轮迭代加价');
  await quoteModal.getByRole('button', { name: '确认报价' }).click();
  await sleep(800);
  const quoteCall = calls.findLast(c => c.path.endsWith('/quote') && c.method === 'POST');
  const quoteBody = JSON.parse(quoteCall?.body ?? '{}');
  h.check('改价 POST body amount=59950（元→分取整）+ note', quoteBody.amount === 59950 && quoteBody.note === '第二轮迭代加价', quoteCall?.body);
  h.check('改价成功后回读详情', calls.filter(c => c.method === 'GET' && c.path.includes('/aiplatform/orders/7393120209100200009')).length > detailCallsBefore);
  h.check('改价成功后刷新列表', calls.filter(c => c.path === '/aiplatform/orders').length > listCallsBefore);

  /* ================= 8. 三写之二：取消（reason 必填，空禁用确认） ================= */
  await drawer.getByRole('button', { name: '取消订单' }).click();
  const cancelModal = page.locator('.n-modal');
  await cancelModal.getByPlaceholder('取消原因（必填）').waitFor({ timeout: 5000 });
  const confirmBtn = cancelModal.getByRole('button', { name: '确认取消' });
  h.check('取消原因空时确认禁用', await confirmBtn.isDisabled());
  await cancelModal.getByPlaceholder('取消原因（必填）').fill('需求变更，客户暂缓');
  state.failNextCancelSigned = true;
  await confirmBtn.click();
  const signedCancelError = await waitForMessage(page, msgs => msgs.some(m => m.includes('ORD_047') && m.includes('需求变化请在对话区沟通')));
  h.check('ORD_047 取消关门文案原样透传（含对话区指引，不判码）', Boolean(signedCancelError), JSON.stringify(signedCancelError));
  h.check('ORD_047 失败保持取消弹窗', await cancelModal.isVisible());
  await confirmBtn.click();
  await sleep(800);
  const cancelCall = calls.findLast(c => c.path.endsWith('/cancel') && c.method === 'POST');
  h.check('取消 POST body reason', JSON.parse(cancelCall?.body ?? '{}').reason === '需求变更，客户暂缓', cancelCall?.body);
  const cancelToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('订单已取消')));
  h.check('取消成功 toast', Boolean(cancelToast), JSON.stringify(cancelToast));

  /* ================= 9. 三写之三：重试归档（已支付未归档卡单；关抽屉走行下拉） ================= */
  await page.keyboard.press('Escape');
  await sleep(600);
  const paidRow = page.locator(ORDER_ROW).filter({ hasText: '校园社团招新小程序' });
  await paidRow.getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '重试归档' }).click();
  await page.locator('.n-modal').getByRole('button', { name: /确\s*认/ }).click();
  await sleep(800);
  h.check('重试归档 POST retry-archive 端点', calls.some(c => c.path.endsWith('/retry-archive') && c.method === 'POST'));
  const retryToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已触发归档重试')));
  h.check('重试归档成功 toast', Boolean(retryToast), JSON.stringify(retryToast));

  /* ================= 10. 源码包下载（tar.gz 二进制流，无信封；deliverableType=2 系统单） ================= */
  await paidRow.getByRole('button', { name: /详\s*情/ }).click();
  const paidDrawer = page.locator('.n-drawer');
  await paidDrawer.getByRole('button', { name: '下载源码包' }).waitFor({ timeout: 10000 });
  h.check('已支付订单不出「范围录入」（status 1|2 门控）', (await paidDrawer.getByRole('button', { name: '范围录入' }).count()) === 0);
  await paidDrawer.getByRole('button', { name: '下载源码包' }).click();
  await sleep(800);
  h.check(
    '源码包 GET source-package（二进制流端点）',
    calls.some(c => c.path.endsWith('/source-package') && c.method === 'GET')
  );
  const downloadToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('源码包下载成功')));
  h.check('下载成功 toast', Boolean(downloadToast), JSON.stringify(downloadToast));

  /* ================= 10b. 设计资产包下载（#76 按钮/端点按型自适应：deliverableType=3 单） ================= */
  await page.keyboard.press('Escape');
  await sleep(600);
  const designRow = page.locator(ORDER_ROW).filter({ hasText: '教研备课知识库' });
  await designRow.getByRole('button', { name: /详\s*情/ }).click();
  const designDrawer = page.locator('.n-drawer');
  // 按钮＝系统单的「下载源码包」不在场（互斥不出现），文案切换为设计资产包
  await designDrawer.getByRole('button', { name: '下载设计资产包' }).waitFor({ timeout: 10000 });
  h.check('系统＋设计单不出现「下载源码包」入口（有意取舍）', (await designDrawer.getByRole('button', { name: '下载源码包' }).count()) === 0);
  await designDrawer.getByRole('button', { name: '下载设计资产包' }).click();
  await sleep(800);
  h.check(
    '两下载路由计数分立（source×1 vs design×1 各自命中）',
    calls.filter(c => c.path.endsWith('/source-package') && c.method === 'GET').length === 1 &&
      calls.filter(c => c.path.endsWith('/design-package') && c.method === 'GET').length === 1
  );
  const designToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('设计资产包下载成功')));
  h.check('设计资产包下载成功 toast（tar.gz 落盘流）', Boolean(designToast), JSON.stringify(designToast));
  await page.keyboard.press('Escape');
  await sleep(400);

  /* ================= 11. 账号档案嵌件（#56 account:read 有码无页；externalId 筛选驱动） ================= */
  // 11a. 无 externalId 筛选：重开 paid 单抽屉（10b 已关旧实例）——开着但无筛选 → 不出账号档案区
  await paidRow.getByRole('button', { name: /详\s*情/ }).click();
  await paidDrawer.getByRole('button', { name: '下载源码包' }).waitFor({ timeout: 10000 });
  h.check('无 externalId 筛选：抽屉不出账号档案区', (await paidDrawer.getByText('账号档案').count()) === 0);
  await page.keyboard.press('Escape');
  await sleep(600);
  // 11b. 按 externalId 检索（赵六）→ 开同一单抽屉 → 嵌件点亮（详情响应不带 externalId，锚=筛选值）
  await page.getByPlaceholder('账号 External ID').fill('ext-zhaoliu');
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await sleep(600);
  h.check('externalId 筛选剩 1 行（校园社团招新小程序）', (await page.locator(ORDER_ROW).count()) === 1);
  await page.locator(ORDER_ROW).first().getByRole('button', { name: /详\s*情/ }).click();
  const zhaoDrawer = page.locator('.n-drawer');
  await zhaoDrawer.getByText('账号档案').waitFor({ timeout: 10000 });
  h.check(
    '账号档案 GET /aiplatform/accounts/ext-zhaoliu',
    calls.some(c => c.method === 'GET' && c.path === '/aiplatform/accounts/ext-zhaoliu')
  );
  h.check(
    '档案渲染（aiplatform 账号 ID + External ID + 建档时间 + 昵称双处）',
    (await zhaoDrawer.getByText('7395120209080100001').count()) > 0 &&
      (await zhaoDrawer.getByText('ext-zhaoliu').count()) > 0 &&
      (await zhaoDrawer.getByText('2026-08-02 11:00:00').count()) > 0 &&
      (await zhaoDrawer.getByText('赵六').count()) >= 2
  );
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 浏览器不关闭会挂住 node 事件循环（异常路径也要收口）
    if (browser) await browser.close();
    h.summary('aiplatform-order E2E');
  });
