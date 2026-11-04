/**
 * AI 平台智能体配置 E2E（#69 初建；#91 档位化）——headless Chrome＋page.route 全量 mock。
 * 覆盖三座（main/executor/designer）主/强档双下拉、页面级一次档位清单、停用档不可选与
 * 已绑定停用警示、五字段保存/回滚、强档留痕、边缘四点合一签（窄 body＋收起留痕＋清空
 * 回落 flash）、PRJ_034/074/075 写失败透传，以及既有工具面全量回归。
 *
 * 前置：dev server 跑在 :3001（`pnpm dev`）。运行：`node e2e/agent-config.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as modelTierFixtures from './support/model-tier-fixtures.mjs';
import * as orderFixtures from './support/order-fixtures.mjs';
import * as skillFixtures from './support/skill-fixtures.mjs';

const BASE = 'http://localhost:3001';
/** 断言靶：main＝prompt/主档/强档三覆盖（主档已停用、fetchUrl 关）/ executor＝全默认。 */
const OVERRIDE_PROMPT = skillFixtures.MAIN_OVERRIDE_PROMPT;
const DEFAULT_PROMPT = skillFixtures.MAIN_DEFAULT_PROMPT;
const OVERRIDE_MODEL = skillFixtures.MAIN_OVERRIDE_MODEL;
const NEW_MODEL = 'doubao-flagship';

const h = createHarness();

/** 浏览器引用提升（main 的 finally 要收口关闭；不关闭会挂住 node 事件循环）。 */
let browser = null;

/** calls 里指定座配置读面（GET）请求数（回读刷新断言锚）。 */
function configGetCount(calls, key) {
  return calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/agent-configs/${key}`).length;
}

/** calls 里指定座配置写（PUT）最后一条 body 解析。 */
function lastConfigPut(calls, key) {
  const call = calls.filter(c => c.method === 'PUT' && c.path === `/aiplatform/agent-configs/${key}`).at(-1);
  return call ? JSON.parse(call.body ?? '{}') : null;
}

/** calls 里边缘点窄写最后一条 body 解析。 */
function lastEdgePut(calls, key) {
  const call = calls.filter(c => c.method === 'PUT' && c.path === `/aiplatform/agent-configs/edge/${key}`).at(-1);
  return call ? JSON.parse(call.body ?? '{}') : null;
}

/** calls 里工具开关写（PUT /agent-tools/{name}）最后一条 body 解析。 */
function lastToolPut(calls, toolName) {
  const call = calls.filter(c => c.method === 'PUT' && c.path === `/aiplatform/agent-tools/${toolName}`).at(-1);
  return call ? JSON.parse(call.body ?? '{}') : null;
}

/** 留痕时间线条目数。 */
async function traceCount(page) {
  return page.locator('.n-timeline-item').count();
}

/** 首条留痕（最近先——服务端倒序）文本。 */
async function newestTraceText(page) {
  return page.locator('.n-timeline-item').first().textContent();
}

/** 首座档位下拉选择启用档（index 0=主档 / 1=路由强档；菜单 teleport 到 body）。 */
async function chooseMainTier(page, label, index = 0) {
  await page.locator('.n-card').first().locator('.n-select').nth(index).click();
  await page.locator('.n-select-menu:visible').last().locator('.n-base-select-option').filter({ hasText: label }).click();
}

async function main() {
  // ---- 前置：dev server 须在 :3001（CORS 只放行 3001，残留旧 server 会顺延 3002） ----
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-agent-config E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));

  // order fixtures 一并挂载：menus mock 的 home=aiplatform_order（不挂撞 benign 空成功，六域先例）
  const { calls, state } = await installAiplatformMocks(page, { order: orderFixtures, skill: skillFixtures, modelTier: modelTierFixtures });

  /* ================= 1. 登录 → 菜单「智能体配置」叶子（240）→ 直达配置页（main 座进入即加载） ================= */
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  await page.locator('[role=menuitem], [role=treeitem]').first().waitFor({ timeout: 10000 });
  const menuItemTexts = await page.locator('[role=menuitem], [role=treeitem]').allTextContents();
  h.check('侧栏渲染「智能体配置」叶子（动态菜单 240）', menuItemTexts.some(t => t.includes('智能体配置')));
  // 菜单→路由跳转与 addRoute 时序竞态（#58 坑与定案）——直达 URL 规避
  await page.goto(`${BASE}/aiplatform/agent/config`);
  await page.locator('.n-timeline-item').first().waitFor({ timeout: 15000 });
  h.check('落 /aiplatform/agent/config（V19 真库种子路径）且 main 座读面渲染', page.url().includes('/aiplatform/agent/config'));
  h.check('进入即加载 GET /agent-configs/main ＋ /traces', configGetCount(calls, 'main') >= 1);
  h.check('档位清单页面级拉一次', calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/model-tiers').length === 1);

  /* ================= 2. main 编辑卡：覆盖标记＋默认预览＋生效值预填 ================= */
  const tabTexts = await page.locator('.n-tabs-tab').allTextContents();
  h.check(
    '五签 label：主智能体 / run 执行体 / 设计执行体 / 边缘调用点 / 工具面',
    ['主智能体', 'run 执行体', '设计执行体', '边缘调用点', '工具面'].every(label => tabTexts.some(t => t.includes(label))),
    JSON.stringify(tabTexts)
  );
  const promptTextarea = page.locator('textarea').first();
  h.check('systemPrompt 预填＝生效值（覆盖态＝覆盖 prompt）', (await promptTextarea.inputValue()) === OVERRIDE_PROMPT);
  const modelSelect = page.locator('.n-card').first().locator('.n-select').first();
  const strongSelect = page.locator('.n-card').first().locator('.n-select').nth(1);
  h.check('主档/路由强档双下拉同范式', (await page.locator('.n-card').first().locator('.n-select').count()) === 2 && (await strongSelect.textContent()).includes('豆包旗舰'));
  h.check('强档默认预览灰字＝pro', (await page.locator('.n-card').first().textContent()).includes('清空保存后回落 pro'));
  h.check('modelId 改档位下拉并显示已绑定停用档现值', (await modelSelect.count()) === 1 && (await modelSelect.textContent()).includes('旧 Pro 档'));
  await modelSelect.click();
  const tierMenu = page.locator('.n-select-menu:visible').last();
  await tierMenu.locator('.n-base-select-option').first().waitFor({ timeout: 5000 });
  const disabledTier = tierMenu.locator('.n-base-select-option').filter({ hasText: '旧 Pro 档' });
  h.check(
    '档位选项＝显示名/语义键＋模型名辅助；停用档带标且 disabled',
    (await tierMenu.textContent()).includes('deepseek-v4-flash-ga-260731') &&
      (await disabledTier.textContent()).includes('已停用') &&
      (await disabledTier.getAttribute('class'))?.includes('n-base-select-option--disabled'),
    JSON.stringify({ menu: await tierMenu.textContent(), disabled: await disabledTier.textContent(), class: await disabledTier.getAttribute('class') })
  );
  await page.keyboard.press('Escape');
  h.check('已绑定后遭停用＝现值旁挂 warning 标记', (await page.locator('.n-card').first().locator('.n-tag', { hasText: '已停用' }).count()) === 1);
  const editCardText = await page.locator('.n-card').first().textContent();
  h.check(
    '覆盖标记「已覆盖」×3（systemPrompt＋主档＋强档）＋默认回落提示（prompt「查看默认」入口＋默认档 flash 内联）',
    (editCardText.match(/已覆盖/g) ?? []).length === 3 &&
      editCardText.includes('查看默认') &&
      editCardText.includes('flash'),
    editCardText.slice(0, 120)
  );
  // 默认 prompt 弹层（aa072c7 起不再内联灰字——「查看默认」NPopover 看全文）
  await page.locator('.n-card').first().getByText('查看默认').click();
  await page.locator('.n-popover').waitFor({ timeout: 5000 });
  h.check('「查看默认」弹层见默认 prompt 全文', (await page.locator('.n-popover').textContent()).includes(DEFAULT_PROMPT.slice(0, 18)));
  await page.keyboard.press('Escape');
  await sleep(400);
  h.check('最近写者留痕行（operatorName 直读）', editCardText.includes('运营·技能管理员'));
  h.check('保存钮在（agent-config:update 权限码门控下渲染）', (await page.getByRole('button', { name: /保存配置/ }).count()) === 1);

  /* ================= 3. 留痕时间线初始态：倒序＋只渲染变化项＋null 显（默认） ================= */
  h.check('main 留痕 2 条（倒序＝最近先）', (await traceCount(page)) === 2, `实际 ${await traceCount(page)} 条`);
  const newestText = await newestTraceText(page);
  h.check(
    '最新痕只渲染变化项（仅 网页抓取：开→关；系统提示词/模型档位/联网搜索不显）',
    newestText.includes('网页抓取') && newestText.includes('开') && newestText.includes('关') &&
      !newestText.includes('系统提示词') && !newestText.includes('模型档位') && !newestText.includes('路由强档') && !newestText.includes('联网搜索'),
    newestText ?? ''
  );
  const oldestText = await page.locator('.n-timeline-item').last().textContent();
  h.check(
    '最旧痕三字段变化＋null 显「（默认）」（prompt/主档/强档 （默认）→覆盖值；两 flag 未动不显）',
    oldestText.includes('（默认）') && oldestText.includes(OVERRIDE_PROMPT.slice(0, 14)) && oldestText.includes('路由强档') && oldestText.includes('doubao-flagship') &&
      !oldestText.includes('联网搜索') && !oldestText.includes('网页抓取'),
    oldestText ?? ''
  );
  h.check('条目带操作者（operatorName 直读）', oldestText.includes('王建设'));
  h.check('条目「回滚」钮在（update 码门控下渲染）', (await page.locator('.n-timeline-item .n-button', { hasText: '回滚' }).count()) === 2);

  /* ================= 4. 保存失败注入：400 PRJ_034 透传 toast、表单保留 ================= */
  const mainGetsBeforeSave = configGetCount(calls, 'main');
  await chooseMainTier(page, '豆包旗舰');
  await chooseMainTier(page, '强模型档', 1);
  state.failNextAgentConfigUpdate = true;
  await page.getByRole('button', { name: /保存配置/ }).click();
  const failToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_034')));
  h.check('保存失败 toast 透传 provider message（PRJ_034）', Boolean(failToast), JSON.stringify(failToast));
  await sleep(600);
  h.check('失败后不回读（表单保留可修正重试）', configGetCount(calls, 'main') === mainGetsBeforeSave && (await modelSelect.textContent()).includes('豆包旗舰'));

  state.failNextAgentConfigMissingTier = true;
  await page.getByRole('button', { name: /保存配置/ }).click();
  const missingTierToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_074')));
  h.check('缺档 400 PRJ_074 message 原样透传', Boolean(missingTierToast), JSON.stringify(missingTierToast));
  h.check('PRJ_074 后表单保留', (await modelSelect.textContent()).includes('豆包旗舰') && (await strongSelect.textContent()).includes('强模型档'));

  state.failNextAgentConfigDisabledTier = true;
  await page.getByRole('button', { name: /保存配置/ }).click();
  const disabledTierToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_075')));
  h.check('停用档竞态 400 PRJ_075 message 原样透传', Boolean(disabledTierToast), JSON.stringify(disabledTierToast));
  h.check('PRJ_075 后表单保留', (await modelSelect.textContent()).includes('豆包旗舰') && (await strongSelect.textContent()).includes('强模型档'));

  /* ================= 5. 保存成功：五字段全量回传（flag 原值透传）＋清空回落＋覆盖标记复位 ================= */
  await promptTextarea.fill(''); // 清空 systemPrompt＝清覆盖回落默认
  await page.getByRole('button', { name: /保存配置/ }).click();
  const savedToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已保存') && m.includes('主智能体')));
  h.check('保存成功 toast（座名插值）', Boolean(savedToast), JSON.stringify(savedToast));
  const putBody = lastConfigPut(calls, 'main');
  h.check(
    'PUT body 恰好五字段全量回传：prompt 空串清覆盖、主/强档新值、两 flag 原值透传',
    Boolean(putBody) &&
      Object.keys(putBody).sort().join(',') === 'fetchUrlEnabled,modelId,routingStrongModelId,systemPrompt,webSearchEnabled' &&
      putBody.systemPrompt === '' &&
      putBody.modelId === NEW_MODEL &&
      putBody.routingStrongModelId === 'pro' &&
      putBody.webSearchEnabled === true &&
      putBody.fetchUrlEnabled === false,
    putBody ? JSON.stringify(putBody) : 'no PUT call'
  );
  await sleep(600);
  h.check('成功后回读刷新（GET config 再入）', configGetCount(calls, 'main') === mainGetsBeforeSave + 1);
  const refreshedCardText = await page.locator('.n-card').first().textContent();
  h.check(
    '清空提交＝回落默认＋覆盖标记复位（prompt＝默认原文、tag「默认」；主/强档保持「已覆盖」）',
    (await promptTextarea.inputValue()) === DEFAULT_PROMPT &&
      (refreshedCardText.match(/已覆盖/g) ?? []).length === 2 &&
      refreshedCardText.includes('默认'),
    `prompt=${(await promptTextarea.inputValue()).slice(0, 18)}… tags=${(refreshedCardText.match(/已覆盖/g) ?? []).length}`
  );
  await sleep(400);
  h.check('留痕新增一条（本次保存＝真实变更落痕，3 条）', (await traceCount(page)) === 3, `实际 ${await traceCount(page)} 条`);
  const saveTraceText = await newestTraceText(page);
  h.check('新痕渲染 prompt/主档/强档变化，两 flag 未动不显', saveTraceText.includes('（默认）') && saveTraceText.includes(NEW_MODEL) && saveTraceText.includes('路由强档') && saveTraceText.includes('doubao-flagship') && saveTraceText.includes('pro') && !saveTraceText.includes('联网搜索'), saveTraceText ?? '');

  /* ================= 6. executor 座：全默认靶（无覆盖行）＋留痕空态 ================= */
  await page.locator('.n-tabs-tab').filter({ hasText: 'run 执行体' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('切签加载 GET /agent-configs/executor', configGetCount(calls, 'executor') >= 1);
  const execCardText = await page.locator('.n-card').first().textContent();
  h.check(
    'executor 全默认：生效值＝默认原文、覆盖标记「默认」×3、无最近写者行',
    (await page.locator('textarea').first().inputValue()) === skillFixtures.EXECUTOR_DEFAULT_PROMPT &&
      (await page.locator('.n-tag', { hasText: '默认' }).count()) === 3 &&
      !execCardText.includes('最近写者'),
    execCardText.slice(0, 120)
  );
  h.check('executor 留痕空态', (await traceCount(page)) === 0 && (await page.locator('text=暂无变更留痕').count()) === 1);

  /* ================= 6b. designer 第三座：同 panel 参数化寻址 ================= */
  await page.locator('.n-tabs-tab').filter({ hasText: '设计执行体' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 10000 });
  h.check('designer 第三座加载 GET /agent-configs/designer', configGetCount(calls, 'designer') >= 1);
  h.check('designer 读面题与生效默认档直读', (await page.locator('.n-card').first().textContent()).includes('设计执行体'));

  /* ================= 7. 回 main 座回滚：$dialog.warning → PUT old 五值写回＝留新痕 ================= */
  await page.locator('.n-tabs-tab').filter({ hasText: '主智能体' }).click();
  await page.locator('.n-timeline-item').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('回签重挂回读（GET 再入，痕 3 条＝初始 2＋保存 1）', (await traceCount(page)) === 3, `实际 ${await traceCount(page)} 条`);
  await page.locator('.n-timeline-item').first().locator('.n-button', { hasText: '回滚' }).click();
  await sleep(300);
  h.check('回滚二次确认弹窗（$dialog.warning）', (await page.locator('.n-dialog').count()) === 1);
  await page.locator('.n-dialog').getByRole('button', { name: /确\s*认/ }).click();
  const rollbackToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('已回滚')));
  h.check('回滚成功 toast（旧值已写回）', Boolean(rollbackToast), JSON.stringify(rollbackToast));
  const rollbackBody = lastConfigPut(calls, 'main');
  h.check(
    '回滚 PUT body＝该次变更前 old 五值快照（prompt＋主/强档旧值＋两 flag 原值）',
    Boolean(rollbackBody) &&
      Object.keys(rollbackBody).sort().join(',') === 'fetchUrlEnabled,modelId,routingStrongModelId,systemPrompt,webSearchEnabled' &&
      rollbackBody.systemPrompt === OVERRIDE_PROMPT &&
      rollbackBody.modelId === OVERRIDE_MODEL &&
      rollbackBody.routingStrongModelId === 'doubao-flagship' &&
      rollbackBody.webSearchEnabled === true &&
      rollbackBody.fetchUrlEnabled === false,
    rollbackBody ? JSON.stringify({ ...rollbackBody, systemPrompt: rollbackBody.systemPrompt?.slice(0, 18) }) : 'no PUT call'
  );
  await sleep(600);
  h.check('回滚后编辑卡刷新（prompt 复覆盖态＋「已覆盖」×3）', (await page.locator('textarea').first().inputValue()) === OVERRIDE_PROMPT && ((await page.locator('.n-card').first().textContent()).match(/已覆盖/g) ?? []).length === 3);
  h.check('回滚＝一次新变更留新痕（4 条）', (await traceCount(page)) === 4, `实际 ${await traceCount(page)} 条`);
  h.check('三座多次切签仍共享同一次档位清单', calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/model-tiers').length === 1);

  /* ================= 8. 边缘调用点：四点合一签＋窄写＋收起留痕＋清空回落 ================= */
  await page.locator('.n-tabs-tab').filter({ hasText: '边缘调用点' }).click();
  const namingCard = page.locator('[data-edge-key="naming"]');
  await namingCard.waitFor({ timeout: 10000 });
  await sleep(600);
  const edgePaneText = await page.locator('.n-tab-pane').textContent();
  h.check(
    '边缘四点同签纵排（项目取名/上下文压缩/入口分类/技能预检）',
    (await page.locator('[data-edge-key]').count()) === 4 &&
      ['项目取名', '上下文压缩', '入口分类', '技能预检'].every(label => edgePaneText.includes(label))
  );
  h.check(
    '边缘四块各加载 GET config＋traces（3 端点零新码）',
    skillFixtures.EDGE_KEYS.every(key =>
      calls.some(c => c.method === 'GET' && c.path === `/aiplatform/agent-configs/edge/${key}`) &&
      calls.some(c => c.method === 'GET' && c.path === `/aiplatform/agent-configs/edge/${key}/traces`)
    )
  );
  h.check('边缘窄面板仅一档位下拉（无 prompt/强档/工具字段）', (await namingCard.locator('.n-select').count()) === 1 && (await namingCard.locator('textarea').count()) === 0);
  h.check('留痕默认收起', (await namingCard.locator('.n-timeline-item').count()) === 0);
  await namingCard.getByText('变更留痕', { exact: true }).click();
  await namingCard.locator('.n-timeline-item').first().waitFor({ timeout: 5000 });
  const edgeTraceText = await namingCard.locator('.n-timeline-item').first().textContent();
  h.check('展开留痕仅渲染档位 old/new＋操作者', edgeTraceText.includes('模型档位') && edgeTraceText.includes('（默认）') && edgeTraceText.includes('pro') && edgeTraceText.includes('运营·智能体管理员'), edgeTraceText ?? '');

  const namingSelect = namingCard.locator('.n-select');
  await namingSelect.click();
  await page.locator('.n-base-select-option:visible').filter({ hasText: '豆包旗舰' }).click();
  await namingCard.getByRole('button', { name: /保存配置/ }).click();
  await sleep(600);
  const edgePutBody = lastEdgePut(calls, 'naming');
  h.check(
    '边缘写命令体恰好仅 {modelId}（不带 prompt/flag/强档）',
    Boolean(edgePutBody) && Object.keys(edgePutBody).join(',') === 'modelId' && edgePutBody.modelId === 'doubao-flagship',
    edgePutBody ? JSON.stringify(edgePutBody) : 'no edge PUT'
  );

  await namingSelect.hover();
  await namingCard.locator('.n-base-clear').click();
  await namingCard.getByRole('button', { name: /保存配置/ }).click();
  await sleep(600);
  const edgeClearBody = lastEdgePut(calls, 'naming');
  h.check('清空覆盖写 {modelId:null}', Boolean(edgeClearBody) && Object.keys(edgeClearBody).join(',') === 'modelId' && edgeClearBody.modelId === null, edgeClearBody ? JSON.stringify(edgeClearBody) : 'no edge clear PUT');
  h.check('清空后回读 flash＋默认标记', (await namingSelect.textContent()).includes('flash') && (await namingCard.locator('.n-tag', { hasText: '默认' }).count()) === 1);
  h.check('边缘四点仍共享页面级一次档位清单', calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/model-tiers').length === 1);

  /* ================= 9. 工具面签：三槽位块＋kind 三值映射＋骨架/内建 disabled 恒开 ================= */
  await page.locator('.n-tabs-tab').filter({ hasText: '工具面' }).click();
  await page.locator('.n-data-table-tbody .n-data-table-tr').first().waitFor({ timeout: 15000 });
  await sleep(600);
  const blockTitles = await page.locator('.n-card .n-card-header__main').allTextContents();
  h.check('三槽位块题 slotName 直读（主智能体/run 执行体/子智能体）', ['主智能体', 'run 执行体', '子智能体'].every(t => blockTitles.some(b => b.includes(t))), JSON.stringify(blockTitles));
  const bodyText = await page.locator('.n-card').first().textContent();
  h.check('kind tag 端侧三值映射（骨架/增强/内建）', bodyText.includes('骨架') && bodyText.includes('增强') && bodyText.includes('内建'));
  // 工具名全局唯一（ask_user/web_search/fetch_url 仅 main 槽）——页级行定位即可
  const skeletonRow = page.locator('.n-data-table-tr').filter({ hasText: 'ask_user' });
  h.check('骨架行 switch disabled 恒开', (await skeletonRow.locator('.n-switch--disabled.n-switch--active').count()) === 1);
  const webSearchRow = page.locator('.n-data-table-tr').filter({ hasText: 'web_search' });
  const fetchUrlRow = page.locator('.n-data-table-tr').filter({ hasText: 'fetch_url' });
  h.check(
    '增强件挂载态＝main 配置 flag 同源（web_search 开 / fetch_url 关——回滚后原值）',
    (await webSearchRow.locator('.n-switch--active').count()) === 1 && (await fetchUrlRow.locator('.n-switch--active').count()) === 0
  );
  h.check('增强行 switch 可操作（toggle 码门控下 enabled）', (await fetchUrlRow.locator('.n-switch:not(.n-switch--disabled)').count()) === 1);

  /* ================= 9. 增强工具即时开关：PUT {enabled} → toast＋清单回读 ================= */
  await fetchUrlRow.locator('.n-switch').click();
  const toggleToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('fetch_url') && m.includes('开启')));
  h.check('开关成功 toast（工具名＋目标态）', Boolean(toggleToast), JSON.stringify(toggleToast));
  const toggleBody = lastToolPut(calls, 'fetch_url');
  h.check('开关 PUT body＝{enabled:true}（受控即时写、无确认弹窗）', Boolean(toggleBody) && toggleBody.enabled === true, JSON.stringify(toggleBody));
  await sleep(600);
  h.check('成功后清单回读（开关视觉态＝新事实）', (await fetchUrlRow.locator('.n-switch--active').count()) === 1);

  /* ================= 10. 开关失败注入：403 PRJ_036 透传＋受控值回滚（视觉态不动） ================= */
  state.failNextAgentToolToggle = true;
  await webSearchRow.locator('.n-switch').click(); // 当前开→点关（发起 PUT enabled:false）
  const toggleFailToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_036')));
  h.check('开关失败 toast 透传 provider message（PRJ_036）', Boolean(toggleFailToast), JSON.stringify(toggleFailToast));
  await sleep(600);
  h.check('失败回滚：受控开关视觉态不动（web_search 仍开）', (await webSearchRow.locator('.n-switch--active').count()) === 1);
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 浏览器不关闭会挂住 node 事件循环（异常路径也要收口）
    if (browser) await browser.close();
    h.summary('aiplatform-agent-config E2E');
  });
