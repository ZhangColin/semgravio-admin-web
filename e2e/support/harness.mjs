/**
 * E2E 公共 harness（#57 落地、#58 泛化，#60/#61/#62/#63 扩沙箱/成本/单价表/素材域，#67 扩技能域（#68 指派、#69 智能体配置、#71 草稿域），#87 扩合同域，共用 seam）——page.route mock + 断言汇总。
 *
 * mock 派生自 admin :8081 `/v3/api-docs`（fixtures 见各域 support/*-fixtures.mjs）；
 * 错误信封按 AiplatformUpstreamErrorAdvice 形状：HTTP 状态照抄 provider、
 * body.code＝provider 数字业务码（域码×1000＋序号：PRJ→4xxx / ORD→5xxx / WSP→1xxx / MET→3xxx / KNW→2xxx / IDN→6xxx / SKL→7xxx）、message 原文。
 */
import zlib from 'node:zlib';

/** 断言台账：PASS/FAIL 汇总，exit code 收口。 */
export function createHarness() {
  const results = [];
  return {
    /** @param name 断言名 @param cond 真值 @param detail 失败时的上下文 */
    check(name, cond, detail = '') {
      results.push({ name, pass: Boolean(cond), detail: cond ? '' : detail });
      const mark = cond ? 'PASS' : 'FAIL';
      console.log(`  [${mark}] ${name}${cond ? '' : ` —— ${detail}`}`);
    },
    summary(label) {
      const failed = results.filter(r => !r.pass);
      console.log(`\n${label}: ${results.length - failed.length}/${results.length} 通过`);
      if (failed.length) {
        process.exitCode = 1;
      }
      return failed.length === 0;
    }
  };
}

/** 延迟：Naive UI 动画/请求节流需要真实等待。 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 轮询抓 toast 闪现（Naive message 生命周期 ~3s，单点 isVisible/waitFor 易错过）。
 * @param page playwright page
 * @param predicate 命中函数（收到消息文本数组）
 * @param timeoutMs 最长等待（默认 10s，300ms 步进）
 * @returns 命中的消息数组；未命中返回 null
 */
export async function waitForMessage(page, predicate, timeoutMs = 10000) {
  const steps = Math.ceil(timeoutMs / 300);
  for (let i = 0; i < steps; i += 1) {
    await sleep(300);
    const msgs = await page.locator('.n-message').allTextContents();
    if (msgs.length && predicate(msgs)) return msgs;
  }
  const last = await page.locator('.n-message').allTextContents();
  return last.length && predicate(last) ? last : null;
}

/**
 * 安装 /proxy-default/** 全量 mock（auth / menus.my / aiplatform 各域）。
 *
 * @param page playwright page
 * @param fixtures { order?, project?, workspace?, cost?, priceEntry?, material?, skill?, contract? } 各域 fixtures（见 support/*-fixtures.mjs；域缺省＝不挂该域路由）
 * @returns {{calls: Array, state: {failNextQuote: boolean, failNextWorkspaceWrite: boolean, failNextReprice: boolean, failNextMaterialWrite: boolean, failNextSkillInstall: boolean, failNextSkillWrite: boolean, failNextSkillUninstall: boolean, failNextSkillUpdate: boolean, failNextSkillAssign: boolean, failNextSkillPrecheck: boolean, failNextSkillDraftPromote: boolean, failNextSkillDraftReject: boolean, failNextAgentConfigUpdate: boolean, failNextAgentToolToggle: boolean, failNextContractWrite: boolean}}}
 *          calls=拦截到的请求流水（断言查询参数用）；state.failNext*＝下一次对应写抛业务错误信封
 *          （quote/workspaceWrite/reprice 抛 409，material 抛 400/404，skill 按动作族抛 502/400/409/409/400，
 *          skillDraftPromote 抛 409 SKL_016、skillDraftReject 抛 400 SKL_018，
 *          agentConfigUpdate 抛 400、agentToolToggle 抛 403——透传 toast 断言用；
 *          skillPrecheck 抛 400 SKL_011＝预检失败注入（错误族与 PUT 指派同源）；
 *          contractWrite 抛 409 ORD_027 双签门禁竞态——advance 末边可观测门控的兜底透传靶）
 */
export async function installAiplatformMocks(page, fixtures) {
  const calls = [];
  const state = {
    failNextQuote: false,
    failNextWorkspaceWrite: false,
    failNextReprice: false,
    failNextMaterialWrite: false,
    failNextSkillInstall: false,
    failNextSkillWrite: false,
    failNextSkillUninstall: false,
    failNextSkillUpdate: false,
    failNextSkillAssign: false,
    failNextSkillPrecheck: false,
    failNextSkillDraftPromote: false,
    failNextSkillDraftReject: false,
    failNextAgentConfigUpdate: false,
    failNextAgentToolToggle: false,
    failNextContractWrite: false
  };

  const json = (route, status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  /** 时间区间过滤（含两端，字符串比较即可——fixtures/查询均为 ISO-8601 同形本地串）。 */
  function filterByCreatedRange(rows, query) {
    const from = query.get('createdFrom');
    const to = query.get('createdTo');
    let out = rows;
    if (from) out = out.filter(row => row.createdAt >= from);
    if (to) out = out.filter(row => row.createdAt <= to);
    return out;
  }

  /** 账号档案 mock 数据（externalId＝OIDC sub；与订单/项目列表的 externalId 筛选同批账号——单一事实源）。 */
  const ACCOUNT_PROFILES = {
    'ext-wangshi2': { id: '7395120209080100002', externalId: 'ext-wangshi2', displayName: '王十二', createdAt: '2026-08-01T10:00:00' },
    'ext-zhaoliu': { id: '7395120209080100001', externalId: 'ext-zhaoliu', displayName: '赵六', createdAt: '2026-08-02T11:00:00' }
  };
  /** externalId 精确 → ownerDisplayName 映射（派生自 ACCOUNT_PROFILES——两域 fixtures 共用同一批账号档案）。 */
  const externalIdOwnerMap = Object.fromEntries(
    Object.entries(ACCOUNT_PROFILES).map(([externalId, profile]) => [externalId, profile.displayName])
  );
  function filterByExternalId(rows, query) {
    const externalId = query.get('externalId');
    if (!externalId) return rows;
    return rows.filter(row => row.ownerDisplayName === (externalIdOwnerMap[externalId] ?? '@@none@@'));
  }

  /** 分页切片（1-based，镜像 PageResponse wire：total 为字符串）。 */
  function paginate(rows, query) {
    const pageNum = Math.max(1, Number(query.get('page') ?? '1'));
    const size = Math.max(1, Number(query.get('size') ?? '10'));
    return {
      code: 200,
      message: 'ok',
      data: {
        items: rows.slice((pageNum - 1) * size, pageNum * size),
        total: String(rows.length),
        page: pageNum,
        size
      },
      requestId: 'e2e-mock',
      errors: null
    };
  }

  /** 订单列表 mock：四维筛选可组合（缺省＝全量），分页 1-based 切片回显。 */
  function orderListResponse(query) {
    let rows = [...fixtures.order.ORDER_ROWS];
    const status = query.get('status');
    if (status) {
      const codes = status.split(',').map(Number);
      rows = rows.filter(row => codes.includes(row.status));
    }
    rows = filterByExternalId(rows, query);
    const orderId = query.get('orderId');
    if (orderId) {
      rows = rows.filter(row => row.id === orderId);
    }
    rows = filterByCreatedRange(rows, query);
    return paginate(rows, query);
  }

  /** 项目列表 mock：四维筛选（status 三档单值——与订单多选逗号串有意不同），归档照读不特殊处理。 */
  function projectListResponse(query) {
    let rows = [...fixtures.project.PROJECT_ROWS];
    const status = query.get('status');
    if (status) {
      rows = rows.filter(row => row.status === Number(status));
    }
    rows = filterByExternalId(rows, query);
    const projectId = query.get('projectId');
    if (projectId) {
      rows = rows.filter(row => row.id === projectId);
    }
    rows = filterByCreatedRange(rows, query);
    return paginate(rows, query);
  }

  /** 沙箱清单 mock：desired/actual 单选可组合（缺省＝全量），分页 1-based 切片回显。 */
  function workspaceListResponse(query) {
    let rows = [...fixtures.workspace.WORKSPACE_ROWS];
    const desired = query.get('desired');
    if (desired) rows = rows.filter(row => row.desiredState === Number(desired));
    const actual = query.get('actual');
    if (actual) rows = rows.filter(row => row.containerState === Number(actual));
    return paginate(rows, query);
  }

  /**
   * 四写响应＝动作后的观测详情（provider 契约：响应即新事实）——按 action 变异基档：
   * 唤醒→运行/运行中/就绪（封存深度唤醒清封存字段）；休眠→休眠/无容器（卷保留）；
   * 重建→运行中/就绪；封存→封存＋包元数据＋卷容缺。
   */
  function applyWorkspaceAction(base, action) {
    const after = JSON.parse(JSON.stringify(base));
    after.lastTouchAt = '2026-09-16T12:00:00';
    after.updatedAt = '2026-09-16T12:00:00';
    if (action === 'wake') {
      after.desiredState = 1;
      after.desiredStateName = '运行';
      after.containerState = 1;
      after.containerStateName = '运行中';
      after.status = 2;
      after.statusName = '就绪';
      after.sealedAt = null;
      after.archivePath = null;
      after.archiveSizeBytes = null;
      after.volumeSizeBytes = after.volumeSizeBytes ?? '2147483648';
    } else if (action === 'hibernate') {
      after.desiredState = 2;
      after.desiredStateName = '休眠';
      after.containerState = 3;
      after.containerStateName = '无容器';
    } else if (action === 'rebuild') {
      after.containerState = 1;
      after.containerStateName = '运行中';
      after.status = 2;
      after.statusName = '就绪';
    } else if (action === 'seal') {
      after.desiredState = 3;
      after.desiredStateName = '封存';
      after.containerState = 3;
      after.containerStateName = '无容器';
      after.sealedAt = '2026-09-16T12:00:00';
      after.archivePath = `workspace-sealed/${after.workspaceId}.tar.gz`;
      after.archiveSizeBytes = '52428800';
      after.volumeSizeBytes = null;
    }
    return after;
  }

  /** 单价表清单 mock：provider/model 精确等值过滤（缺省＝全量行），分页 1-based 切片回显。 */
  function priceEntryListResponse(query) {
    let rows = [...fixtures.priceEntry.PRICE_ENTRY_ROWS];
    const provider = query.get('provider');
    if (provider) rows = rows.filter(row => row.provider === provider);
    const model = query.get('model');
    if (model) rows = rows.filter(row => row.model === model);
    return paginate(rows, query);
  }

  /**
   * 原子改价（库内两步）——就地变异 fixture 行：被关行 effectiveTo=新起点（保留原开行操作者
   * 不被改写），新行敞口生效、落写头痕、unshift 清单首（生效起点倒序，刷新后如实呈现）。
   */
  function applyReprice(row, command) {
    row.effectiveTo = command.effectiveFrom;
    const opened = {
      id: fixtures.priceEntry.OPENED_ROW_ID,
      provider: row.provider,
      model: row.model,
      tokenKind: row.tokenKind,
      tokenKindName: row.tokenKindName,
      unitPrice: String(command.unitPrice),
      currency: command.currency,
      effectiveFrom: command.effectiveFrom,
      effectiveTo: null,
      operatorId: '1',
      operatorName: 'E2E Mock'
    };
    fixtures.priceEntry.PRICE_ENTRY_ROWS.unshift(opened);
    return { closed: { ...row }, opened };
  }

  /** 停用（即时关行不接新行）——就地变异 fixture 行；被关行是操作者唯一落点。 */
  function applyDeactivate(row) {
    row.effectiveTo = fixtures.priceEntry.DEACTIVATED_AT;
    row.operatorId = '1';
    row.operatorName = 'E2E Mock';
    return { ...row };
  }

  /** 素材清单 mock：status 单选/沉淀时间闭区间（Instant UTC 字符串比较）/projectId 精确，三维可组合。 */
  function materialListResponse(query) {
    let rows = [...fixtures.material.MATERIAL_ROWS];
    const status = query.get('status');
    if (status) rows = rows.filter(row => row.status === Number(status));
    const sunkFrom = query.get('sunkFrom');
    const sunkTo = query.get('sunkTo');
    if (sunkFrom) rows = rows.filter(row => row.sunkAt >= sunkFrom);
    if (sunkTo) rows = rows.filter(row => row.sunkAt <= sunkTo);
    const projectId = query.get('projectId');
    if (projectId) rows = rows.filter(row => row.projectId === projectId);
    return paginate(rows, query);
  }

  /**
   * 素材启停（可逆开关、重复幂等）——行·详情同步就地变异（抽屉 reload 后拿到新事实）、
   * 操作者留最近一次（X-User 头落痕的 mock 等价）。
   */
  function applyMaterialToggle(row, enabled) {
    row.status = enabled ? 1 : 2;
    row.statusName = enabled ? '启用' : '停用';
    row.operatorId = '1';
    row.operatorName = 'E2E Mock';
    const detail = fixtures.material.MATERIAL_DETAILS[row.id];
    if (detail) {
      detail.status = row.status;
      detail.statusName = row.statusName;
      detail.operatorId = row.operatorId;
      detail.operatorName = row.operatorName;
    }
    return { ...row };
  }

  /** 素材删除（治理移除不可逆）——回执＝删除前终态；行·详情双删（此后清单/详情均不可见）。 */
  function applyMaterialDelete(row) {
    const receipt = { ...row };
    const idx = fixtures.material.MATERIAL_ROWS.indexOf(row);
    if (idx >= 0) fixtures.material.MATERIAL_ROWS.splice(idx, 1);
    delete fixtures.material.MATERIAL_DETAILS[row.id];
    return receipt;
  }

  /** 技能启停（可逆开关）——行·详情同步就地变异（抽屉 reload 后拿到新事实）、操作者留最近一次。 */
  function applySkillToggle(row, enabled) {
    row.status = enabled ? 1 : 2;
    row.statusName = enabled ? '启用' : '停用';
    row.operatorId = '1';
    row.operatorName = 'E2E Mock';
    const detail = fixtures.skill.SKILL_DETAILS[row.id];
    if (detail) {
      detail.status = row.status;
      detail.statusName = row.statusName;
      detail.operatorId = row.operatorId;
      detail.operatorName = row.operatorName;
    }
    return { ...row };
  }

  /** 技能卸载（库行删除不可逆）——回执＝删除前终态；行·详情双删。 */
  function applySkillUninstall(row) {
    const receipt = { ...row };
    const idx = fixtures.skill.SKILL_ROWS.indexOf(row);
    if (idx >= 0) fixtures.skill.SKILL_ROWS.splice(idx, 1);
    delete fixtures.skill.SKILL_DETAILS[row.id];
    return receipt;
  }

  /** 安装（git 快照固化）——按 repoUrl 落包：装入条目 append 清单尾（内置在前序不动）、详情随建。 */
  function applySkillInstall(command) {
    const rows = fixtures.skill.INSTALL_ROWS.map(row => ({ ...row, sourcePackage: command.repoUrl }));
    for (const row of rows) {
      fixtures.skill.SKILL_ROWS.push(row);
      fixtures.skill.SKILL_DETAILS[row.id] = { ...row, frontmatter: { name: row.name }, content: `e2e mock ${row.name}`, resources: {} };
    }
    return rows.map(row => ({ ...row }));
  }

  /**
   * 显式更新（重拉快照＋版本留痕）——PACK_A 靶：同名行原地翻新（版本→to、可更新标记回落
   * false、操作者落痕）+ 移除 sql-helper + 新增 diagram-draw + 留痕 unshift；其余包＝远端
   * 未前进（from==to 幂等回执，未落痕未写行、终态行集原样）。
   */
  function applySkillUpdate(sourcePackage) {
    const S = fixtures.skill;
    if (sourcePackage !== S.PACK_A) {
      const rows = S.SKILL_ROWS.filter(row => row.sourcePackage === sourcePackage).map(row => ({ ...row }));
      const version = rows[0]?.version ?? 'unknown';
      return { sourcePackage, fromVersion: version, toVersion: version, removedSkillNames: [], operatorId: '1', operatorName: 'E2E Mock', skills: rows };
    }
    const removedSkillNames = [];
    for (let i = S.SKILL_ROWS.length - 1; i >= 0; i -= 1) {
      const row = S.SKILL_ROWS[i];
      if (row.sourcePackage !== sourcePackage) continue;
      if (row.name === 'sql-helper') {
        removedSkillNames.push(row.name);
        S.SKILL_ROWS.splice(i, 1);
        delete S.SKILL_DETAILS[row.id];
      } else {
        row.version = S.PACK_A_TO;
        row.updateAvailable = false;
        row.operatorId = '1';
        row.operatorName = 'E2E Mock';
        const detail = S.SKILL_DETAILS[row.id];
        if (detail) {
          detail.version = row.version;
          detail.updateAvailable = false;
          detail.operatorId = row.operatorId;
          detail.operatorName = row.operatorName;
        }
      }
    }
    S.SKILL_ROWS.push({ ...S.UPDATE_ADDED_ROW });
    S.SKILL_DETAILS[S.UPDATE_ADDED_ROW.id] = { ...S.UPDATE_ADDED_ROW, frontmatter: { name: 'diagram-draw' }, content: 'e2e mock diagram-draw', resources: {} };
    (S.UPDATE_TRACES[sourcePackage] ??= []).unshift({
      sourcePackage,
      fromVersion: S.PACK_A_FROM,
      toVersion: S.PACK_A_TO,
      operatorId: '1',
      operatorName: 'E2E Mock',
      operatedAt: '2026-09-24T10:00:00Z'
    });
    return {
      sourcePackage,
      fromVersion: S.PACK_A_FROM,
      toVersion: S.PACK_A_TO,
      removedSkillNames,
      operatorId: '1',
      operatorName: 'E2E Mock',
      skills: S.SKILL_ROWS.filter(row => row.sourcePackage === sourcePackage).map(row => ({ ...row }))
    };
  }

  /* ---- 草稿域变异（#71；provider BackofficeSkillDraftAppService 镜像）---- */

  /**
   * 晋升（撞名复查＋入池＋两处留痕）：技能库 push 自产新行（source=3、self 虚拟值、
   * 从未被加载）＋详情随建；草稿移出在途清单（终态不列活跃面）＋详情留档回填（status 2）。
   */
  function applySkillDraftPromote(draft) {
    const S = fixtures.skill;
    const row = {
      id: S.PROMOTED_SKILL_ID,
      name: draft.name,
      description: draft.description,
      source: 3,
      sourceName: '自产',
      sourcePackage: 'self',
      version: 'self',
      status: 1,
      statusName: '启用',
      operatorId: '1',
      operatorName: 'E2E Mock',
      updateAvailable: null,
      loadCount: '0',
      lastLoadedAt: null
    };
    S.SKILL_ROWS.push(row);
    S.SKILL_DETAILS[row.id] = { ...row, frontmatter: { name: row.name }, content: `e2e mock ${row.name}`, resources: {} };
    const idx = S.SKILL_DRAFT_ROWS.findIndex(r => r.id === draft.id);
    if (idx >= 0) S.SKILL_DRAFT_ROWS.splice(idx, 1);
    const detail = S.SKILL_DRAFT_DETAILS[draft.id];
    if (detail) {
      detail.status = 2;
      detail.statusName = '已晋升';
      detail.operatorId = '1';
      detail.operatorName = 'E2E Mock';
      detail.reviewedAt = '2026-09-29T10:00:00';
    }
    return { ...row };
  }

  /**
   * 拒绝（终态留档不复活）：草稿移出在途清单＋详情回填（status 3＋操作者/时刻/理由）——
   * 回执＝终态草稿详情（留痕直读）。
   */
  function applySkillDraftReject(draft, reason) {
    const S = fixtures.skill;
    const idx = S.SKILL_DRAFT_ROWS.findIndex(r => r.id === draft.id);
    if (idx >= 0) S.SKILL_DRAFT_ROWS.splice(idx, 1);
    const detail = S.SKILL_DRAFT_DETAILS[draft.id];
    if (detail) {
      detail.status = 3;
      detail.statusName = '已拒绝';
      detail.operatorId = '1';
      detail.operatorName = 'E2E Mock';
      detail.reviewedAt = '2026-09-29T10:00:00';
      detail.rejectReason = reason;
      return { ...detail };
    }
    return { ...draft, status: 3, statusName: '已拒绝', operatorId: '1', operatorName: 'E2E Mock', reviewedAt: '2026-09-29T10:00:00', rejectReason: reason };
  }

  /* ---- 智能体配置域变异（#69；provider BackofficeAgentConfigAppService 镜像）---- */

  /** 配置写归一（provider blankToNull 镜像）：null/纯空白 → null（清空回落；首尾空白去除）。 */
  function blankToNull(value) {
    return value == null || String(value).trim() === '' ? null : String(value).trim();
  }

  /** 现行值面（覆盖行 or 全回落缺省态）——留痕前态与比对基准（provider currentOf 镜像）。 */
  function agentFacets(key) {
    const row = fixtures.skill.AGENT_CONFIGS[key];
    return {
      systemPrompt: row.systemPromptOverridden ? row.systemPrompt : null,
      modelId: row.modelIdOverridden ? row.modelId : null,
      webSearchEnabled: row.webSearchEnabled,
      fetchUrlEnabled: row.fetchUrlEnabled
    };
  }

  /**
   * 配置全量写（PUT，provider update 镜像）：命令归一（空白 null、flag 缺省 true）→ 值面比对，
   * 无动＝幂等回执零写入；有动＝行 upsert＋留痕 unshift（变更前后全量值面快照＋操作者）。
   */
  function applyAgentConfigUpdate(key, command) {
    const row = fixtures.skill.AGENT_CONFIGS[key];
    const old = agentFacets(key);
    const next = {
      systemPrompt: blankToNull(command.systemPrompt),
      modelId: blankToNull(command.modelId),
      webSearchEnabled: command.webSearchEnabled ?? true,
      fetchUrlEnabled: command.fetchUrlEnabled ?? true
    };
    if (JSON.stringify(old) === JSON.stringify(next)) return;
    row.systemPrompt = next.systemPrompt ?? row.defaultSystemPrompt;
    row.systemPromptOverridden = next.systemPrompt != null;
    row.modelId = next.modelId ?? row.defaultModelId;
    row.modelIdOverridden = next.modelId != null;
    row.webSearchEnabled = next.webSearchEnabled;
    row.fetchUrlEnabled = next.fetchUrlEnabled;
    row.operatorId = '1';
    row.operatorName = 'E2E Mock';
    row.updatedAt = '2026-09-24T12:00:00Z';
    (fixtures.skill.AGENT_TRACES[key] ??= []).unshift({
      id: `7402240000000009${String(fixtures.skill.AGENT_TRACES[key].length).padStart(2, '0')}`,
      oldSystemPrompt: old.systemPrompt,
      oldModelId: old.modelId,
      oldWebSearchEnabled: old.webSearchEnabled,
      oldFetchUrlEnabled: old.fetchUrlEnabled,
      newSystemPrompt: next.systemPrompt,
      newModelId: next.modelId,
      newWebSearchEnabled: next.webSearchEnabled,
      newFetchUrlEnabled: next.fetchUrlEnabled,
      operatorId: '1',
      operatorName: 'E2E Mock',
      operatedAt: '2026-09-24T12:00:00Z'
    });
  }

  /**
   * 工具面清单读面（provider inventory 镜像）：main 槽两增强件挂载态＝main 配置 flag 派生
   * （同源不漂移——开关窄幅写口挂 main 行开关列）；骨架/harness 内建恒挂载。
   */
  function agentToolSlots() {
    const main = fixtures.skill.AGENT_CONFIGS.main;
    return fixtures.skill.AGENT_TOOL_SLOTS.map(block => ({
      ...block,
      tools: block.tools.map(tool => ({
        ...tool,
        enabled: tool.name === 'web_search' ? main.webSearchEnabled : tool.name === 'fetch_url' ? main.fetchUrlEnabled : tool.enabled
      }))
    }));
  }

  /* ---- 合同域变异（#87；provider BackofficeContract 六态推进镜像——行·详情双端就地变异，
   * 列表刷新与抽屉回读均拿到新事实；守卫族自然裁决：ORD_021 无边/ORD_024 活跃唯一/ORD_025 无报价/
   * ORD_027 双签门禁/ORD_028 签署位幂等/ORD_031 重录窗口/ORD_022 依据缺失）---- */

  const ordError = (route, status, code, message) =>
    json(route, status, { code, message, data: null, requestId: 'e2e-mock', errors: null });

  /** 合同详情体（detail 三段的 contract 段——七写回执同形：单段合同体非三段）。 */
  function contractOf(id) {
    return fixtures.contract.CONTRACT_DETAILS[id]?.contract ?? null;
  }

  /** 行·详情同步落留痕（unshift 新→旧；操作者 E2E Mock 模拟 X-User 头落痕）。 */
  function pushContractTransition(id, action, from, to, basis) {
    const d = fixtures.contract.CONTRACT_DETAILS[id];
    d.transitions.unshift({
      action,
      actionName: fixtures.contract.CONTRACT_ACTION_NAMES[action],
      fromStatus: from,
      fromStatusName: fixtures.contract.CONTRACT_STATUS_NAMES[from],
      toStatus: to,
      toStatusName: fixtures.contract.CONTRACT_STATUS_NAMES[to],
      basis,
      operatorId: '1',
      operatorName: 'E2E Mock',
      createdAt: fixtures.contract.CONTRACT_ACTION_AT
    });
  }

  /** 状态迁移共肢：行·详情同步改 status/statusName＋落推进类留痕。 */
  function applyContractTransition(id, action, to, basis) {
    const d = fixtures.contract.CONTRACT_DETAILS[id];
    const from = d.contract.status;
    d.contract.status = to;
    d.contract.statusName = fixtures.contract.CONTRACT_STATUS_NAMES[to];
    const row = fixtures.contract.CONTRACT_ROWS.find(r => r.id === id);
    if (row) {
      row.status = to;
      row.statusName = d.contract.statusName;
    }
    pushContractTransition(id, action, from, to, basis);
    return { ...d.contract };
  }

  /** advance：线性单步 1→2→3→4；末边 3→4 双签守卫（ORD_027——可观测门控的兜底竞态靶）。 */
  function applyContractAdvance(id, basis) {
    const c = contractOf(id);
    if (!c) return { error: [404, 5020, '合同不存在（ORD_020）'] };
    if (c.status < 1 || c.status > 3) return { error: [409, 5021, '合同已终态，无推进边（ORD_021）'] };
    if (c.status === 3 && !(c.partyASigned && c.partyBSigned)) {
      return { error: [409, 5027, '双方签署位未均签，不可推进至签署完成（ORD_027）'] };
    }
    return { receipt: applyContractTransition(id, 1, c.status + 1, basis) };
  }

  /** fail：旁落终态 5，仅自 2/3 可达。 */
  function applyContractFail(id, basis) {
    const c = contractOf(id);
    if (!c) return { error: [404, 5020, '合同不存在（ORD_020）'] };
    if (c.status !== 2 && c.status !== 3) return { error: [409, 5021, '当前状态不可旁落失败或过期（ORD_021）'] };
    return { receipt: applyContractTransition(id, 6, 5, basis) };
  }

  /** withdraw/void：守卫同（自任何非终态）、去向同（6），仅留痕 action 分立可审计。 */
  function applyContractSide(id, action, basis) {
    const c = contractOf(id);
    if (!c) return { error: [404, 5020, '合同不存在（ORD_020）'] };
    if (c.status < 1 || c.status > 3) return { error: [409, 5021, '合同已终态，不可再动（ORD_021）'] };
    return { receipt: applyContractTransition(id, action, 6, basis) };
  }

  /** sign：仅签署进行中可落；已落签署位幂等拒（ORD_028——自然裁决，不靠注入）。 */
  function applyContractSign(id, party, basis) {
    const c = contractOf(id);
    if (!c) return { error: [404, 5020, '合同不存在（ORD_020）'] };
    if (c.status !== 3) return { error: [409, 5021, '仅签署进行中可落签署位（ORD_021）'] };
    const signedKey = party === 1 ? 'partyASigned' : 'partyBSigned';
    const atKey = party === 1 ? 'partyASignedAt' : 'partyBSignedAt';
    if (c[signedKey]) return { error: [409, 5028, '该方签署位已落定，幂等拒绝（ORD_028）'] };
    c[signedKey] = true;
    c[atKey] = fixtures.contract.CONTRACT_ACTION_AT;
    pushContractTransition(id, 4, 3, 3, basis);
    return { receipt: { ...c } };
  }

  /**
   * record：仅草稿态（1/2）可达（ORD_031）；四预览字段整组录入＋version+1＋needsUpdate 清零＋
   * 留痕非迁移 from=to（冻结集重取现值 mock 不复算——amount/scope 原样定格）。
   */
  function applyContractRecord(id, command) {
    const c = contractOf(id);
    if (!c) return { error: [404, 5020, '合同不存在（ORD_020）'] };
    if (c.status !== 1 && c.status !== 2) return { error: [409, 5031, '签署进行中起变动走撤回/作废重建（ORD_031）'] };
    c.partyA = command.partyA ?? null;
    c.partyB = command.partyB ?? null;
    c.projectScope = command.projectScope ?? null;
    c.paymentPlan = command.paymentPlan ?? null;
    c.needsUpdate = false;
    c.version += 1;
    const row = fixtures.contract.CONTRACT_ROWS.find(r => r.id === id);
    if (row) row.version = c.version;
    pushContractTransition(id, 5, c.status, c.status, command.basis);
    return { receipt: { ...c } };
  }

  /**
   * 创建/重建：前置门自然裁决——订单不存在（ORD_001）/未报价（ORD_025）/已有活跃合同（ORD_024，
   * 预检语义＝部分唯一索引）；成功＝新号新合同 unshift 清单首＋详情随建（旧合同终态保留不动）。
   */
  function applyContractCreate(orderId) {
    const order = fixtures.order?.ORDER_DETAILS[orderId] ?? fixtures.order?.ORDER_ROWS.find(r => r.id === orderId);
    if (!order) return { error: [404, 5001, '订单不存在（ORD_001）'] };
    if (order.status === 1) return { error: [409, 5025, '尚无报价，先报价再创建合同（ORD_025）'] };
    const active = fixtures.contract.CONTRACT_ROWS.some(r => r.orderId === orderId && r.status >= 1 && r.status <= 3);
    if (active) return { error: [409, 5024, '该订单已有活跃合同（ORD_024）'] };
    const created = { ...fixtures.contract.CREATED_CONTRACT, orderId };
    if (order.amount) created.amount = order.amount;
    fixtures.contract.CONTRACT_ROWS.unshift(created);
    fixtures.contract.CONTRACT_DETAILS[created.id] = {
      // 详情全字段＝CREATED_DETAIL 预览字段集 + 新行摘要字段（amount/orderId 等以本单为准）
      contract: { ...fixtures.contract.CREATED_DETAIL.contract, ...created },
      prdSnapshot: fixtures.contract.CREATED_DETAIL.prdSnapshot,
      transitions: []
    };
    return { receipt: { ...fixtures.contract.CONTRACT_DETAILS[created.id].contract } };
  }

  await page.route('**/proxy-default/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/proxy-default', '');
    const method = route.request().method();
    calls.push({ method, path, query: url.search, body: route.request().postData() });

    // ---- 认证 ----
    if (path === '/auth/login' && method === 'POST') {
      return json(route, 200, {
        code: 200,
        message: 'ok',
        data: { token: 'e2e-mock-token', loginId: '1', expireTime: Date.now() + 86_400_000 },
        requestId: 'e2e-mock',
        errors: null
      });
    }
    if (path === '/auth/current' && method === 'GET') {
      return json(route, 200, {
        code: 200,
        message: 'ok',
        data: {
          user: { id: '1', username: 'admin', nickname: 'E2E Mock', email: null, phone: null, avatar: null },
          roleCodes: ['SUPER_ADMIN'],
          permissions: [
            { code: 'admin:aiplatform:order:read', name: 'AI 平台 / 订单查看' },
            { code: 'admin:aiplatform:order:quote', name: 'AI 平台 / 订单报价' },
            { code: 'admin:aiplatform:order:cancel', name: 'AI 平台 / 订单取消' },
            { code: 'admin:aiplatform:order:retry-archive', name: 'AI 平台 / 订单重试归档' },
            { code: 'admin:aiplatform:project:read', name: 'AI 平台 / 项目查看' },
            { code: 'admin:aiplatform:workspace:read', name: 'AI 平台 / 沙箱查看' },
            { code: 'admin:aiplatform:workspace:wake', name: 'AI 平台 / 沙箱唤醒' },
            { code: 'admin:aiplatform:workspace:hibernate', name: 'AI 平台 / 沙箱休眠' },
            { code: 'admin:aiplatform:workspace:rebuild', name: 'AI 平台 / 沙箱重建' },
            { code: 'admin:aiplatform:workspace:seal', name: 'AI 平台 / 沙箱封存' },
            { code: 'admin:aiplatform:cost:read', name: 'AI 平台 / 成本查看' },
            { code: 'admin:aiplatform:price-entry:read', name: 'AI 平台 / 单价表查看' },
            { code: 'admin:aiplatform:price-entry:reprice', name: 'AI 平台 / 单价表改价' },
            { code: 'admin:aiplatform:price-entry:deactivate', name: 'AI 平台 / 单价表停用' },
            { code: 'admin:aiplatform:material:read', name: 'AI 平台 / 素材查看' },
            { code: 'admin:aiplatform:material:disable', name: 'AI 平台 / 素材停用' },
            { code: 'admin:aiplatform:material:enable', name: 'AI 平台 / 素材启用' },
            { code: 'admin:aiplatform:material:delete', name: 'AI 平台 / 素材删除' },
            { code: 'admin:aiplatform:skill:read', name: 'AI 平台 / 技能查看' },
            { code: 'admin:aiplatform:skill:install', name: 'AI 平台 / 技能安装' },
            { code: 'admin:aiplatform:skill:disable', name: 'AI 平台 / 技能停用' },
            { code: 'admin:aiplatform:skill:enable', name: 'AI 平台 / 技能启用' },
            { code: 'admin:aiplatform:skill:uninstall', name: 'AI 平台 / 技能卸载' },
            { code: 'admin:aiplatform:skill:update', name: 'AI 平台 / 技能更新' },
            { code: 'admin:aiplatform:skill:assign', name: 'AI 平台 / 技能指派' },
            { code: 'admin:aiplatform:skill-draft:read', name: 'AI 平台 / 草稿审核查看' },
            { code: 'admin:aiplatform:skill-draft:promote', name: 'AI 平台 / 草稿晋升' },
            { code: 'admin:aiplatform:skill-draft:reject', name: 'AI 平台 / 草稿拒绝' },
            { code: 'admin:aiplatform:agent-config:update', name: 'AI 平台 / 智能体配置更新' },
            { code: 'admin:aiplatform:agent-tool:toggle', name: 'AI 平台 / 智能体工具开关' },
            { code: 'admin:aiplatform:account:read', name: 'AI 平台 / 账号档案查看' },
            { code: 'admin:aiplatform:contract:read', name: 'AI 平台 / 合同查看' },
            { code: 'admin:aiplatform:contract:create', name: 'AI 平台 / 合同创建重建' },
            { code: 'admin:aiplatform:contract:advance', name: 'AI 平台 / 合同推进' },
            { code: 'admin:aiplatform:contract:fail', name: 'AI 平台 / 合同失败或过期' },
            { code: 'admin:aiplatform:contract:withdraw', name: 'AI 平台 / 合同撤回' },
            { code: 'admin:aiplatform:contract:void', name: 'AI 平台 / 合同作废' },
            { code: 'admin:aiplatform:contract:sign', name: 'AI 平台 / 合同签署标记' },
            { code: 'admin:aiplatform:contract:record', name: 'AI 平台 / 合同草稿重录' }
          ],
          menus: []
        },
        requestId: 'e2e-mock',
        errors: null
      });
    }
    // ---- 动态菜单（镜像 V15 种子：AI 平台目录 + 订单/项目叶子） ----
    if (path === '/menus/my' && method === 'GET') {
      return json(route, 200, {
        code: 200,
        message: 'ok',
        data: {
          home: 'aiplatform_order',
          menus: [
            {
              id: '82',
              menuName: 'AI 平台',
              routeName: 'aiplatform',
              routePath: '/aiplatform',
              component: 'layout.base',
              icon: 'carbon:machine-learning-model',
              iconType: 1,
              i18nKey: 'route.aiplatform',
              parentId: null,
              sortOrder: 3,
              menuType: 1,
              status: 1,
              children: [
                {
                  id: '160',
                  menuName: '订单管理',
                  routeName: 'aiplatform_order',
                  routePath: '/aiplatform/order',
                  component: 'view.aiplatform_order',
                  icon: 'carbon:shopping-cart',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_order',
                  parentId: '82',
                  sortOrder: 1,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '161',
                  menuName: '项目管理',
                  routeName: 'aiplatform_project',
                  routePath: '/aiplatform/project',
                  component: 'view.aiplatform_project',
                  icon: 'carbon:catalog',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_project',
                  parentId: '82',
                  sortOrder: 2,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '162',
                  menuName: '沙箱管理',
                  routeName: 'aiplatform_workspace',
                  routePath: '/aiplatform/workspace',
                  component: 'view.aiplatform_workspace',
                  icon: 'carbon:virtual-machine',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_workspace',
                  parentId: '82',
                  sortOrder: 3,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '163',
                  menuName: '成本中心',
                  routeName: 'aiplatform_cost',
                  routePath: '/aiplatform/cost',
                  component: 'view.aiplatform_cost',
                  icon: 'carbon:analytics',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_cost',
                  parentId: '82',
                  sortOrder: 4,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '200',
                  menuName: '单价表',
                  routeName: 'aiplatform_price_entry',
                  routePath: '/aiplatform/price-entry',
                  component: 'view.aiplatform_price_entry',
                  icon: 'carbon:currency',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_price_entry',
                  parentId: '82',
                  sortOrder: 5,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '201',
                  menuName: '知识素材',
                  routeName: 'aiplatform_material',
                  routePath: '/aiplatform/material',
                  component: 'view.aiplatform_material',
                  icon: 'carbon:knowledge-base',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_material',
                  parentId: '82',
                  sortOrder: 6,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '220',
                  menuName: '技能管理',
                  routeName: 'aiplatform_skill',
                  routePath: '/aiplatform/skill',
                  component: 'view.aiplatform_skill',
                  icon: 'carbon:tools',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_skill',
                  parentId: '82',
                  sortOrder: 7,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '230',
                  menuName: '指派配置',
                  routeName: 'aiplatform_skill_assignment',
                  routePath: '/aiplatform/skill-assignment',
                  component: 'view.aiplatform_skill_assignment',
                  icon: 'carbon:list-checked',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_skill_assignment',
                  parentId: '82',
                  sortOrder: 8,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '240',
                  menuName: '智能体配置',
                  routeName: 'aiplatform_agent_config',
                  routePath: '/aiplatform/agent-config',
                  component: 'view.aiplatform_agent_config',
                  icon: 'carbon:prompt-session',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_agent_config',
                  parentId: '82',
                  sortOrder: 9,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '250',
                  menuName: '草稿审核',
                  routeName: 'aiplatform_skill_draft',
                  routePath: '/aiplatform/skill/draft',
                  component: 'view.aiplatform_skill_draft',
                  icon: 'carbon:task-approved',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_skill_draft',
                  parentId: '82',
                  sortOrder: 10,
                  menuType: 2,
                  status: 1
                },
                {
                  id: '260',
                  menuName: '合同管理',
                  routeName: 'aiplatform_contract',
                  routePath: '/aiplatform/contract',
                  component: 'view.aiplatform_contract',
                  icon: 'carbon:document-signed',
                  iconType: 1,
                  i18nKey: 'route.aiplatform_contract',
                  parentId: '82',
                  sortOrder: 11,
                  menuType: 2,
                  status: 1
                }
              ]
            }
          ]
        },
        requestId: 'e2e-mock',
        errors: null
      });
    }

    // ---- 订单域 ----
    if (fixtures.order && path === '/aiplatform/orders' && method === 'GET') {
      return json(route, 200, orderListResponse(url.searchParams));
    }
    if (fixtures.order) {
      const orderMatch = path.match(
        /^\/aiplatform\/orders\/([^/]+)(\/(quote|cancel|retry-archive|source-package|design-package))?$/
      );
      if (orderMatch) {
        const [, id, , action] = orderMatch;

        if (!action && method === 'GET') {
          const detail = fixtures.order.ORDER_DETAILS[id];
          if (detail) return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
          return json(route, 404, { code: 5001, message: '订单不存在（ORD_001）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'quote' && method === 'POST') {
          if (state.failNextQuote) {
            state.failNextQuote = false;
            // AiplatformUpstreamErrorAdvice 形状：HTTP 409 + 数字业务码 5007（ORD_007）+ 原文 message
            return json(route, 409, { code: 5007, message: '订单已支付或已终结，无法报价（ORD_007）', data: null, requestId: 'e2e-mock', errors: null });
          }
          return json(route, 200, fixtures.order.writeAck(id));
        }
        if (action === 'cancel' && method === 'POST') {
          return json(route, 200, fixtures.order.writeAck(id));
        }
        if (action === 'retry-archive' && method === 'POST') {
          return json(route, 200, fixtures.order.writeAck(id));
        }
        if (action === 'source-package' && method === 'GET') {
          const gzip = zlib.gzipSync(`e2e-mock-source-package-for-${id}`);
          return route.fulfill({
            status: 200,
            headers: {
              'content-type': 'application/gzip',
              'content-disposition': `attachment; filename="${id}-source.tar.gz"`
            },
            body: gzip
          });
        }
        // 设计资产包（#96 对偶源码包端点）：tar.gz 二进制流 + Content-Disposition 文件名透传
        if (action === 'design-package' && method === 'GET') {
          const gzip = zlib.gzipSync(`e2e-mock-design-package-for-${id}`);
          return route.fulfill({
            status: 200,
            headers: {
              'content-type': 'application/gzip',
              'content-disposition': `attachment; filename="${id}-design.tar.gz"`
            },
            body: gzip
          });
        }
      }
    }

    // ---- 项目域 ----
    if (fixtures.project && path === '/aiplatform/projects' && method === 'GET') {
      return json(route, 200, projectListResponse(url.searchParams));
    }
    if (fixtures.project) {
      const versionMatch = path.match(/^\/aiplatform\/projects\/([^/]+)\/versions\/([^/]+)$/);
      if (versionMatch && method === 'GET') {
        const [, id, ref] = versionMatch;
        const detail = fixtures.project.VERSION_DETAILS[`${id}:${ref}`];
        if (detail) return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
        return json(route, 404, { code: 4028, message: '版本不存在（PRJ_028）', data: null, requestId: 'e2e-mock', errors: null });
      }
      const projectMatch = path.match(
        /^\/aiplatform\/projects\/([^/]+)(\/(conversation|prd|versions|files\/content|files\/package|files))?$/
      );
      if (projectMatch) {
        const [, id, , action] = projectMatch;

        if (!action && method === 'GET') {
          const detail = fixtures.project.PROJECT_DETAILS[id];
          if (detail) return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
          return json(route, 404, { code: 4001, message: '项目不存在（PRJ_001）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'conversation' && method === 'GET') {
          const entries = fixtures.project.CONVERSATIONS[id] ?? [];
          return json(route, 200, { code: 200, message: 'ok', data: entries, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'prd' && method === 'GET') {
          const prd = fixtures.project.PRDS[id];
          if (prd) return json(route, 200, { code: 200, message: 'ok', data: prd, requestId: 'e2e-mock', errors: null });
          // PRD 未产出口径（工作区无 docs/PRD.md）——区别于项目不存在的 PRJ_001
          return json(route, 404, { code: 4015, message: 'PRD 尚未产出（PRJ_015）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'versions' && method === 'GET') {
          const versions = fixtures.project.VERSIONS[id] ?? [];
          return json(route, 200, { code: 200, message: 'ok', data: versions, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'files' && method === 'GET') {
          const tree = fixtures.project.FILE_TREES[id];
          if (tree) return json(route, 200, { code: 200, message: 'ok', data: tree, requestId: 'e2e-mock', errors: null });
          return json(route, 404, { code: 4001, message: '项目不存在（PRJ_001）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'files/content' && method === 'GET') {
          const filePath = url.searchParams.get('path') ?? '';
          const content = fixtures.project.FILE_CONTENTS[`${id}:${filePath}`];
          if (content) return json(route, 200, { code: 200, message: 'ok', data: content, requestId: 'e2e-mock', errors: null });
          const rejection = fixtures.project.FILE_REJECTIONS[`${id}:${filePath}`];
          if (rejection) {
            return json(route, rejection.status, {
              code: rejection.code,
              message: rejection.message,
              data: null,
              requestId: 'e2e-mock',
              errors: null
            });
          }
          return json(route, 404, { code: 4021, message: '文件不存在（PRJ_021）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (action === 'files/package' && method === 'GET') {
          // tar.gz 二进制流（无 ApiResponse 信封）；文件名 provider 决定（Content-Disposition 透传）
          const gzip = zlib.gzipSync(`e2e-mock-project-files-package-for-${id}`);
          return route.fulfill({
            status: 200,
            headers: {
              'content-type': 'application/gzip',
              'content-disposition': `attachment; filename="${id}-source.tar.gz"`
            },
            body: gzip
          });
        }
      }
    }

    // ---- 沙箱域（#60）----
    if (fixtures.workspace && path === '/aiplatform/workspaces' && method === 'GET') {
      return json(route, 200, workspaceListResponse(url.searchParams));
    }
    if (fixtures.workspace) {
      const writeMatch = path.match(/^\/aiplatform\/workspaces\/([^/]+)\/(wake|hibernate|rebuild|seal)$/);
      if (writeMatch && method === 'POST') {
        const [, id, action] = writeMatch;
        const base = fixtures.workspace.WORKSPACE_DETAILS[id];
        if (!base) {
          return json(route, 404, { code: 1001, message: '工作区不存在（WSP_001）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (state.failNextWorkspaceWrite) {
          state.failNextWorkspaceWrite = false;
          // run 在途拒（守卫链 WSP_015）：HTTP 409 + 数字业务码 1015 + 原文 message
          return json(route, 409, { code: 1015, message: '沙箱有正在进行的生成任务，暂不能执行该操作（WSP_015）', data: null, requestId: 'e2e-mock', errors: null });
        }
        return json(route, 200, { code: 200, message: 'ok', data: applyWorkspaceAction(base, action), requestId: 'e2e-mock', errors: null });
      }
      const detailMatch = path.match(/^\/aiplatform\/workspaces\/([^/]+)$/);
      if (detailMatch && method === 'GET') {
        const detail = fixtures.workspace.WORKSPACE_DETAILS[detailMatch[1]];
        if (detail) return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
        return json(route, 404, { code: 1001, message: '工作区不存在（WSP_001）', data: null, requestId: 'e2e-mock', errors: null });
      }
    }

    // ---- 成本域（#61；四读口 from/to 必填——缺参镜像 BFF 400 框架信封）----
    if (fixtures.cost && path.startsWith('/aiplatform/costs')) {
      const query = url.searchParams;
      const from = query.get('from');
      const to = query.get('to');
      const ok = body => json(route, 200, { code: 200, message: 'ok', data: body, requestId: 'e2e-mock', errors: null });
      if (!from || !to) {
        return json(route, 400, { code: 400, message: 'Required parameter missing', data: null, requestId: 'e2e-mock', errors: null });
      }

      if (path === '/aiplatform/costs/overview' && method === 'GET') {
        return ok({ ...fixtures.cost.OVERVIEW, from, to });
      }
      if (path === '/aiplatform/costs/unpriced' && method === 'GET') {
        // 用量驱动：未配价事件落在 UNPRICED_EVENT_AT，窗口含该时点才出警示（窄窗避开即收起）
        const covers = from <= fixtures.cost.UNPRICED_EVENT_AT && to > fixtures.cost.UNPRICED_EVENT_AT;
        return ok({ from, to, items: covers ? fixtures.cost.UNPRICED_ROWS : [] });
      }
      if (path === '/aiplatform/costs/projects' && method === 'GET') {
        return json(route, 200, paginate(fixtures.cost.PROJECT_COST_ROWS, query));
      }
      const costDetailMatch = path.match(/^\/aiplatform\/costs\/projects\/([^/]+)$/);
      if (costDetailMatch && method === 'GET') {
        const detail = fixtures.cost.PROJECT_COST_DETAILS[costDetailMatch[1]];
        // 查无此号 = 全零 total + 空结构（明确空态非 404——provider 契约）
        return ok(detail ?? fixtures.cost.ZERO_DETAIL(costDetailMatch[1]));
      }
    }

    // ---- 单价表域（#62）----
    if (fixtures.priceEntry && path === '/aiplatform/price-entries' && method === 'GET') {
      return json(route, 200, priceEntryListResponse(url.searchParams));
    }
    if (fixtures.priceEntry) {
      const meter404 = () =>
        json(route, 404, { code: 3006, message: '单价行不存在（METER_006）', data: null, requestId: 'e2e-mock', errors: null });
      const repriceMatch = path.match(/^\/aiplatform\/price-entries\/([^/]+)\/reprice$/);
      if (repriceMatch && method === 'POST') {
        const row = fixtures.priceEntry.PRICE_ENTRY_ROWS.find(r => r.id === repriceMatch[1]);
        if (!row) return meter404();
        if (state.failNextReprice) {
          state.failNextReprice = false;
          // 区间重叠（同键既有行交叠）：HTTP 409 + 数字业务码 3008（MET 域）+ 原文 message
          return json(route, 409, { code: 3008, message: '目标区间与既有单价行重叠（METER_008）', data: null, requestId: 'e2e-mock', errors: null });
        }
        const command = JSON.parse(route.request().postData() ?? '{}');
        return json(route, 200, { code: 200, message: 'ok', data: applyReprice(row, command), requestId: 'e2e-mock', errors: null });
      }
      const deactivateMatch = path.match(/^\/aiplatform\/price-entries\/([^/]+)\/deactivate$/);
      if (deactivateMatch && method === 'POST') {
        const row = fixtures.priceEntry.PRICE_ENTRY_ROWS.find(r => r.id === deactivateMatch[1]);
        if (!row) return meter404();
        return json(route, 200, { code: 200, message: 'ok', data: applyDeactivate(row), requestId: 'e2e-mock', errors: null });
      }
    }

    // ---- 素材域（#63）----
    if (fixtures.material && path === '/aiplatform/materials' && method === 'GET') {
      return json(route, 200, materialListResponse(url.searchParams));
    }
    if (fixtures.material) {
      const knw404 = () =>
        json(route, 404, { code: 2005, message: '素材不存在（KNW_005）', data: null, requestId: 'e2e-mock', errors: null });
      const writeMatch = path.match(/^\/aiplatform\/materials\/([^/]+)\/(disable|enable)$/);
      if (writeMatch && method === 'POST') {
        const [, id, action] = writeMatch;
        const row = fixtures.material.MATERIAL_ROWS.find(r => r.id === id);
        if (!row) return knw404();
        if (state.failNextMaterialWrite) {
          state.failNextMaterialWrite = false;
          // 治理动作缺留痕头口径（KNW_006）：HTTP 400 + 数字业务码 2006 + 原文 message
          return json(route, 400, { code: 2006, message: '知识治理动作必须留痕（KNW_006）', data: null, requestId: 'e2e-mock', errors: null });
        }
        return json(route, 200, { code: 200, message: 'ok', data: applyMaterialToggle(row, action === 'enable'), requestId: 'e2e-mock', errors: null });
      }
      const deleteMatch = path.match(/^\/aiplatform\/materials\/([^/]+)$/);
      if (deleteMatch && method === 'DELETE') {
        const row = fixtures.material.MATERIAL_ROWS.find(r => r.id === deleteMatch[1]);
        if (!row) return knw404();
        if (state.failNextMaterialWrite) {
          state.failNextMaterialWrite = false;
          return knw404();
        }
        return json(route, 200, { code: 200, message: 'ok', data: applyMaterialDelete(row), requestId: 'e2e-mock', errors: null });
      }
      if (deleteMatch && method === 'GET') {
        const detail = fixtures.material.MATERIAL_DETAILS[deleteMatch[1]];
        if (detail) return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
        return knw404();
      }
    }

    // ---- 合同域（#87；六态人工承接——清单四维检索/详情三段/创建重建/六写口。
    // 守卫族自然裁决（ORD_020/021/022/024/025/027/028/031）＋failNextContractWrite 竞态注入；
    // 行·详情双端就地变异——列表刷新与抽屉回读均拿到新事实）----
    if (fixtures.contract) {
      const ord = (status, code, message) => ordError(route, status, code, message);
      const query = url.searchParams;
      if (path === '/aiplatform/contracts' && method === 'GET') {
        let rows = [...fixtures.contract.CONTRACT_ROWS];
        const status = query.get('status');
        if (status) {
          const codes = status.split(',').map(Number);
          rows = rows.filter(row => codes.includes(row.status));
        }
        const orderId = query.get('orderId');
        if (orderId) rows = rows.filter(row => row.orderId === orderId);
        const contractNo = query.get('contractNo');
        if (contractNo) rows = rows.filter(row => row.contractNo === contractNo);
        rows = filterByCreatedRange(rows, query);
        return json(route, 200, paginate(rows, query));
      }
      // 创建/重建（无请求体；先于 /{id} 与 /{id}/{action} 匹配——路径两段不互叠，稳妥起见置前）
      const contractCreateMatch = path.match(/^\/aiplatform\/contracts\/orders\/([^/]+)$/);
      if (contractCreateMatch && method === 'POST') {
        const result = applyContractCreate(contractCreateMatch[1]);
        if (result.error) return ord(...result.error);
        return json(route, 200, { code: 200, message: 'ok', data: result.receipt, requestId: 'e2e-mock', errors: null });
      }
      const contractMatch = path.match(/^\/aiplatform\/contracts\/([^/]+)(\/(advance|fail|withdraw|void|sign|record))?$/);
      if (contractMatch) {
        const [, id, , action] = contractMatch;
        const detail = fixtures.contract.CONTRACT_DETAILS[id];
        if (!detail) return ord(404, 5020, '合同不存在（ORD_020）');
        if (!action && method === 'GET') {
          return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
        }
        if (action && method === 'POST') {
          const command = JSON.parse(route.request().postData() ?? '{}');
          // 依据必填（ORD_022——前端必填先行拦截，此为 wire 诚实兜底）
          if (!command.basis || String(command.basis).trim() === '') {
            return ord(400, 5022, '操作依据不能为空白（ORD_022）');
          }
          // 竞态注入：双签门禁 ORD_027 兜底透传靶（按钮可观测门控之外的服务端裁决）
          if (state.failNextContractWrite) {
            state.failNextContractWrite = false;
            return ord(409, 5027, '双方签署位未均签，不可推进至签署完成（ORD_027）');
          }
          const basis = String(command.basis).trim();
          let result;
          if (action === 'advance') result = applyContractAdvance(id, basis);
          else if (action === 'fail') result = applyContractFail(id, basis);
          else if (action === 'withdraw') result = applyContractSide(id, 2, basis);
          else if (action === 'void') result = applyContractSide(id, 3, basis);
          else if (action === 'sign') {
            if (command.party !== 1 && command.party !== 2) {
              return ord(400, 400, 'party 取值非法（1=甲方 2=乙方）');
            }
            result = applyContractSign(id, command.party, basis);
          } else {
            result = applyContractRecord(id, command);
          }
          if (result.error) return ord(...result.error);
          return json(route, 200, { code: 200, message: 'ok', data: result.receipt, requestId: 'e2e-mock', errors: null });
        }
      }
    }

    // ---- 技能域（#67；清单无分页全量直出、id＝opaque 串两形制路径段）----
    if (fixtures.skill) {
      const skl404 = () =>
        json(route, 404, { code: 7001, message: '技能不存在（SKL_001）', data: null, requestId: 'e2e-mock', errors: null });
      // ---- 指派预检（#72；POST body 与 PUT 指派同形 {skillIds[]}＝点击时快照，回执
      // {executed, hints[]}——executed=false＝未执行降级态（hints 恒空）。三态样本由
      // SKILL_PRECHECK.mode 切换、delayMs 模拟模型判定延迟（loading 态靶）；失败注入
      // 400 SKL_011（错误族与 PUT 指派同源同码——透传 toast 断言靶）。只读不变异指派态 ----
      const precheckMatch = path.match(/^\/aiplatform\/skills\/assignments\/([^/]+)\/precheck$/);
      if (precheckMatch && method === 'POST') {
        const slot = precheckMatch[1];
        if (!fixtures.skill.ASSIGN_SLOTS.includes(slot)) {
          return json(route, 404, { code: 7010, message: '未知职能槽位（SKL_010）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (state.failNextSkillPrecheck) {
          state.failNextSkillPrecheck = false;
          return json(route, 400, { code: 7011, message: '内置技能不可指派，装配按配置挂载（SKL_011）', data: null, requestId: 'e2e-mock', errors: null });
        }
        const P = fixtures.skill.SKILL_PRECHECK;
        if (P.delayMs > 0) await sleep(P.delayMs);
        const data =
          P.mode === 'notExecuted'
            ? { executed: false, hints: [] }
            : P.mode === 'clean'
              ? { executed: true, hints: [] }
              : { executed: true, hints: fixtures.skill.PRECHECK_HINTS.map(hint => ({ ...hint })) };
        return json(route, 200, { code: 200, message: 'ok', data, requestId: 'e2e-mock', errors: null });
      }
      // ---- 指派域（#68；每槽位一个 GET/PUT——先于 /skills/{id} 匹配。GET/PUT 回执同形
      // {slot, skills[]}；PUT 整包替换 skillIds 就地变异（回读如实）、停用行照常随行返回）----
      const assignmentMatch = path.match(/^\/aiplatform\/skills\/assignments\/([^/]+)$/);
      if (assignmentMatch) {
        const slot = assignmentMatch[1];
        if (!fixtures.skill.ASSIGN_SLOTS.includes(slot)) {
          return json(route, 404, { code: 7010, message: '未知职能槽位（SKL_010）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (method === 'PUT') {
          if (state.failNextSkillAssign) {
            state.failNextSkillAssign = false;
            // 内置柄不可指派（SKL_011）：HTTP 400 + 数字业务码 7011 + 原文 message（失败注入代表样——
            // 页面选项集已排除 builtin，此分支模拟 provider 侧裁决的透传 toast 断言）
            return json(route, 400, { code: 7011, message: '内置技能不可指派，装配按配置挂载（SKL_011）', data: null, requestId: 'e2e-mock', errors: null });
          }
          const command = JSON.parse(route.request().postData() ?? '{}');
          fixtures.skill.SKILL_ASSIGNMENTS[slot] = command.skillIds ?? [];
        }
        const skills = fixtures.skill.SKILL_ASSIGNMENTS[slot]
          .map(id => fixtures.skill.SKILL_ROWS.find(row => row.id === id))
          .filter(Boolean)
          .map(row => ({ ...row }));
        return json(route, 200, { code: 200, message: 'ok', data: { slot, skills }, requestId: 'e2e-mock', errors: null });
      }
      // ---- 草稿域（#71；drafts 4 端点——在途清单不分页自荐倒序、终态不列活跃面。
      // promote 无 body（操作者头）回执＝技能库自产新行；reject body {reason} 回执＝终态
      // 详情留痕直读。失败注入：promote 409 SKL_016 撞名 / reject 400 SKL_018 空白——
      // 页面错误不判码（透传 toast＋无条件刷新）的断言靶）----
      if (path === '/aiplatform/skills/drafts' && method === 'GET') {
        return json(route, 200, { code: 200, message: 'ok', data: fixtures.skill.SKILL_DRAFT_ROWS.map(row => ({ ...row })), requestId: 'e2e-mock', errors: null });
      }
      const sklDraftMatch = path.match(/^\/aiplatform\/skills\/drafts\/([^/]+)(\/(promote|reject))?$/);
      if (sklDraftMatch) {
        const draft = fixtures.skill.SKILL_DRAFT_DETAILS[sklDraftMatch[1]];
        if (!draft) {
          return json(route, 404, { code: 7015, message: '技能草稿不存在（SKL_015）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (sklDraftMatch[3] === 'promote' && method === 'POST') {
          if (state.failNextSkillDraftPromote) {
            state.failNextSkillDraftPromote = false;
            // 审核期间同名入库（SKL_016）：HTTP 409 + 数字业务码 7016 + 原文 message（失败注入代表样）
            return json(route, 409, { code: 7016, message: '技能库已有同名技能，晋升被拒（SKL_016）', data: null, requestId: 'e2e-mock', errors: null });
          }
          return json(route, 200, { code: 200, message: 'ok', data: applySkillDraftPromote(draft), requestId: 'e2e-mock', errors: null });
        }
        if (sklDraftMatch[3] === 'reject' && method === 'POST') {
          const command = JSON.parse(route.request().postData() ?? '{}');
          if (!command.reason || String(command.reason).trim() === '') {
            // 空白理由（SKL_018）：HTTP 400 + 数字业务码 7018（前端必填已拦——服务端兜底透传）
            return json(route, 400, { code: 7018, message: '拒绝理由不能为空白（SKL_018）', data: null, requestId: 'e2e-mock', errors: null });
          }
          if (state.failNextSkillDraftReject) {
            state.failNextSkillDraftReject = false;
            // 失败注入代表样（400 SKL_018）——透传 toast＋留表单态断言锚
            return json(route, 400, { code: 7018, message: '拒绝理由不能为空白（SKL_018）', data: null, requestId: 'e2e-mock', errors: null });
          }
          return json(route, 200, { code: 200, message: 'ok', data: applySkillDraftReject(draft, String(command.reason).trim()), requestId: 'e2e-mock', errors: null });
        }
        if (!sklDraftMatch[3] && method === 'GET') {
          return json(route, 200, { code: 200, message: 'ok', data: { ...draft }, requestId: 'e2e-mock', errors: null });
        }
      }
      // ---- 智能体配置域（#69；agent-configs 3 + agent-tools 2。GET/PUT 回执同形读面；
      // 工具开关窄幅写口挂 main 行开关列——与配置全量写共表共留痕）----
      const agentConfigMatch = path.match(/^\/aiplatform\/agent-configs\/([^/]+)(\/traces)?$/);
      if (agentConfigMatch) {
        const key = agentConfigMatch[1];
        if (!fixtures.skill.AGENT_KEYS.includes(key)) {
          // 未知键（PRJ_033＝4033）：前端两键固定不可达——防御语义
          return json(route, 404, { code: 4033, message: '智能体不存在（PRJ_033）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (agentConfigMatch[2] === '/traces' && method === 'GET') {
          const traces = fixtures.skill.AGENT_TRACES[key] ?? [];
          return json(route, 200, { code: 200, message: 'ok', data: traces.map(t => ({ ...t })), requestId: 'e2e-mock', errors: null });
        }
        if (method === 'PUT') {
          if (state.failNextAgentConfigUpdate) {
            state.failNextAgentConfigUpdate = false;
            // 操作者缺留痕头（PRJ_034）：HTTP 400 + 数字业务码 4034 + 原文 message（失败注入代表样）
            return json(route, 400, { code: 4034, message: '操作者不能为空（PRJ_034）', data: null, requestId: 'e2e-mock', errors: null });
          }
          applyAgentConfigUpdate(key, JSON.parse(route.request().postData() ?? '{}'));
        }
        return json(route, 200, { code: 200, message: 'ok', data: { ...fixtures.skill.AGENT_CONFIGS[key] }, requestId: 'e2e-mock', errors: null });
      }
      if (path === '/aiplatform/agent-tools' && method === 'GET') {
        return json(route, 200, { code: 200, message: 'ok', data: agentToolSlots(), requestId: 'e2e-mock', errors: null });
      }
      const agentToolMatch = path.match(/^\/aiplatform\/agent-tools\/([^/]+)$/);
      if (agentToolMatch && method === 'PUT') {
        const toolName = agentToolMatch[1];
        const known = fixtures.skill.AGENT_TOOL_SLOTS.flatMap(block => block.tools).find(tool => tool.name === toolName);
        if (!known) {
          // 平台工具与 harness 内建面之外（PRJ_035＝4035）——前端按清单寻址不可达，防御语义
          return json(route, 404, { code: 4035, message: '工具不存在（PRJ_035）', data: null, requestId: 'e2e-mock', errors: null });
        }
        const command = JSON.parse(route.request().postData() ?? '{}');
        if (known.kind !== 'ENHANCEMENT') {
          // 骨架/harness 内建结构性锁死（PRJ_036＝4036）——前端对非增强行 disabled 恒开，不可达透传
          return json(route, 403, { code: 4036, message: '该工具不开放开关（PRJ_036）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (command.enabled == null) {
          // 目标态缺省无语义（PRJ_037＝4037）——前端必传，不可达透传
          return json(route, 400, { code: 4037, message: '开关目标态必填（PRJ_037）', data: null, requestId: 'e2e-mock', errors: null });
        }
        if (state.failNextAgentToolToggle) {
          state.failNextAgentToolToggle = false;
          // 失败注入代表样（403 PRJ_036）——透传 toast＋受控开关视觉态回滚断言锚
          return json(route, 403, { code: 4036, message: '该工具不开放开关（PRJ_036）', data: null, requestId: 'e2e-mock', errors: null });
        }
        // 窄幅写口挂 main 行开关列（provider toggleTool 镜像）：只动目标开关列、其余值面原样携带
        applyAgentConfigUpdate('main', {
          ...agentFacets('main'),
          [toolName === 'web_search' ? 'webSearchEnabled' : 'fetchUrlEnabled']: command.enabled
        });
        return json(route, 200, { code: 200, message: 'ok', data: { ...known, enabled: command.enabled }, requestId: 'e2e-mock', errors: null });
      }
      if (path === '/aiplatform/skills' && method === 'GET') {
        return json(route, 200, { code: 200, message: 'ok', data: fixtures.skill.SKILL_ROWS.map(row => ({ ...row })), requestId: 'e2e-mock', errors: null });
      }
      if (path === '/aiplatform/skills/install' && method === 'POST') {
        if (state.failNextSkillInstall) {
          state.failNextSkillInstall = false;
          // 克隆失败/超时（安装失败族 SKL_004）：HTTP 502 + 数字业务码 7004 + 原文 message
          return json(route, 502, { code: 7004, message: '技能仓库克隆失败或超时（SKL_004）', data: null, requestId: 'e2e-mock', errors: null });
        }
        const command = JSON.parse(route.request().postData() ?? '{}');
        return json(route, 200, { code: 200, message: 'ok', data: applySkillInstall(command), requestId: 'e2e-mock', errors: null });
      }
      if (path === '/aiplatform/skills/update' && method === 'POST') {
        if (state.failNextSkillUpdate) {
          state.failNextSkillUpdate = false;
          // 远端已删且有指派在身（SKL_013）：HTTP 409 + 数字业务码 7013 + 原文 message（整体拒绝）
          return json(route, 409, { code: 7013, message: '远端已删除且被指派的技能无法移除，更新被整体拒绝（SKL_013）', data: null, requestId: 'e2e-mock', errors: null });
        }
        const command = JSON.parse(route.request().postData() ?? '{}');
        return json(route, 200, { code: 200, message: 'ok', data: applySkillUpdate(command.sourcePackage ?? ''), requestId: 'e2e-mock', errors: null });
      }
      if (path === '/aiplatform/skills/update-traces' && method === 'GET') {
        const sourcePackage = url.searchParams.get('sourcePackage') ?? '';
        const traces = fixtures.skill.UPDATE_TRACES[sourcePackage] ?? [];
        return json(route, 200, { code: 200, message: 'ok', data: traces.map(trace => ({ ...trace })), requestId: 'e2e-mock', errors: null });
      }
      const sklToggleMatch = path.match(/^\/aiplatform\/skills\/([^/]+)\/(disable|enable)$/);
      if (sklToggleMatch && method === 'POST') {
        const row = fixtures.skill.SKILL_ROWS.find(r => r.id === sklToggleMatch[1]);
        if (!row) return skl404();
        if (state.failNextSkillWrite) {
          state.failNextSkillWrite = false;
          // 写操作缺留痕头（SKL_009）：HTTP 400 + 数字业务码 7009 + 原文 message
          return json(route, 400, { code: 7009, message: '技能库写操作必须留痕（SKL_009）', data: null, requestId: 'e2e-mock', errors: null });
        }
        return json(route, 200, { code: 200, message: 'ok', data: applySkillToggle(row, sklToggleMatch[2] === 'enable'), requestId: 'e2e-mock', errors: null });
      }
      const sklIdMatch = path.match(/^\/aiplatform\/skills\/([^/]+)$/);
      if (sklIdMatch && method === 'DELETE') {
        const row = fixtures.skill.SKILL_ROWS.find(r => r.id === sklIdMatch[1]);
        if (!row) return skl404();
        if (state.failNextSkillUninstall) {
          state.failNextSkillUninstall = false;
          // 有指派在身（SKL_008）：HTTP 409 + 数字业务码 7008 + 原文 message（先解绑再卸）
          return json(route, 409, { code: 7008, message: '技能有指派在身，先解绑再卸载（SKL_008）', data: null, requestId: 'e2e-mock', errors: null });
        }
        return json(route, 200, { code: 200, message: 'ok', data: applySkillUninstall(row), requestId: 'e2e-mock', errors: null });
      }
      if (sklIdMatch && method === 'GET') {
        const detail = fixtures.skill.SKILL_DETAILS[sklIdMatch[1]];
        if (detail) return json(route, 200, { code: 200, message: 'ok', data: detail, requestId: 'e2e-mock', errors: null });
        return skl404();
      }
    }

    // ---- 账号域（#56 收口：有码无页——嵌件端点，恒挂载不按域 fixtures 门控）----
    const accountMatch = path.match(/^\/aiplatform\/accounts\/([^/]+)$/);
    if (accountMatch && method === 'GET') {
      const profile = ACCOUNT_PROFILES[accountMatch[1]];
      if (!profile) {
        return json(route, 404, { code: 6004, message: '账号不存在（IDN_004）', data: null, requestId: 'e2e-mock', errors: null });
      }
      return json(route, 200, { code: 200, message: 'ok', data: profile, requestId: 'e2e-mock', errors: null });
    }

    // 其余接口（本票范围外）benign 空成功，避免守卫/其他模块炸掉
    return json(route, 200, { code: 200, message: 'ok', data: null, requestId: 'e2e-mock', errors: null });
  });

  return { calls, state };
}
