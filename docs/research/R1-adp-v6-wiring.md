> ⚠️ **SUPERSEDED（2026-07-31）**：此为已**放弃**的 Ant Design Pro v6 迁移可行性调研。中途改用 **Soybean Admin v2.2**（脚手架见 #9、T1 登录闭环见 #12）。本文仅作历史留存，**不代表当前技术栈**（文中 Next.js / antd-pro / Zustand / middleware 等均作废）。当前栈见 `CLAUDE.md` / `GLOSSARY.md`。

# R1 — ant-design-pro v6 → Sa-Token 后端：对接可行性报告

> research ticket: https://github.com/ZhangColin/semgravio-admin-web/issues/7
> 产出时间：2026-07-30。版本基准（已核对 master package.json）：ant-design-pro **v6.0.0** / `@umijs/max ^4.6.25` (Umi 4) / `@ant-design/pro-components 3.1.2-0` / `antd ^6.2.2` / `react ^19.2.4` / Tailwind v4 / React Query / Biome（不再是 ESLint）。

## ⚠️ 最重要的前置发现

研究目标是"ant-design-pro v6 内置的 auth/permission/menu/request 机制"，但 **v6 的这些内置机制几乎全部是 Umi Max 的运行时插件**（`getInitialState`、access plugin、request plugin、layout runtime config、`patchClientRoutes`），**它们只有在用 @umijs/max 脚手架时才存在**。

而**本项目是 Next.js 15（App Router）**（见 CLAUDE.md 与 GLOSSARY.md 不变式 #3）。这导致两条互斥路径：

- **路径 A（迁移到 Umi Max / ant-design-pro v6 脚手架）**：换技术栈，得到全部"内置机制"。代价 = 重写路由/反代/守卫（现 middleware.ts 体系作废），Umi 4 是 webpack 非原生 RSC。已写完的 RBAC 核心（T1–T4）基本重做。
- **路径 B（留在 Next.js，只用 `@ant-design/pro-components` 作为纯组件库）**：`<ProLayout>`、`<ProTable>`、`LoginForm` 等组件**框架无关**，可在 Next.js 里直接用；但 `getInitialState`/access/request/menu.request 这些"机制"**拿不到**——必须用本项目已有的 Zustand store + middleware + http-client 自己实现等价逻辑（实际上已经实现，见不变式 #3）。

**结论**：ant-design-pro v6 的 UI 组件框架无关、可直接用；但"开箱即用"的 auth/access/request/menu 机制是 @umijs/max 专有，Next.js 项目用不上——对应能力其实已用 store + middleware + http-client 自实现。

---

## 1. AUTH / LOGIN

**(a) v6 怎么工作**
- 登录页 `src/pages/user/login/index.tsx`，用 `LoginForm`；提交走 `onFinish` → `login()` service → 默认 mock `POST /api/login/account`。文档 https://procomponents.ant.design/components/login-form
- **默认模板里根本没有 `setToken`/localStorage token 逻辑**——`src/app.tsx`、`access.ts`、`requestErrorConfig.ts` 通读无任何 token 存取。官方 demo 假定后端下 **httpOnly cookie**，前端只靠 `initialState.currentUser` 是否存在判断登录与否。
- 鉴权态 = `getInitialState()` 返回的 `currentUser` 是否存在；`fetchUserInfo` 用 `{ skipErrorHandler: true }` 拉 `/api/currentUser`，失败 `history.replace('/user/login?redirect=...')`。
- 请求拦截器在 `src/requestErrorConfig.ts`，**模板原作者已留好注释示例**（取消注释即可）。
- 登出在 `src/components/RightContent/AvatarDropdown.tsx`：乐观清 currentUser → 调 `outLogin()` → 跳登录页（模板没清任何 token，因为它没有）。

**(b) 对接 /auth/login + Bearer UUID**
- 必须自己加 token 存储（模板没有）：`src/utils/auth.ts` 提供 `getToken/setToken/removeToken`（localStorage，与现有 cookie 镜像方案一致）。
- 登录页：`login()` 改打到 `/auth/login`，body `{username, password, rememberMe}`；成功判定从 `msg.status === 'ok'` 改成 **`res.code === 200`**，然后 `setToken(res.data.token)` → `await fetchUserInfo()` → 跳转。
- 拦截器：`Authorization: Bearer ${getToken()}`。
- `fetchUserInfo` 早返回：`if (!getToken()) return undefined;` 避免每次刷新都 401。
- 登出：追加 `removeToken()` + 真 `POST /auth/logout` + 清 cookie。

**(c) 风险/Gap**
- 🚩 模板默认无 token 层，是相对 Sa-Token（无 cookie、UUID bearer）**最大的差**——必须补 ~30 行自定义代码，不是"改配置"。
- 🚩 Next.js 路径：`getInitialState`/`history`/`useModel('@@initialState')` 都是 Umi 专有；Next.js 下用现成 `admin-auth-store` + `middleware.ts` cookie 守卫替代，`LoginForm` 组件本身可直接复用。
- 登录页 mock 要么删要么关掉，否则开发态遮蔽真接口。
- localStorage bearer 有 XSS 暴露面（官方 demo 用 httpOnly cookie 正是因此；已决策接受）。

## 2. CURRENT USER

**(a) v6 怎么工作**
- `src/app.tsx` 的 `getInitialState()` 渲染前跑一次，调 `queryCurrentUser({ skipErrorHandler: true })` → 存进 `@@initialState`。
- 默认 `API.CurrentUser` 形状：`{ name?, avatar?, userid?(string), email?, phone?, access?(string) }`——**`userid` 已是 `string?`**，跟 Long-字符串 id 兼容。
- ProLayout 右上角头像/水印读 `currentUser.avatar`/`.name`；`!currentUser` 时渲染 `<Spin>`。
- 401 防死循环：传 `skipErrorHandler: true` + 登录路由白名单不触发拉取。

**(b) 对接 /auth/current**
- service 指向 `/auth/current`；解 `ApiResponse.data` 得 `CurrentUserResponse`，**拍平** + 带 RBAC 三件套：`userid: d.user.id`（string，勿 Number()）、`name: d.user.nickname ?? d.user.username`、`avatar`、`email`、`phone`、`status`，并保留 `roleCodes/permissions/menus`。

**(c) 风险/Gap**
- 🚩 **双解包陷阱**：默认模板 `msg.data` 已取一次 `data`；若又开全局响应拦截器解 `.data`（见 §5），`msg.data` 指向错层 → currentUser 全 undefined。两处只可选一。
- `AvatarDropdown` 只看 currentUser 是否存在——只塞 `{user}` 不填顶层 `avatar/name` 会永远转圈。
- `access: string`（单角色标记）粒度不够；真正角色/权限用已实现的 `useCan`/`<HasPermission>`。
- 🚩 Next.js 路径：`useModel('@@initialState')` 没了，用 Zustand `admin-auth-store.currentUser` 替代。

## 3. PERMISSION / ACCESS 模型

**(a) v6 怎么工作**
- 权限就是 **Umi Max 的 access 插件**。`src/access.ts` 默认导出纯函数，吃 `initialState`，返回权限对象（默认仅 `{ canAdmin: currentUser?.access === 'admin' }`）。
- 路由配置写 `access: 'canAdmin'` → 不通过时渲染 layout 内置 403 页。
- 按钮级：`useAccess()` hook + `<Access accessible={bool} fallback={...}>`。文档 https://umijs.org/docs/max/access
- **关键耦合**：路由 `access` 字段**同时守路由（403）和隐菜单**——无权限路由不出现在菜单里。没有原生"只隐菜单不守路由"或反之。

**(b) 对接 permissions[] + SUPER_ADMIN**
- `access.ts` 纯函数，SUPER_ADMIN bypass 自然：`isSuper = roleCodes?.includes('SUPER_ADMIN')`；`can = (code) => isSuper || perms.has(code)`；每个用到的权限码各起一个 key。
- 路由加 `access: 'admin:user:read'` 等；按钮用 `useAccess()`/`<Access>`。

**(c) 风险/Gap**
- 🚩 v6 **没有** `<HasPermission code="...">` 这种基于 code 的指令组件——`<Access>` 吃 bool 不吃 code。需自写 ~10 行 wrapper（项目已有 `useCan`/`<HasPermission>`，方向正确）。
- 🚩 **与后端菜单冲突**：`access:` 同时守路由+隐菜单，而菜单要从后端来（§4）——要么用后端菜单（`menu.request`，侧边栏不读路由 `access`，耦合自动失效，靠路由 `access` 兜底 403），要么前端 access 矩阵与后端权限矩阵严格同步（漂移出"幽灵菜单跳 403"）。
- access 对象应用初始化时算一次；权限中途变化要 `setInitialState` 强刷。
- 🚩 Next.js 路径：access 插件没了——直接用 `useCan(code)` + `<HasPermission>` 包裹组件，逻辑等价。

## 4. MENU SOURCE（最关键）

**(a) v6 默认 + 后端菜单能力**
- **默认 = 静态前端 `config/routes.ts`**，由 Umi layout 插件从路由派生侧边栏（带 `name`+`path` 的进菜单，`hideInMenu` 隐）。文档 https://umijs.org/docs/max/layout-menu
- **后端动态菜单 = ProLayout 的 `menu.request`**（一流支持，非 hack）：在 `src/app.tsx` 的 `layout` 运行时配置给 `menu: { request: async (params, defaultMenuData) => Promise<MenuDataItem[]> }`。文档 https://procomponents.ant.design/components/layout ；进阶 https://beta-pro.ant.design/docs/advanced-menu
- Umi 4 `patchClientRoutes` + `render` 能改路由树，但**不建议**用来做菜单（见下）。
- `MenuDataItem` 关键字段：`path / name / icon(ReactNode|string) / routes|children / hideInMenu / divider(boolean) / flatMenu / target`。

**(b) 对接 /menus 树**
- **最佳 = 混合（hybrid）**：`config/routes.ts` 仍定义**真实路由**（代码分割、组件绑定、`access:` 守卫）；侧边栏元数据（标题/图标/顺序/分组/分隔线/可见性）从后端 `/menus`（已在 `/auth/current.menus[]`，登录时一次性拿）通过 `menu.request` 喂给 ProLayout。
- `MenuResponse → MenuDataItem`：`name→name`、`path→path`、`children→routes`、`type===3(DIVIDER)→{divider:true}`、`type===1(GROUP)→带子 routes 的父节点`、`sortOrder` 入树前先排序。

**(c) 风险/Gap**
- 🚩 **图标字符串→组件（最大缺口）**：静态路由下 Umi layout 插件**构建时**自动把 `"user"`→`<UserOutlined/>`；但**走 `menu.request` 时这个自动映射不可靠失效**（社区 issue ant-design/pro-components#363）。必须前端维护 `iconMap`（REQ-6 现决策 icon=Material Symbols 名，与 antd icon 体系不一致，需自实现渲染器或映射表，是确定的新代码）。
- 🚩 **DIVIDER/GROUP 不一一对应**：`divider:true` 能渲染分隔线（OK）；后端 GROUP/MENU/DIVIDER 三态到 ProLayout 只有大略对应；复杂结构（悬空 DIVIDER、空 GROUP 裁剪）靠 REQ-1/REQ-6 的后端兜底（已选 naive 渲染）。
- 🚩 **patchClientRoutes 不要用于菜单**：注入路由丢掉 Umi 按路由代码分割（pro-components#9086 有 layout shell 不渲染的未解 bug）。故"后端定义任意新路由"的纯动态模式不可行（除非接受全量打包）。**固定页集合 + 按角色可见**的需求，混合方案够。
- 🚩 **菜单管理 CRUD vs 路由菜单**：若用前端 `routes.ts`，"菜单管理"页改 `/menus` 表**不影响**侧边栏（侧边栏来自代码）——CRUD 页变摆设。**要让菜单管理有意义，必须走后端菜单（`menu.request`）。** 与 REQ-6/REQ-1 方向一致。
- 双重控制需对齐：后端菜单 `path` 必须与前端路由 `path` 严格一致，否则点菜单 404；建议菜单管理 path 用受控下拉而非自由文本。
- 🚩 Next.js 路径：`menu.request`/`menuDataRender` 是 `<ProLayout>` 组件自己的 API（框架无关），Next.js 下可直接 `<ProLayout menu={{request}}/>`；失去的只是 Umi 静态路由派生。

## 5. REQUEST LAYER

**(a) v6 怎么工作（含一个前提修正）**
- v6 / @umijs/max 的 request 插件**基于 axios**（不是 umi-request，也不是裸 fetch）。源码：`umijs/umi` 的 `packages/plugins/src/request.ts` 里 `requestInstance = axios.create(config)`；`src/app.tsx` 注释"它基于 axios"。文档 https://umijs.org/docs/max/request
- 配置在 `src/app.tsx` 导出 `export const request: RequestConfig`，`RequestConfig extends AxiosRequestConfig`（`baseURL`/`headers`/`timeout` 透传 axios），外加三个 umi 专有键：`requestInterceptors`/`responseInterceptors`/`errorConfig:{errorThrower,errorHandler}`。
- 🚩 **官方 pro.ant.design/docs/request 页面已过时**（仍是 umi-request 双参签名）。**以 umijs.org/docs/max/request 和源码为准**。

**(b) 对接 /api/admin 前缀 + 解 ApiResponse + 分页**
- `baseURL: '/api/admin'`（同源相对，走 middleware 反代）。
- 挂 token 拦截器（注意 .length 必须严格等于 2，否则被误判为 axios 单参）。
- **解封装 + code!==200 报错放响应拦截器**（不能放 `errorThrower`——见 Gap）：取 `body.data`，`code!==200` throw BizError。
- `errorHandler`：401 → `removeToken()` + 跳登录；其它 BizError → `message.error(info.message)`（后端中文文案）。
- 分页：ProTable `request` 回调手动 `page: params.current - 1, size: params.pageSize`；回包 `{ data: res.items, total: res.total, success: true }`。

**(c) 风险/Gap**
- 🚩 **内置 `errorThrower` 对我们无效**：源码里它**仅在 `data.success === false` 时**触发；我们 envelope `{code,message,data}` **无 `success` 字段** → 永不触发。必须响应拦截器自己 throw。
- 🚩 **双解包陷阱（最隐蔽的坑）**：Umi 构建期 `request: { dataField: 'data' }`（默认）让 `useRequest` 自动 `formatResult = r => r?.data`。若**同时**在响应拦截器解包 → 二次解包 → 数据错位/undefined。**二选一**：`.umirc` 设 `request: { dataField: '' }` 关掉自动解包，或不在拦截器解包、每个 useRequest/ProTable 手动挑 `.data`。全项目统一并写进约定。
- 🚩 **ProTable 1-based vs 后端 0-based**：无声明式开关，每个 `request` 回调手动 `current - 1`（建议抽 `useProTablePagination` helper）。
- 🚩 **`code` 判定边界**：axios 对 HTTP 2xx 才进 response 拦截器，4xx/5xx 直接进 errorHandler——`code:200` 与 HTTP:200 二选一会触达。确认后端：业务失败是 HTTP 200+body.code!=200 还是 HTTP 4xx？两种都要在 errorHandler 兜底（读 `error.response.data.message`）。
- 🚩 Next.js 路径：Umi `request: RequestConfig` 没了——用现成 `http-client`（fetch 封装），自己加 (i) `/api/admin` 前缀、(ii) 解 ApiResponse、(iii) 401 重定向、(iv) Bearer header。逻辑 1:1 等价，只是没 axios 这层。ProTable `request` prop 不依赖底层库，直接喂 `{data,total,success}`。

---

## 汇总：内置做不到、需自写/后端改 清单

| # | 缺口 | 性质 | 影响区 |
|---|---|---|---|
| 0 | **本项目是 Next.js，v6 的"内置机制"全是 Umi Max 插件，拿不到** | 架构性 | 全部 5 块 |
| 1 | 无 token 存储/拦截层（模板靠 cookie） | 需自写 ~30 行 | AUTH |
| 2 | 无 `<HasPermission code>` 指令（只有 `<Access accessible={bool}>`） | 需自写 wrapper（已有） | PERMISSION |
| 3 | 后端菜单 icon 字符串→组件映射失效（静态路由自动映射不覆盖 `menu.request`） | 需前端 iconMap/渲染器；与 REQ-6 Material Symbols 契约摩擦 | MENU |
| 4 | DIVIDER/GROUP 三态与 ProLayout 不一一对应；纯动态路由丢代码分割+有未解 bug | 接受混合方案 | MENU |
| 5 | 菜单管理 CRUD 只有后端菜单模式下才有意义 | 架构决策点（已选后端菜单） | MENU |
| 6 | 内置 `errorThrower` 只认 `data.success`，我们 `{code,message}` 不触发 | 响应拦截器自己 throw | REQUEST |
| 7 | 响应拦截器解包 × `dataField:'data'` 默认 = 双解包陷阱 | 设 `dataField:''` 或不在拦截器解包 | REQUEST |
| 8 | ProTable 1-based vs 后端 0-base 无声明式开关 | 每个 request 回调手动 current-1 | REQUEST |
| 9 | `pro.ant.design/docs/request` 文档过时，按它写拦截器静默失败 | 以源码 + umijs.org/docs/max/request 为准 | REQUEST |
| 10 | `access:` 同时守路由+隐菜单，与后端菜单耦合冲突 | 选后端菜单路径消解 | PERMISSION/MENU |

## 关键 URL

- Umi Max request https://umijs.org/docs/max/request
- access https://umijs.org/docs/max/access
- runtime config https://umijs.org/docs/api/runtime-config
- ProLayout https://procomponents.ant.design/components/layout
- 进阶菜单 https://beta-pro.ant.design/docs/advanced-menu
- v6 源码（权威）https://github.com/ant-design/ant-design-pro/tree/master/src
