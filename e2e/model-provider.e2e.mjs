/**
 * AI 平台模型供应商域 E2E（#88 验收，#80 B 批 T1）——headless Chrome + page.route 全量 mock
 * （fixtures 派生自 admin HEAD DTO，见 support/model-provider-fixtures.mjs）。
 *
 * 覆盖验收（#88 九条）：清单无分页全量直灌（掩码/未配置两态列渲染）/ 创建 modal（apiKey 明文
 * ＝写面唯一明文口；回执不消费 toast＋刷新）/ 更新 modal（baseUrl 预填终态替换、apiKey 留空＝
 * 保持 placeholder 明示、enabled 预填显式传）/ 删除 $dialog（409 PRJ_072 透传）/ 远端清单拉取
 * （行动作→POST 真拉、loading 诚实、502 PRJ_077 透传不静默→对照 drawer 条目表＋staleTiers
 * 「已过时」区块、key 空 400 PRJ_076）/ 入库＝drawer 内嵌轻量表单（勾选＋行内语义键→POST
 * /model-tiers、providerKey＝本通道、modelName 预填；无跨页跳转）/ 留痕 drawer 时间倒序 apiKey
 * 快照恒掩码＋per-trace 回滚预填 / apiKey 明文不出现在任何读面/留痕/断言（铁律钉子）。
 *
 * 前置：dev server 跑在 :3001（`pnpm dev`）。运行：`node e2e/model-provider.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as orderFixtures from './support/order-fixtures.mjs';
import * as modelProviderFixtures from './support/model-provider-fixtures.mjs';

const BASE = 'http://localhost:3001';
const ROW = '.n-data-table-tbody .n-data-table-tr';

/** 锚行（fixtures 单一事实源——断言用具体样本值）。 */
const VOLC = modelProviderFixtures.PROVIDER_ROWS[2]; // volcengine 主用（掩码 ab12、启用、陈运营）

/** 创建/换 key 表单输入用的合成明文 key（测试输入侧专用——任何断言不锚其原文，铁律钉子）。 */
const TYPED_KEY = 'sk-e2e-plain-9f2k';

const h = createHarness();
let browser = null;

/** 取 calls 里最后一条通道清单请求。 */
function lastListCall(calls) {
  return calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/model-providers').at(-1);
}

/** 行定位器（按 providerKey 锚定——键即寻址）。 */
function rowByKey(page, providerKey) {
  return page.locator(ROW).filter({ hasText: providerKey });
}

/** 铁律钉子：页面可见文本（读面/留痕）不得含 apiKey 明文样值（负向检查——断言只引用输入变量，不锚原文）。 */
async function assertNoPlaintextKeyAnywhere(page, where) {
  const body = await page.locator('body').innerText();
  h.check(`铁律：${where} 无 apiKey 明文`, !body.includes(TYPED_KEY), `页面文本意外含明文（${where}）`);
}

async function main() {
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-model-provider E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));

  const { calls, state } = await installAiplatformMocks(page, { order: orderFixtures, modelProvider: modelProviderFixtures });

  /* ================= 1. 登录 → 动态菜单「模型供应商」（V23 种子 270）→ 直达通道页 ================= */
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  await page.locator('[role=menuitem], [role=treeitem]').first().waitFor({ timeout: 10000 });
  const menuTexts = await page.locator('[role=menuitem], [role=treeitem]').allTextContents();
  h.check('侧栏渲染「模型供应商」叶子（V23 种子 270）', menuTexts.some(t => t.includes('模型供应商')));

  // 菜单→路由跳转与 addRoute 时序竞态（#58 坑与定案）——直达 URL 规避
  await page.goto(`${BASE}/aiplatform/model/provider`);
  await page.locator(ROW).first().waitFor({ timeout: 15000 });
  h.check('落 /aiplatform/model/provider 且列表渲染', page.url().includes('/aiplatform/model/provider'));

  /* ================= 2. 清单契约字段渲染（无分页全量直灌） ================= */
  h.check('全量 3 行直灌（无分页）', (await page.locator(ROW).count()) === 3, `实际 ${await page.locator(ROW).count()} 行`);
  const listCall = lastListCall(calls);
  h.check('清单请求无分页参数（全量直灌）', listCall?.query === '' || listCall?.query === null, listCall?.query);
  h.check('无分页器渲染', (await page.locator('.n-pagination').count()) === 0);

  // 按键序首行 deepseek：掩码 cd34 mono、种子行操作者 '-'、启用 tag
  const deepRow = rowByKey(page, 'deepseek');
  h.check('首行键序 deepseek：baseUrl 渲染', (await deepRow.getByText('https://api.deepseek.com/v1').count()) > 0);
  h.check('掩码 key mono 渲染（****cd34）', (await deepRow.getByText('****cd34').count()) > 0);
  h.check('种子行操作者占位（-）', (await deepRow.getByText('-', { exact: true }).count()) > 0);
  h.check('启用 tag（启用）', (await deepRow.locator('.n-tag', { hasText: '启用' }).count()) > 0);
  // volcengine 行：陈运营最近写者
  const volcRow = rowByKey(page, 'volcengine');
  h.check('volcengine 最近写者（陈运营）', (await volcRow.getByText('陈运营').count()) > 0);
  const volcKeyClass = await volcRow.getByText('volcengine').getAttribute('class');
  h.check('providerKey mono 列（volcengine）', String(volcKeyClass).includes('font-mono'), String(volcKeyClass));
  // moonshot 行：未配置 key「—」+ 停用 tag
  const moonRow = rowByKey(page, 'moonshot');
  h.check('未配置 key 占位（—）', (await moonRow.getByText('—', { exact: true }).count()) > 0);
  h.check('停用 tag（停用）', (await moonRow.locator('.n-tag', { hasText: '停用' }).count()) > 0);
  await assertNoPlaintextKeyAnywhere(page, '清单读面');

  /* ================= 3. 创建通道：modal 表单 → POST 命令体（apiKey 明文唯一写口）→ 掩码回读 ================= */
  await page.getByRole('button', { name: /创建通道/ }).click();
  const modal = page.locator('.n-modal');
  await modal.getByText('创建通道').first().waitFor({ timeout: 5000 });
  // 空表单确认禁用（providerKey/baseUrl 必填先行拦截——PRJ_067/069 服务端兜底）
  h.check('空表单确认禁用', await modal.getByRole('button', { name: /确认创建/ }).isDisabled());
  await modal.getByPlaceholder('协议路由前缀，如 volcengine').fill('zhipu');
  await modal.getByPlaceholder('必填，如 https://ark.cn-beijing.volces.com/api/v3').fill('https://open.bigmodel.cn/api/paas/v4');
  await modal.getByPlaceholder('选填全量值；留空＝暂不配置').fill(TYPED_KEY);
  await modal.getByRole('button', { name: /确认创建/ }).click();
  const createCall = calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-providers').at(-1);
  const createBody = createCall?.body ? JSON.parse(createCall.body) : null;
  h.check('POST 端点命中＋命令体键值', createBody?.providerKey === 'zhipu' && createBody?.baseUrl === 'https://open.bigmodel.cn/api/paas/v4' && createBody?.enabled === true, createCall?.body);
  // 铁律：写命令体收全量明文（非空、非掩码形）——断言只验形状，不锚原文
  h.check('写面 apiKey 收全量明文（非掩码形）', typeof createBody?.apiKey === 'string' && createBody.apiKey.length > 0 && !createBody.apiKey.includes('****'));
  const createdToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已创建')));
  h.check('创建成功 toast（回执不消费）', Boolean(createdToast));
  await sleep(600);
  // 刷新后新行：掩码形回读（尾 4 位掩码——非明文）＋即时生效不重启
  const zhipuRow = rowByKey(page, 'zhipu');
  h.check('新行入清单（zhipu）＋掩码回读（**** 形）', (await zhipuRow.getByText(/\*{4}\S{4}/).count()) > 0);
  h.check('新行操作者落痕（E2E Mock）', (await zhipuRow.getByText('E2E Mock').count()) > 0);
  await assertNoPlaintextKeyAnywhere(page, '创建后读面');

  /* ================= 4. 更新通道：baseUrl 终态替换预填＋apiKey 留空＝保持＋enabled 显式传 ================= */
  await rowByKey(page, 'volcengine').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '编辑' }).click();
  await modal.getByText('编辑通道').first().waitFor({ timeout: 5000 });
  // 寻址键不可改：固定显 mono 直读、无输入框
  h.check('更新 modal providerKey 固定显（无输入框）', (await modal.getByText('volcengine').count()) > 0 && (await modal.getByPlaceholder('协议路由前缀，如 volcengine').count()) === 0);
  const prefillUrl = await modal.getByPlaceholder('必填，如 https://ark.cn-beijing.volces.com/api/v3').inputValue();
  h.check('baseUrl 预填现值（终态替换）', prefillUrl === VOLC.baseUrl, prefillUrl);
  h.check('apiKey 恒空预填＋placeholder 明示保持', (await modal.getByPlaceholder('留空＝保持现值；填全量新值＝换 key').count()) > 0);
  h.check('enabled 开关预填（开）显式传', (await modal.locator('.n-switch.n-switch--active').count()) > 0);
  await modal.getByPlaceholder('必填，如 https://ark.cn-beijing.volces.com/api/v3').fill('https://ark.cn-beijing.volces.com/api/v3-next');
  await modal.getByRole('button', { name: /确认保存/ }).click();
  const putCall = calls.filter(c => c.method === 'PUT' && c.path === '/aiplatform/model-providers/volcengine').at(-1);
  const putBody = putCall?.body ? JSON.parse(putCall.body) : null;
  h.check(
    'PUT 命令体：baseUrl 终态替换＋apiKey null＝保持＋enabled 显式 true',
    putBody?.baseUrl === 'https://ark.cn-beijing.volces.com/api/v3-next' && putBody?.apiKey === null && putBody?.enabled === true,
    putCall?.body
  );
  const savedToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已保存')));
  h.check('更新成功 toast（回执不消费）', Boolean(savedToast));
  await sleep(600);
  const volcRow2 = rowByKey(page, 'volcengine');
  h.check('刷新后 baseUrl 新值入列', (await volcRow2.getByText('api/v3-next').count()) > 0);
  h.check('apiKey 留空＝保持（掩码不变 ****ab12）', (await volcRow2.getByText('****ab12').count()) > 0);

  /* ================= 5. 换 key：apiKey 全量新值 → 掩码变更回读（写面唯一明文口） ================= */
  await rowByKey(page, 'volcengine').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '编辑' }).click();
  await modal.getByText('编辑通道').first().waitFor({ timeout: 5000 });
  await modal.getByPlaceholder('留空＝保持现值；填全量新值＝换 key').fill(TYPED_KEY);
  await modal.getByRole('button', { name: /确认保存/ }).click();
  const rotateCall = calls.filter(c => c.method === 'PUT' && c.path === '/aiplatform/model-providers/volcengine').at(-1);
  const rotateBody = rotateCall?.body ? JSON.parse(rotateCall.body) : null;
  h.check('换 key 命令体收全量明文（非掩码形）', typeof rotateBody?.apiKey === 'string' && rotateBody.apiKey.length > 0 && !rotateBody.apiKey.includes('****'));
  await waitForMessage(page, msgs => msgs.some(m => m.includes('已保存')));
  await sleep(600);
  h.check('换 key 后掩码变更回读（****ab12 → ****9f2k）', (await rowByKey(page, 'volcengine').getByText('****9f2k').count()) > 0);
  await assertNoPlaintextKeyAnywhere(page, '换 key 后读面');

  /* ================= 6. 删除：$dialog 确认＋被档位引用 409 PRJ_072 透传＋删成刷新 ================= */
  // 6a. 被引用通道（volcengine 挂 volc-main-pro/volc-embed 两档）→ 409 PRJ_072 透传、行留列
  await rowByKey(page, 'volcengine').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '删除' }).click();
  const dialog = page.locator('.n-dialog');
  await dialog.getByText('删除通道').waitFor({ timeout: 5000 });
  h.check('删除确认框：键名对账（volcengine）', (await dialog.getByText('volcengine').count()) > 0);
  h.check('删除确认框：引用拦截指路提示', (await dialog.getByText('先删除或改挂其下档位').count()) > 0);
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  const refToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_072')));
  h.check('被引用 409 PRJ_072 透传 toast（不静默）', Boolean(refToast));
  await sleep(500);
  h.check('被拒后行留列（volcengine）', (await rowByKey(page, 'volcengine').count()) > 0);
  // 引用关系不在清单读面（前端无从前置观测）——DELETE 照发、provider 409 裁决透传
  h.check('DELETE 已发出（守卫全在 provider）', calls.some(c => c.method === 'DELETE' && c.path === '/aiplatform/model-providers/volcengine'));

  // 6b. 无引用通道（zhipu）＋竞态注入 409 → 透传、行留列
  state.failNextProviderDelete = true;
  await rowByKey(page, 'zhipu').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '删除' }).click();
  await dialog.getByText('删除通道').waitFor({ timeout: 5000 });
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  const raceToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_072')));
  h.check('竞态注入 409 PRJ_072 透传 toast', Boolean(raceToast));
  await sleep(500);
  h.check('竞态被拒后行留列（zhipu）', (await rowByKey(page, 'zhipu').count()) > 0);

  // 6c. 删成：toast＋行消失＋清单刷新（DELETE 回 data=null 信封即回执）
  await rowByKey(page, 'zhipu').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '删除' }).click();
  await dialog.getByText('删除通道').waitFor({ timeout: 5000 });
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  const deletedToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已删除')));
  h.check('删成 toast＋DELETE 端点命中', Boolean(deletedToast) && calls.some(c => c.method === 'DELETE' && c.path === '/aiplatform/model-providers/zhipu'));
  await sleep(600);
  h.check('删后行消失、清单回 3 行', (await rowByKey(page, 'zhipu').count()) === 0 && (await page.locator(ROW).count()) === 3);

  /* ================= 7. 远端清单拉取：行动作 POST 真拉 → 对照 drawer（条目表＋过时区块） ================= */
  const drawer = page.locator('.n-drawer');
  await rowByKey(page, 'volcengine').getByRole('button', { name: /拉取清单/ }).click();
  await drawer.getByText('远端模型清单对照').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('拉取走 POST remote-models（真拉）', calls.some(c => c.method === 'POST' && c.path === '/aiplatform/model-providers/volcengine/remote-models'));
  h.check('对照 drawer 打开（volcengine 寻址）', (await drawer.getByText('volcengine').count()) > 0);
  // 条目表：4 条样本（建议入库两态＋已入库两档）；modelId 序
  const entryRows = drawer.locator('.n-data-table-tbody .n-data-table-tr');
  h.check('条目表全量 4 行', (await entryRows.count()) === 4, `实际 ${await entryRows.count()} 行`);
  h.check('拉取时刻呈现', (await drawer.getByText('拉取时刻').count()) > 0);
  // 建议入库（trackedTierKeys 空）＝tag＋可勾选＋行内语义键输入；Shutdown 状态如实转述
  const flashRow = entryRows.filter({ hasText: 'doubao-seed-2-1-flash-250615' });
  h.check('建议入库 tag（tracked 空）', (await flashRow.locator('.n-tag', { hasText: '建议入库' }).count()) > 0);
  h.check('建议行行内语义键输入', (await flashRow.getByPlaceholder('语义键，如 doubao-flagship').count()) > 0);
  const shutdownRow = entryRows.filter({ hasText: 'doubao-pro-32k-241215' });
  h.check('status 如实转述（Shutdown 原文）', (await shutdownRow.getByText('Shutdown').count()) > 0);
  const activeRow = entryRows.filter({ hasText: 'doubao-seed-2-1-flash-250615' });
  h.check('无 status＝活跃呈现', (await activeRow.locator('.n-tag', { hasText: '活跃' }).count()) > 0);
  // 已入库档位键直读（非 tag、不可勾选）
  const trackedRow = entryRows.filter({ hasText: 'doubao-seed-1-6-250615' });
  h.check('已入库档位键直读（volc-main-pro）', (await trackedRow.getByText('volc-main-pro').count()) > 0);
  h.check('已入库行无建议 tag', (await trackedRow.locator('.n-tag', { hasText: '建议入库' }).count()) === 0);
  // staleTiers「已过时」区块
  h.check('过时区块标题', (await drawer.getByText('已过时档位').count()) > 0);
  h.check('过时档位呈现（volc-old-lite＋过时判据模型名）', (await drawer.getByText('volc-old-lite').count()) > 0 && (await drawer.getByText('doubao-lite-4-16k-240315').count()) > 0);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  // 重开＝再拉一次（每次全量真拉无缓存——pull 计数递增）
  const pullsBefore = calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-providers/volcengine/remote-models').length;
  await rowByKey(page, 'volcengine').getByRole('button', { name: /拉取清单/ }).click();
  await drawer.getByText('远端模型清单对照').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('重开再拉无缓存（POST 递增）', calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-providers/volcengine/remote-models').length === pullsBefore + 1);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  /* ================= 8. 拉取失败路径：502 PRJ_077 透传不静默＋key 空 400 PRJ_076 ================= */
  state.failNextRemotePull = true;
  await rowByKey(page, 'deepseek').getByRole('button', { name: /拉取清单/ }).click();
  const pullFailToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_077')));
  h.check('上游不可用 502 PRJ_077 透传 toast', Boolean(pullFailToast));
  await sleep(400);
  h.check('失败不静默兜底（drawer 呈错误态非空条目表）', (await drawer.getByText('拉取失败').count()) > 0 && (await drawer.locator('.n-data-table-tbody .n-data-table-tr').count()) === 0);
  h.check('错误态给重试入口', (await drawer.getByRole('button', { name: /重新拉取/ }).count()) > 0);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  // 通道 key 空（moonshot 未配置）→ 400 PRJ_076 不打上游
  await rowByKey(page, 'moonshot').getByRole('button', { name: /拉取清单/ }).click();
  const keylessToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_076')));
  h.check('key 空 400 PRJ_076 透传 toast', Boolean(keylessToast));
  await sleep(400);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  /* ================= 9. 入库＝drawer 内嵌轻量表单：勾选＋行内语义键 → 直接建档位 ================= */
  await rowByKey(page, 'volcengine').getByRole('button', { name: /拉取清单/ }).click();
  await drawer.getByText('远端模型清单对照').first().waitFor({ timeout: 10000 });
  await sleep(600);
  const catalogRows = drawer.locator('.n-data-table-tbody .n-data-table-tr');
  const flashEntry = catalogRows.filter({ hasText: 'doubao-seed-2-1-flash-250615' });
  const proEntry = catalogRows.filter({ hasText: 'doubao-pro-32k-241215' });
  h.check('未勾选时入库钮禁用', await drawer.getByRole('button', { name: /入库所选/ }).isDisabled());
  await flashEntry.locator('.n-checkbox').click();
  await flashEntry.getByPlaceholder('语义键，如 doubao-flagship').fill('volc-flash-new');
  await proEntry.locator('.n-checkbox').click();
  await proEntry.getByPlaceholder('语义键，如 doubao-flagship').fill('volc-pro-32k');
  await drawer.getByRole('button', { name: /入库所选/ }).click();
  const ingestToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已入库 2 个档位')));
  h.check('入库成功 toast（计数）', Boolean(ingestToast));
  // 命令体：providerKey＝本通道、modelName 预填所选 modelId、displayName/enabled 留空走缺省
  const tierCalls = calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-tiers');
  const flashCall = tierCalls.find(c => c.body && c.body.includes('volc-flash-new'));
  const flashBody = flashCall?.body ? JSON.parse(flashCall.body) : null;
  h.check(
    'POST /model-tiers 命令体（勾选入库复用档位创建写口）',
    flashBody?.tierKey === 'volc-flash-new' && flashBody?.providerKey === 'volcengine' && flashBody?.modelName === 'doubao-seed-2-1-flash-250615' && flashBody?.displayName === null && flashBody?.enabled === null,
    flashCall?.body
  );
  h.check('两条入库请求顺序发出', tierCalls.length >= 2 && Boolean(tierCalls.find(c => c.body?.includes('volc-pro-32k'))));
  await sleep(400);
  // 成功条目本地转「已入库」态：键直读、建议 tag 消失、无勾选无跨页跳转
  h.check('入库后条目转已入库态（volc-flash-new 键直读）', (await drawer.getByText('volc-flash-new').count()) > 0 && (await drawer.getByText('volc-pro-32k', { exact: true }).count()) > 0);
  h.check('入库后建议 tag 清空（全 tracked）', (await drawer.locator('.n-tag', { hasText: '建议入库' }).count()) === 0);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  /* ================= 10. 入库失败：409 PRJ_068 透传、条目留建议态可修正重试 ================= */
  state.failNextTierCreate = true;
  await rowByKey(page, 'deepseek').getByRole('button', { name: /拉取清单/ }).click();
  await drawer.getByText('远端模型清单对照').first().waitFor({ timeout: 10000 });
  await sleep(600);
  const dsRows = drawer.locator('.n-data-table-tbody .n-data-table-tr');
  const chatEntry = dsRows.filter({ hasText: 'deepseek-chat' });
  await chatEntry.locator('.n-checkbox').click();
  await chatEntry.getByPlaceholder('语义键，如 doubao-flagship').fill('ds-chat');
  await drawer.getByRole('button', { name: /入库所选/ }).click();
  const dupToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_068')));
  h.check('撞名 409 PRJ_068 透传 toast', Boolean(dupToast));
  await sleep(400);
  h.check('失败条目留建议态（可修正重试）', (await drawer.locator('.n-tag', { hasText: '建议入库' }).count()) > 0);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  /* ================= 11. 留痕 drawer：时间倒序＋apiKey 快照恒掩码＋创建痕标注 ================= */
  await rowByKey(page, 'volcengine').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '留痕' }).click();
  await drawer.getByText('通道变更留痕').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('留痕走 GET traces', calls.some(c => c.method === 'GET' && c.path === '/aiplatform/model-providers/volcengine/traces'));
  const timelineItems = drawer.locator('.n-timeline-item');
  // 本轮两写（换 key → 换地址）＋fixture 两痕（换 key＋地址 → 创建）＝4 痕倒序
  h.check('留痕 4 痕全量（时间倒序）', (await timelineItems.count()) === 4, `实际 ${await timelineItems.count()} 痕`);
  const firstTrace = timelineItems.first();
  h.check('最近痕＝本轮换 key（E2E Mock＋掩码对 ****ab12→****9f2k）', (await firstTrace.getByText('E2E Mock').count()) > 0 && (await firstTrace.getByText('****ab12').count()) > 0 && (await firstTrace.getByText('****9f2k').count()) > 0);
  const legacyTrace = timelineItems.filter({ hasText: '陈运营' }).first();
  h.check('历史痕（陈运营·掩码 ****ef56）', (await legacyTrace.getByText('****ef56').count()) > 0);
  const createTrace = timelineItems.filter({ hasText: '创建' }).first();
  h.check('创建痕标注（old 全 null）', (await createTrace.getByText('创建', { exact: true }).count()) > 0);
  h.check('变更项渲染（换地址痕 v3→v3-next）', (await timelineItems.getByText('api/v3-next').count()) > 0);
  await assertNoPlaintextKeyAnywhere(page, '留痕读面');

  /* ================= 12. 留痕回滚＝打开预填表单（非直接 PUT；apiKey 须重输全量） ================= */
  await legacyTrace.getByRole('button', { name: /回\s*滚/ }).click();
  await modal.getByText('编辑通道').first().waitFor({ timeout: 5000 });
  const rollbackUrl = await modal.getByPlaceholder('必填，如 https://ark.cn-beijing.volces.com/api/v3').inputValue();
  h.check('回滚预填旧值 baseUrl（v3-beta）', rollbackUrl === 'https://ark.cn-beijing.volces.com/api/v3-beta', rollbackUrl);
  const rollbackKey = await modal.getByPlaceholder('留空＝保持现值；填全量新值＝换 key').inputValue();
  h.check('回滚 apiKey 恒空预填（掩码不作找回面，须重输全量）', rollbackKey === '');
  await modal.getByRole('button', { name: /取\s*消/ }).click();
  await sleep(400);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 浏览器不关闭会挂住 node 事件循环（异常路径也要收口）
    if (browser) await browser.close();
    h.summary('aiplatform-model-provider E2E');
  });
