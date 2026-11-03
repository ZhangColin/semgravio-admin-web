/**
 * AI 平台模型档位域 E2E（#90 验收，#80 B 批 T2）——headless Chrome + page.route 全量 mock
 * （fixtures 派生自 admin HEAD DTO，见 support/model-tier-fixtures.mjs）。
 *
 * 唯一 seam＝既有 mock E2E harness：页面外部行为＋HTTP 请求体，不触组件内部。
 * 前置：dev server 跑在 :3001（`pnpm dev`）。运行：`node e2e/model-tier.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as orderFixtures from './support/order-fixtures.mjs';
import * as modelProviderFixtures from './support/model-provider-fixtures.mjs';
import * as modelTierFixtures from './support/model-tier-fixtures.mjs';

const BASE = 'http://localhost:3001';
const ROW = '.n-data-table-tbody .n-data-table-tr';

const h = createHarness();
let browser = null;

/** 行定位器（按 tierKey 锚定——键即寻址）。 */
function rowByKey(page, tierKey) {
  return page.locator(ROW).filter({ hasText: tierKey });
}

async function main() {
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-model-tier E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));

  const { calls, state } = await installAiplatformMocks(page, {
    order: orderFixtures,
    modelProvider: modelProviderFixtures,
    modelTier: modelTierFixtures
  });

  /* ================= 1. 登录 → 动态菜单「模型档位」（V23 种子 280）→ 直达档位页 ================= */
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  await page.locator('[role=menuitem], [role=treeitem]').first().waitFor({ timeout: 10000 });
  const menuTexts = await page.locator('[role=menuitem], [role=treeitem]').allTextContents();
  h.check('侧栏渲染「模型档位」叶子（V23 种子 280）', menuTexts.some(t => t.includes('模型档位')));

  // 菜单→路由跳转与 addRoute 时序竞态（#58 坑与定案）——直达 URL 规避
  await page.goto(`${BASE}/aiplatform/model/tier`);
  await page.locator(ROW).first().waitFor({ timeout: 15000 });
  h.check('落 /aiplatform/model/tier 且列表渲染', page.url().includes('/aiplatform/model/tier'));

  /* ================= 2. 清单契约字段渲染（无分页全量直灌） ================= */
  h.check('全量 4 行直灌（无分页）', (await page.locator(ROW).count()) === 4, `实际 ${await page.locator(ROW).count()} 行`);
  const listCall = calls.filter(c => c.method === 'GET' && c.path === '/aiplatform/model-tiers').at(-1);
  h.check('清单请求无分页参数（全量直灌）', listCall?.query === '' || listCall?.query === null, listCall?.query);
  h.check('无分页器渲染', (await page.locator('.n-pagination').count()) === 0);

  const flashRow = rowByKey(page, 'flash');
  h.check('tierKey mono 列（flash）', String(await flashRow.getByText('flash', { exact: true }).first().getAttribute('class')).includes('font-mono'));
  h.check('modelName mono 列', String(await flashRow.getByText('deepseek-v4-flash-ga-260731').getAttribute('class')).includes('font-mono'));
  h.check('displayName null 回落 tierKey（灰显）', String(await flashRow.getByText('flash', { exact: true }).last().getAttribute('class')).includes('text-gray-400'));
  h.check('flash 最近写者（陈运营）', (await flashRow.getByText('陈运营').count()) > 0);
  const seedRow = rowByKey(page, 'doubao-flagship');
  h.check('种子行操作者占位（-）', (await seedRow.getByText('-', { exact: true }).count()) > 0);
  const disabledRow = rowByKey(page, 'legacy-pro');
  h.check('停用档如实呈现（停用 tag）', (await disabledRow.locator('.n-tag', { hasText: '停用' }).count()) > 0);

  /* ================= 3. 创建档位：先建通道再挂档位（400 PRJ_071 透传）→ 成功刷新 ================= */
  await page.getByRole('button', { name: /创建档位/ }).click();
  const modal = page.locator('.n-modal');
  await modal.getByText('创建档位').first().waitFor({ timeout: 5000 });
  h.check('空表单确认禁用', await modal.getByRole('button', { name: /确认创建/ }).isDisabled());
  await modal.getByPlaceholder('必填，运营短名，如 flash / pro').fill('lite');
  await modal.getByPlaceholder('必填，如 volcengine（先建通道再挂档位）').fill('missing-provider');
  await modal.getByPlaceholder('必填，通道侧 Model ID，如 doubao-seed-1-6-250615').fill('deepseek-v4-lite');
  await modal.getByPlaceholder('选填；留空＝清空显示名，回落语义键展示').fill('轻量档');
  h.check('创建表单停用语义随注', (await modal.getByText('停用档不可作新绑定，既有引用保留').count()) > 0);
  await modal.getByRole('button', { name: /确认创建/ }).click();
  const missingProviderToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_071')));
  h.check('通道不存在 400 PRJ_071 透传 toast', Boolean(missingProviderToast));
  h.check('失败保持创建弹窗可修正', (await modal.getByText('创建档位').count()) > 0);
  const failedCreate = calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-tiers').at(-1);
  h.check('失败命令体原样发出（前端不预校验通道存在性）', failedCreate?.body?.includes('missing-provider'), failedCreate?.body);

  await modal.getByPlaceholder('必填，如 volcengine（先建通道再挂档位）').fill('deepseek');
  await modal.getByRole('button', { name: /确认创建/ }).click();
  const createdToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('档位已创建')));
  h.check('创建成功 toast（回执不消费）', Boolean(createdToast));
  const createCall = calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-tiers').at(-1);
  const createBody = createCall?.body ? JSON.parse(createCall.body) : null;
  h.check(
    'POST 命令体四肢全量（enabled 显式 true）',
    createBody?.tierKey === 'lite' && createBody?.providerKey === 'deepseek' && createBody?.modelName === 'deepseek-v4-lite' && createBody?.displayName === '轻量档' && createBody?.enabled === true,
    createCall?.body
  );
  await sleep(600);
  h.check('新行入清单＋写者落痕', (await rowByKey(page, 'lite').getByText('轻量档').count()) > 0 && (await rowByKey(page, 'lite').getByText('E2E Mock').count()) > 0);

  /* ================= 4. 更新档位：三肢终态替换＋displayName 空＝清空＋enabled 显式传 ================= */
  await rowByKey(page, 'doubao-flagship').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '编辑' }).click();
  await modal.getByText('编辑档位').first().waitFor({ timeout: 5000 });
  h.check('更新 tierKey 固定显（无输入框）', (await modal.getByText('doubao-flagship').count()) > 0 && (await modal.getByPlaceholder('必填，运营短名，如 flash / pro').count()) === 0);
  h.check('providerKey/modelName/displayName 预填现值',
    (await modal.getByPlaceholder('必填，如 volcengine（先建通道再挂档位）').inputValue()) === 'volcengine' &&
      (await modal.getByPlaceholder('必填，通道侧 Model ID，如 doubao-seed-1-6-250615').inputValue()) === 'doubao-seed-1-6-250615' &&
      (await modal.getByPlaceholder('选填；留空＝清空显示名，回落语义键展示').inputValue()) === '豆包旗舰'
  );
  h.check('enabled 开关预填（开）', (await modal.locator('.n-switch.n-switch--active').count()) > 0);
  h.check('displayName 空＝清空回落表单明示', (await modal.getByText('留空即清空（非保持现值）').count()) > 0);
  await modal.getByPlaceholder('必填，如 volcengine（先建通道再挂档位）').fill('deepseek');
  await modal.getByPlaceholder('必填，通道侧 Model ID，如 doubao-seed-1-6-250615').fill('deepseek-v4-pro');
  await modal.getByPlaceholder('选填；留空＝清空显示名，回落语义键展示').fill('');
  await modal.locator('.n-switch').click();
  await modal.getByRole('button', { name: /确认保存/ }).click();
  const putCall = calls.filter(c => c.method === 'PUT' && c.path === '/aiplatform/model-tiers/doubao-flagship').at(-1);
  const putBody = putCall?.body ? JSON.parse(putCall.body) : null;
  h.check(
    'PUT 命令体：指向终态替换＋displayName null 清空＋enabled 显式 false',
    putBody?.providerKey === 'deepseek' && putBody?.modelName === 'deepseek-v4-pro' && putBody?.displayName === null && putBody?.enabled === false,
    putCall?.body
  );
  const savedToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('档位已保存')));
  h.check('更新成功 toast（回执不消费）', Boolean(savedToast));
  await sleep(600);
  const updatedRow = rowByKey(page, 'doubao-flagship');
  h.check('刷新后新指向入列', (await updatedRow.getByText('deepseek-v4-pro').count()) > 0);
  h.check('清空显示名后回落 tierKey 灰显', String(await updatedRow.getByText('doubao-flagship', { exact: true }).last().getAttribute('class')).includes('text-gray-400'));
  h.check('停用档新态入列', (await updatedRow.locator('.n-tag', { hasText: '停用' }).count()) > 0);

  /* ================= 5. 删除：绑定引用 409 PRJ_073 透传＋竞态注入＋删成刷新 ================= */
  const dialog = page.locator('.n-dialog');
  const boundRow = page.locator(ROW).filter({ has: page.getByText('pro', { exact: true }) });
  await boundRow.getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '删除' }).click();
  await dialog.getByText('删除档位').waitFor({ timeout: 5000 });
  h.check('删除确认框：键名对账＋停用指路', (await dialog.getByText('pro').count()) > 0 && (await dialog.getByText('临时下线请改用停用').count()) > 0);
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  const boundToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_073')));
  h.check('被绑定引用 409 PRJ_073 透传 toast', Boolean(boundToast));
  await sleep(500);
  h.check('被拒后行留列（pro）', (await boundRow.count()) > 0);

  state.failNextTierDelete = true;
  await rowByKey(page, 'lite').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '删除' }).click();
  await dialog.getByText('删除档位').waitFor({ timeout: 5000 });
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  const raceToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_073')));
  h.check('竞态注入 409 PRJ_073 透传 toast', Boolean(raceToast));
  await sleep(500);
  h.check('竞态被拒后行留列（lite）', (await rowByKey(page, 'lite').count()) > 0);

  await rowByKey(page, 'lite').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '删除' }).click();
  await dialog.getByText('删除档位').waitFor({ timeout: 5000 });
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  const deletedToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('档位已删除')));
  h.check('删成 toast＋DELETE 端点命中', Boolean(deletedToast) && calls.some(c => c.method === 'DELETE' && c.path === '/aiplatform/model-tiers/lite'));
  await sleep(600);
  h.check('删后行消失、清单回 4 行', (await rowByKey(page, 'lite').count()) === 0 && (await page.locator(ROW).count()) === 4);

  /* ================= 6. 留痕 drawer：时间倒序＋per-trace 回滚（行在＝编辑预填旧值） ================= */
  const drawer = page.locator('.n-drawer');
  await rowByKey(page, 'flash').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '留痕' }).click();
  await drawer.getByText('档位变更留痕').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('留痕走 GET traces', calls.some(c => c.method === 'GET' && c.path === '/aiplatform/model-tiers/flash/traces'));
  let timelineItems = drawer.locator('.n-timeline-item');
  h.check('flash 两痕全量（时间倒序）', (await timelineItems.count()) === 2, `实际 ${await timelineItems.count()} 痕`);
  const upgradeTrace = timelineItems.filter({ hasText: 'deepseek-v3-flash-250101' }).first();
  h.check('升版痕 old→new 模型名', (await upgradeTrace.getByText('deepseek-v4-flash-ga-260731').count()) > 0);
  h.check('清显示名痕 null 如实呈「（无）」', (await upgradeTrace.getByText('（无）').count()) > 0);
  const createTrace = timelineItems.filter({ hasText: '创建' }).first();
  h.check('创建痕标注（old 全 null）＋无回滚钮', (await createTrace.getByText('创建', { exact: true }).count()) > 0 && (await createTrace.getByRole('button', { name: /回\s*滚/ }).count()) === 0);

  await upgradeTrace.getByRole('button', { name: /回\s*滚/ }).click();
  await modal.getByText('编辑档位').first().waitFor({ timeout: 5000 });
  h.check('回滚预填旧值 providerKey/modelName/displayName',
    (await modal.getByPlaceholder('必填，如 volcengine（先建通道再挂档位）').inputValue()) === 'deepseek' &&
      (await modal.getByPlaceholder('必填，通道侧 Model ID，如 doubao-seed-1-6-250615').inputValue()) === 'deepseek-v3-flash-250101' &&
      (await modal.getByPlaceholder('选填；留空＝清空显示名，回落语义键展示').inputValue()) === '旧快模型'
  );
  h.check('回滚 enabled 按旧值预填（开）', (await modal.locator('.n-switch.n-switch--active').count()) > 0);
  await modal.getByRole('button', { name: /确认保存/ }).click();
  const rollbackCall = calls.filter(c => c.method === 'PUT' && c.path === '/aiplatform/model-tiers/flash').at(-1);
  const rollbackBody = rollbackCall?.body ? JSON.parse(rollbackCall.body) : null;
  h.check(
    '回滚链 PUT body＝该痕 old 四件（非直接 PUT、经预填表单）',
    rollbackBody?.providerKey === 'deepseek' && rollbackBody?.modelName === 'deepseek-v3-flash-250101' && rollbackBody?.displayName === '旧快模型' && rollbackBody?.enabled === true,
    rollbackCall?.body
  );
  await waitForMessage(page, msgs => msgs.some(m => m.includes('档位已保存')));
  await sleep(600);
  h.check('回滚后行入新事实（旧模型/旧显示名）', (await rowByKey(page, 'flash').getByText('deepseek-v3-flash-250101').count()) > 0 && (await rowByKey(page, 'flash').getByText('旧快模型').count()) > 0);
  timelineItems = drawer.locator('.n-timeline-item');
  h.check('写成功后留痕同步回读（3 痕、最新 E2E Mock）', (await timelineItems.count()) === 3 && (await timelineItems.first().getByText('E2E Mock').count()) > 0);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  /* ================= 7. 留痕跨行存活：行删后删除痕仍在，回滚＝创建按旧值预填重建 ================= */
  await rowByKey(page, 'legacy-pro').getByRole('button', { name: /操\s*作/ }).click();
  await page.locator('.n-dropdown-option', { hasText: '留痕' }).click();
  await drawer.getByText('档位变更留痕').first().waitFor({ timeout: 10000 });
  await sleep(600);
  h.check('legacy-pro 初始两痕（停用→创建）', (await drawer.locator('.n-timeline-item').count()) === 2);

  // 模拟并行运营在抽屉开着时删除同一行：DOM 触发绕开抽屉遮罩，仍走完整 UI 删除链；
  // 延迟清单回读让删除痕先可达，钉住「行已删即走创建」的竞态窗口（review 回归）。
  await rowByKey(page, 'legacy-pro').getByRole('button', { name: /操\s*作/ }).dispatchEvent('click');
  const drawerDeleteOption = page.locator('.n-dropdown-option', { hasText: '删除' });
  await drawerDeleteOption.waitFor({ state: 'visible', timeout: 5000 });
  await drawerDeleteOption.click();
  await dialog.getByText('删除档位').waitFor({ timeout: 5000 });
  state.delayNextTierList = true;
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  await waitForMessage(page, msgs => msgs.some(m => m.includes('档位已删除')));
  await drawer.locator('.n-timeline-item').filter({ hasText: '删除' }).first().waitFor({ timeout: 5000 });
  h.check('删除成功即同步移除本地行（不等清单回读）', (await rowByKey(page, 'legacy-pro').count()) === 0);
  timelineItems = drawer.locator('.n-timeline-item');
  h.check('删除痕入列且留痕跨行存活（3 痕）', (await timelineItems.count()) === 3, `实际 ${await timelineItems.count()} 痕`);
  const deleteTrace = timelineItems.first();
  h.check('删除痕标注（new 全 null）', (await deleteTrace.getByText('删除', { exact: true }).count()) > 0);
  h.check('删除痕有回滚钮（旧终值可重建）', (await deleteTrace.getByRole('button', { name: /回\s*滚/ }).count()) > 0);

  await deleteTrace.getByRole('button', { name: /回\s*滚/ }).click();
  await modal.getByText('创建档位').first().waitFor({ timeout: 5000 });
  h.check('行已删回滚走创建而非 PUT', calls.filter(c => c.method === 'PUT' && c.path === '/aiplatform/model-tiers/legacy-pro').length === 0);
  h.check('重建 tierKey 固定显（痕主体定格）', (await modal.getByText('legacy-pro').count()) > 0 && (await modal.getByPlaceholder('必填，运营短名，如 flash / pro').count()) === 0);
  h.check('重建按旧值预填三肢',
    (await modal.getByPlaceholder('必填，如 volcengine（先建通道再挂档位）').inputValue()) === 'volcengine' &&
      (await modal.getByPlaceholder('必填，通道侧 Model ID，如 doubao-seed-1-6-250615').inputValue()) === 'doubao-pro-1-250k-230615' &&
      (await modal.getByPlaceholder('选填；留空＝清空显示名，回落语义键展示').inputValue()) === '旧 Pro 档'
  );
  h.check('重建 enabled 按旧值预填（停用）', (await modal.locator('.n-switch.n-switch--active').count()) === 0);
  await modal.getByRole('button', { name: /确认创建/ }).click();
  const recreateCall = calls.filter(c => c.method === 'POST' && c.path === '/aiplatform/model-tiers').at(-1);
  const recreateBody = recreateCall?.body ? JSON.parse(recreateCall.body) : null;
  h.check(
    '重建 POST body＝删除痕 old 四件＋tierKey',
    recreateBody?.tierKey === 'legacy-pro' && recreateBody?.providerKey === 'volcengine' && recreateBody?.modelName === 'doubao-pro-1-250k-230615' && recreateBody?.displayName === '旧 Pro 档' && recreateBody?.enabled === false,
    recreateCall?.body
  );
  await waitForMessage(page, msgs => msgs.some(m => m.includes('档位已创建')));
  await sleep(600);
  const recreatedRow = rowByKey(page, 'legacy-pro');
  h.check('重建行回清单且停用态保留', (await recreatedRow.getByText('旧 Pro 档').count()) > 0 && (await recreatedRow.locator('.n-tag', { hasText: '停用' }).count()) > 0);
  h.check('重建留新痕（创建痕最近先）', (await drawer.locator('.n-timeline-item').first().getByText('创建', { exact: true }).count()) > 0);
  await drawer.locator('.n-base-close').first().click();
  await sleep(400);

  await sleep(200);
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    h.summary('aiplatform-model-tier E2E');
  });
