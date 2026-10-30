# semgravio-admin-web（语义引力）

前端项目，基于 Soybean Admin v2.2（Vue3 + Vite + NaiveUI）。品牌：英文 `Semgravio` / 中文「语义引力」——全仓不得出现旧品牌名（2026-10-30 已整体改名）。

## 技术栈

- Soybean Admin v2.2：Vue 3 / Vite 8 / TypeScript（strict）/ Naive UI / Pinia / UnoCSS
- 路由：`@elegant-router/vue`（文件式路由；支持 `static` / `dynamic` 两种鉴权路由模式，由 `VITE_AUTH_ROUTE_MODE` 控制）
- 请求：`@sa/axios`（封装的 axios，flat request 返回 `{ data, error }`）
- 包管理：pnpm（workspace monorepo，`packages/*` 为 `@sa/*` 内部包）
- 路径别名：`@/*` → `./src/*`

## 常用命令

- 开发：`pnpm dev`（端口 3001，与后端 CORS 放行一致；mode `test`）
- 构建：`pnpm build`（prod）
- 代码检查：`pnpm lint`（`oxlint --fix && eslint --fix`）
- 类型检查：`pnpm typecheck`（`vue-tsc`）
- 路由生成：`pnpm gen-route`（新增 `src/views/**` 页面后跑）

## 编码规范

- 组件：Vue 3 `<script setup lang="ts">` + 组合式 API
- 状态管理：Pinia store，放 `src/store/modules/`
- 样式：UnoCSS 原子类；图标走 iconify（`<SvgIcon icon="..."/>`）
- 请求：统一经 `src/service/request`（`@sa/axios` 封装），业务 API 放 `src/service/api/`——**不直接 fetch**。dev 经 Vite 反代（`/proxy-default` → `VITE_SERVICE_BASE_URL`）打后端。
- 后端契约：`ApiResponse{code,message,data,requestId,errors}`，`code` = HTTP 状态码本身（200=成功）；**业务错以 HTTP 非 2xx 返回**，走 axios error 拦截器 `onError`（见 [docs/adr/0001](docs/adr/0001-error-handling-in-onerror.md)——`onBackendFail` 对本后端是死代码）。
- Long / 雪花 id 后端序列化为**字符串**，前端按 `string` 处理防精度丢失。

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues in this repo (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.


## 平台架构上下文
本应用（admin-web）是统一后台前端（应用层），内部门户 SPA。完整架构与决策在兄弟仓库 ../semgravio-architecture/（起步包 docs/starters/admin-web.md）。

稳定不变式（务必遵守）：
- 前端不直接调各能力域——经 admin 后端 BFF 聚合（前端只调 admin 后端）。
- 权限控制用登录已拉取的 `permissions`/`roleCodes`（Soybean：`useAuth().hasAuth(code)` + `v-if`），别在 UI 硬编码角色判断。
- 鉴权链路：`/auth/login` 取 token（`localStg` 存）→ `/auth/current` 取 `{user,roleCodes,permissions,menus}` → 映射进 auth store；路由守卫在 `router.beforeEach`（`src/router/guard/route.ts`）读 token 判登录。
- 新页（部门/岗位/财务视图）跟 admin 后端新增同步。

当前进度（Soybean 重写后）：T1 登录闭环已打通（#12 / commit `73f1643`）；T2 用户管理页已打通（tracer bullet——搬 example 外壳 + 自写 CRUD + 改 defaultTransform，建立整套 CRUD 适配范式，详见 GLOSSARY.md「T2 用户管理页」）；T3 角色管理页已打通（含分配菜单/权限，REQ-7 已修）。**动态菜单 T2 已翻 `VITE_AUTH_ROUTE_MODE=dynamic`**（#22——sidebar 导航由 `GET /menus/my` 驱动，static 代码全保留、翻回 env 即回退；非超管矩阵 + 菜单页 toast = #23）。Dashboard 仍 mock、菜单/部门/岗位/财务未做。

深度（平台自带应用定位）：读架构仓库 architecture.md §5.3、CONTEXT.md，以及 admin 后端起步包 docs/starters/admin.md（契约 + 必修 bug）。
本项目自己的设计演进 → 本项目的 GLOSSARY.md + docs/adr/。
