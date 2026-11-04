/**
 * AI 平台生产承接 E2E（#92，A 批 T3）——真浏览器＋page.route mock admin BFF。
 * fixtures 逐字对齐 admin HEAD `AiplatformProductionHandoffResponse`。
 *
 * 前置：dev server :3001。运行：`node e2e/production-handoff.e2e.mjs`。
 */
import { chromium } from 'playwright-core';
import { createHarness, installAiplatformMocks, sleep, waitForMessage } from './support/harness.mjs';
import * as orderFixtures from './support/order-fixtures.mjs';
import * as projectFixtures from './support/project-fixtures.mjs';
import * as productionFixtures from './support/production-handoff-fixtures.mjs';

const BASE = 'http://localhost:3001';
const ROW = '.n-data-table-tbody .n-data-table-tr';
const PENDING_PROJECT_ID = '7392120209100200009';
const IN_PRODUCTION_PROJECT_ID = '7392120209100500010';

const h = createHarness();
let browser = null;

async function main() {
  try {
    const res = await fetch(BASE);
    h.check('dev server :3001 可访问', res.ok);
  } catch {
    h.check('dev server :3001 可访问', false, '先跑 pnpm dev（端口必须落 3001）');
    return h.summary('aiplatform-production-handoff E2E');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('  [pageerror]', err.message.split('\n')[0]));
  const { calls, state } = await installAiplatformMocks(page, {
    order: orderFixtures,
    project: projectFixtures,
    productionHandoff: productionFixtures
  });

  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('Hcy@2026');
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await page.waitForURL(/aiplatform\/order/, { timeout: 15000 });
  await page.goto(`${BASE}/aiplatform/project`);
  await page.locator(ROW).first().waitFor({ timeout: 15000 });

  async function openProductionTab(projectId) {
    await page.locator(ROW).filter({ hasText: projectId }).getByRole('button', { name: /详\s*情/ }).click();
    const drawer = page.locator('.n-drawer');
    const tab = drawer.locator('.n-tabs-tab').filter({ hasText: '生产承接' });
    await tab.waitFor({ timeout: 5000 });
    await tab.click();
    await sleep(400);
    return drawer;
  }

  /* 1. 第六签读面：四段＋两态 tag＋留痕（系统建档） */
  let drawer = await openProductionTab(PENDING_PROJECT_ID);
  await drawer.getByText('钱老师（微信 qian-lesson）').waitFor({ timeout: 10000 });
  h.check('production:read 下第六签「生产承接」在场', (await drawer.locator('.n-tabs-tab').filter({ hasText: '生产承接' }).count()) === 1);
  h.check('待安排生产 statusName 直读', await drawer.getByText('待安排生产', { exact: true }).first().isVisible());
  h.check('四段渲染联系人/下一步/进展/预计开始',
    (await drawer.getByText('钱老师（微信 qian-lesson）').count()) > 0 &&
      (await drawer.getByText('确认教案模板与首批导入清单').count()) > 0 &&
      (await drawer.getByText('已完成需求拆解，等待排期').count()) > 0 &&
      (await drawer.getByText('2026-11-06 09:30:00').count()) > 0);
  h.check('留痕新→旧且创建行呈现「系统建档」',
    (await drawer.locator('.n-timeline-item').count()) === 2 &&
      (await drawer.getByText('系统建档', { exact: true }).count()) === 1 &&
      (await drawer.locator('.n-timeline-item').last().getByText('系统建档', { exact: true }).count()) === 1);
  h.check('读取生产承接详情端点', calls.some(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`));

  /* 3. 信息整组更新：空＝清空；回执含时间线，applyDetail 直填免回读 */
  const readsBeforeUpdate = calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length;
  await drawer.getByRole('button', { name: '更新信息' }).click();
  const updateModal = page.locator('.n-modal').filter({ hasText: '生产承接信息更新' });
  await updateModal.getByPlaceholder('交付联系人（空＝清空）').fill('钱老师（新联系方式）');
  await updateModal.getByPlaceholder('下一步说明（空＝清空）').fill('');
  await updateModal.getByPlaceholder('进展更新（空＝清空）').fill('已完成首批教案导入');
  const estimatedInput = updateModal.locator('.n-date-picker input');
  await estimatedInput.fill('2026-11-08 10:00:00');
  await estimatedInput.press('Tab');
  await updateModal.getByPlaceholder('依据（必填，至多 1000 字）').fill('排期与联系人同步调整');
  await updateModal.getByRole('button', { name: '整组更新' }).click();
  await drawer.getByText('钱老师（新联系方式）').waitFor({ timeout: 10000 });
  const updateCall = calls.findLast(c => c.method === 'POST' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff/update`);
  const updateBody = JSON.parse(updateCall?.body ?? '{}');
  h.check('更新五字段整组提交（空段=null、预计开始本地 ISO、依据 trim）',
    updateBody.contact === '钱老师（新联系方式）' &&
      updateBody.nextStep === null &&
      updateBody.progressNote === '已完成首批教案导入' &&
      updateBody.estimatedStartAt === '2026-11-08T10:00:00' &&
      updateBody.basis === '排期与联系人同步调整',
    updateCall?.body);
  h.check('更新成功 toast 后回执直填（无二次 GET）',
    calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length === readsBeforeUpdate);
  h.check('更新回执时间线直填（新增信息更新行）',
    (await drawer.locator('.n-timeline-item').count()) === 3 &&
      (await drawer.locator('.n-timeline-item').first().getByText('排期与联系人同步调整').count()) === 1);

  /* 4. 推进：$dialog.warning＋依据；PRJ_056 透传兜底，成功回执直填、生产中不出钮 */
  state.failNextProductionAdvance = true;
  await drawer.getByRole('button', { name: '推进生产' }).click();
  let advanceDialog = page.locator('.n-dialog').filter({ hasText: '推进生产承接' });
  await advanceDialog.getByPlaceholder('推进依据（必填，至多 1000 字）').fill('竞态复核');
  await advanceDialog.getByRole('button', { name: '确认', exact: true }).click();
  const advanceError = await waitForMessage(page, msgs => msgs.some(m => m.includes('PRJ_056')));
  h.check('推进 409 PRJ_056 原样透传 toast', Boolean(advanceError), JSON.stringify(advanceError));
  h.check('推进失败保持待安排生产', (await drawer.getByText('待安排生产', { exact: true }).count()) > 0);

  const readsBeforeAdvance = calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length;
  await drawer.getByRole('button', { name: '推进生产' }).click();
  advanceDialog = page.locator('.n-dialog').filter({ hasText: '推进生产承接' });
  await advanceDialog.getByPlaceholder('推进依据（必填，至多 1000 字）').fill('排期落定，今日开工');
  await advanceDialog.getByRole('button', { name: '确认', exact: true }).click();
  await drawer.getByText('生产中', { exact: true }).first().waitFor({ timeout: 10000 });
  const advanceCall = calls.findLast(c => c.method === 'POST' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff/advance`);
  h.check('推进 body 仅 basis', JSON.parse(advanceCall?.body ?? '{}').basis === '排期落定，今日开工', advanceCall?.body);
  h.check('推进回执含时间线直填（无二次 GET）',
    calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length === readsBeforeAdvance &&
      (await drawer.locator('.n-timeline-item').count()) === 4);
  h.check('生产中稳态不再出推进钮', (await drawer.getByRole('button', { name: '推进生产' }).count()) === 0);

  /* 5. 需用户补充：受控 NSwitch＋确认；data=null 不消费，toast＋回读；置位/清零双路 */
  const supplementSwitch = drawer.locator('.n-switch');
  h.check('需用户补充初始显式未知（不冒充关闭）',
    (await supplementSwitch.getAttribute('aria-checked')) === 'false' &&
      (await drawer.getByText('当前状态未随承接读面下发', { exact: true }).count()) === 1);
  await supplementSwitch.click();
  let supplementDialog = page.locator('.n-dialog').filter({ hasText: '需用户补充' });
  await supplementDialog.getByRole('button', { name: '取消', exact: true }).click();
  h.check('取消确认不发送置位请求且开关不漂移',
    !calls.some(c => c.path.endsWith('/needs-user-supplement')) && (await supplementSwitch.getAttribute('aria-checked')) === 'false');

  const readsBeforeSupplement = calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length;
  await supplementSwitch.click();
  supplementDialog = page.locator('.n-dialog').filter({ hasText: '需用户补充' });
  await supplementDialog.getByRole('button', { name: '确认', exact: true }).click();
  const supplementOnToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('需用户补充已置位')));
  h.check('置位成功 toast', Boolean(supplementOnToast), JSON.stringify(supplementOnToast));
  const supplementOnCall = calls.findLast(c => c.method === 'POST' && c.path.endsWith('/needs-user-supplement'));
  h.check('置位 body required=true', JSON.parse(supplementOnCall?.body ?? '{}').required === true, supplementOnCall?.body);
  h.check('置位回执 data=null 不消费：toast＋一次回读，开关成功后受控开启',
    calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length === readsBeforeSupplement + 1 &&
      (await supplementSwitch.getAttribute('aria-checked')) === 'true');

  await drawer.locator('.n-tabs-tab').filter({ hasText: '基本信息' }).click();
  await drawer.locator('.n-tabs-tab').filter({ hasText: '生产承接' }).click();
  await supplementSwitch.waitFor({ timeout: 10000 });
  h.check('切签重挂保留本次已确认置位',
    (await supplementSwitch.getAttribute('aria-checked')) === 'true' &&
      (await drawer.getByText('当前状态未随承接读面下发', { exact: true }).count()) === 0);

  const readsBeforeSupplementClear = calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length;
  await supplementSwitch.click();
  supplementDialog = page.locator('.n-dialog').filter({ hasText: '需用户补充' });
  await supplementDialog.getByRole('button', { name: '确认', exact: true }).click();
  const supplementOffToast = await waitForMessage(page, msgs => msgs.some(m => m.includes('需用户补充已清零')));
  h.check('清零成功 toast', Boolean(supplementOffToast), JSON.stringify(supplementOffToast));
  const supplementOffCall = calls.findLast(c => c.method === 'POST' && c.path.endsWith('/needs-user-supplement'));
  h.check('清零 body required=false＋再次回读，开关受控关闭',
    JSON.parse(supplementOffCall?.body ?? '{}').required === false &&
      calls.filter(c => c.method === 'GET' && c.path === `/aiplatform/projects/${PENDING_PROJECT_ID}/production-handoff`).length === readsBeforeSupplementClear + 1 &&
      (await supplementSwitch.getAttribute('aria-checked')) === 'false');
  await page.keyboard.press('Escape');
  await sleep(600);

  /* 2. 生产中＋四段 null：稳态与空值如实呈现 */
  drawer = await openProductionTab(IN_PRODUCTION_PROJECT_ID);
  await drawer.getByText('生产中', { exact: true }).first().waitFor({ timeout: 10000 });
  h.check('生产中 statusName 直读', await drawer.getByText('生产中', { exact: true }).first().isVisible());
  const productionPanel = drawer.locator('.n-tab-pane').filter({ hasText: '交付联系人' });
  h.check('四段 null 均以「—」占位', (await productionPanel.getByText('—', { exact: true }).count()) >= 4);
}

main()
  .catch(err => {
    console.error('E2E 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    h.summary('aiplatform-production-handoff E2E');
  });
