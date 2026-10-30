> ⚠️ **SUPERSEDED（2026-07-31）**：此为已**放弃**的 Ant Design Pro v6 迁移契约审计。中途改用 **Soybean Admin v2.2**（见 #9/#12）。本文仅作历史留存，不代表当前栈。其「UI 语义不泄漏到 API / 不动 envelope」的结论仍有效，已沉淀进 `docs/adr/0001`。

# R2 — Ant Design Pro v6 ↔ admin 后端 契约适配审计

> research ticket: https://github.com/ZhangColin/semgravio-admin-web/issues/8
> 产出时间：2026-07-30。为迁移到 ant-design-pro v6（@umijs/max）的后端契约适配审计。

## 背景：判定"expects"的口径

Ant Design Pro v6 的"默认期望"分两层，必须区分，否则会误判 gap：

- **组件层硬契约**（不满足就报错/不工作）：ProTable `request` 必须返回 `{data, success, total}`；`getInitialState` 必须返回 layout 能读到的 `currentUser`；`menu.request`（layout 配置）返回 `MenuDataItem[]`。
- **脚手架约定**（scaffold 默认，可重写、不算硬契约）：`POST /api/login/account` 默认 `{status:'ok', currentAuthority}`、`GET /api/currentUser` 默认扁平 `{name, avatar, userid, access:'admin', notifyCount...}`。这些是 `src/services/user/` + `src/models/login.ts` + `src/app.tsx (getInitialState)` 的示例代码，真实项目 100% 重写——LoginFormPage / ProLayout 本身不校验这些字段名。

判定 bias：backend adjusts 为默认；但只要属于"脚手架约定（非组件硬契约）+ 适配器 trivial"，就走 frontend-adapt。

## 对比表

| 契约点 | ant-design-pro v6 期望 | 我方后端现状 | Gap | 建议 + 理由 |
|---|---|---|---|---|
| **login 响应** | 脚手架约定（可重写）：`{ status:'ok'\|'error', type, currentAuthority:'admin' }`，部分 JWT 流加 `token` | `ApiResponse<TokenInfo{token,loginId,expireTime}>`；无 `status`/`currentAuthority`，token=Sa-Token UUID | 形状完全不同；无 success 标志位、无 authority 字段 | **frontend-adapt**。属脚手架约定非组件契约，login service+model 必重写；TokenInfo 已含 token，`currentAuthority` 由后续 `/auth/current` 取得。给后端塞 `status:'ok'` 是 UI 语义泄漏到 API |
| **currentUser / userInfo** | 脚手架约定：扁平 `{ name, avatar, userid, access:'admin'\|'user', email, notifyCount, unreadCount, signature, title, group, tags... }`；ProLayout 头像下拉读 `name`/`avatar` | `CurrentUserResponse{ user:{id,username,nickname,email,phone,avatar,status,statusName,breakGlass,...}, roleCodes[], menus[], permissions[] }`（嵌套 user） | 嵌套 vs 扁平；`name`→`nickname`；无顶层 `userid`(=user.id)；无单值 `access` | **frontend-adapt**（`getInitialState` 做 ~5 行映射）。嵌套结构把"身份(user)"与"授权(roleCodes/menus/permissions)"分清，是更健壮的 API |
| **menu 结构** | layout `menu.request` 返回 `MenuDataItem[]`：`{ path, name(展示串或 i18n key), icon(**antd 图标名串**), access(单 key 串), routes[], hideInMenu, target }` | 树：`{ id, name, path, icon(**Material Symbols 名**), parentId, sortOrder, type(GROUP/MENU/DIVIDER 整数), children[] }` | icon 字符集不一致（**硬冲突**）；无 `access` 字段；DIVIDER 无 antd 对应；`type` 在 antd 由嵌套结构隐含 | **混合**：① **backend-adjust icon 契约**（Material Symbols → antd 图标名 / 可空）——两套图标非 1:1，前端映射脆弱（重开旧 REQ-6 icon 决策）；② 其余 **frontend-adapt**（树→routes 转换、type=DIVIDER 跳过、type=GROUP→嵌套 routes）。`name` 展示串直接用 |
| **permission codes** | `currentUser.access` 单值串；`src/access.ts` 返回 `{[capability]:boolean}`；路由 `access:'canAdmin'` 引用单 key | `permissions: string[]`（细粒度 `admin:user:read`）+ `roleCodes: string[]`（`SUPER_ADMIN`），超管 bypass | 数组 vs 单值串；细粒度码 vs 粗能力 key | **frontend-adapt**。antd `access.ts` 本就是白纸——写 `{'admin:user:read': perms.includes(...)}` 即可，`useAccess()`/`<Access>` 支持。**后端绝不能**把 `permissions[]` 塌缩成单值 `access`——会丢失 RBAC 细粒度（违反不变式 #2） |
| **response envelope** | **无硬契约**：umi-request + `responseInterceptors` 解包；`errorConfig`/`errorHandler` 处理业务错 | `ApiResponse{code(=HTTP状态), message, data, requestId, errors}` | antd 不自动解包；需手写 interceptor 取 `data.data` | **frontend-adapt**。一个 `responseInterceptor` 返 `response.data.data` + 一个 `errorHandler` 读 `message/errors`。后端 envelope 是平台标准（requestId 对排障关键），不应为前端去掉 |
| **pagination** | **组件硬契约**：ProTable `request` 必须返 `{ data:T[], success:boolean, total:number }`（顶层） | `PageResponse{items, total, page(1-based), size}`，**请求** page 0-based | `items`→`data`；无 `success`；page 请求/响应 off-by-one | **frontend-adapt**。`{data,success,total}` 是 **UI 层契约不是 REST 契约**——API 返 `success:true` 无意义（HTTP 状态已表达），page off-by-one 在 `request` 里 `page-1` 一行解决。后端 PageResponse 是干净标准，不应污染 |
| **鉴权 token** | requestInterceptor 注入 `Authorization: Bearer <jwt>`（默认 JWT） | `Authorization: Bearer <uuid>`（Sa-Token，非 JWT、非 cookie、无 refresh） | token 是 UUID 而非 JWT；无 refresh token | **无改动**。header 形态完全一致（Bearer + 串），Sa-Token UUID 对前端就是"一段串"。注意：无 refresh → 前端不做静默续期，过期重登 |

## 优先级清单

### 后端需调整（仅 1 项，且为契约重开而非新需求）

1. **[P1] 菜单 `icon` 字段契约：Material Symbols → Ant Design 图标名（或 nullable）**
   - 现状：REQ-6 把 icon 锁定为 Material Symbols 名（当前 Next.js 前端用 Material Symbols）。
   - 迁移后：Ant Design Pro 的 `menu.request`/`MenuDataItem.icon` 解析的是 `@ant-design/icons` 名（如 `UserOutlined`），两套图标集**非 1:1 可映射**，前端维护映射表会持续腐化。
   - 动作：重开 icon 契约 → 改为「antd 图标名串，无对应图标时传 null（前端 fallback 默认图标）」。种子菜单数据同步换名。这是唯一一处"adapter 非平凡 + backend 改动干净"的真 gap。

### 前端适配器（迁移时必写，均 trivial）

1. **[P0] `request` responseInterceptor + errorHandler**：解 `ApiResponse` → 返 `data`；非 2xx/`code!==200` 走 `errorHandler` 弹 `message`。一处全局。
2. **[P0] `getInitialState`**：调 `/auth/current`，把 `CurrentUserResponse` 映射成 antd 期望的 `currentUser`——`name: user.nickname`、`userid: String(user.id)`、`avatar: user.avatar`，并原样保留 `permissions/roleCodes/menus` 供 `access.ts`。
3. **[P0] `src/access.ts`**：基于 `initialState.currentUser.permissions[]` + `roleCodes[]` 生成能力对象；超管 `roleCodes.includes('SUPER_ADMIN')` → 全 true。
4. **[P0] 登录 service + model 重写**：`POST /auth/login` → 取 `TokenInfo.token` 存 localStorage（token 存在即成功，不依赖 `status:'ok'`）；退出调 `/auth/logout`。
5. **[P1] layout `menu.request`**：调 `/menus`，把后端树 → `MenuDataItem[]`（`name`/`path` 直用、`icon` 按 P1 后端契约渲染、`type=DIVIDER` 跳过、`type=GROUP`→嵌套 `routes`）。**已知坑**（ant-design-pro #10827）：服务端菜单在刷新/重登后需重取，确保在 `getInitialState` 或 access 流程里触发。
6. **[P1] 各 ProTable `request` 包装器**：统一 `{ data: res.items, total: Number(res.total), success: true }`，请求参数 `page: (current-1)`（0-based）。建议封装 `wrapPageTable` 复用。
7. **[P2] `id`/`loginId` Long 精度**：后端 Long/雪花 id 以字符串序列化，前端类型保持 `string`，避免 `Number()` 越界。

### 明确"不改后端"的决策（防止被 bias 误伤）

- **不动** `ApiResponse` envelope（requestId 对排障是硬价值）。
- **不动** `PageResponse{items,total,page,size}`（success 是 UI 层语义，不该进 REST）。
- **不动** `permissions[]`/`roleCodes[]` 数组形态（细粒度 RBAC 是核心需求，antd access.ts 能消费）。
- **不动** `CurrentUserResponse` 嵌套结构（身份/授权分离更健壮）。
- **不动** Sa-Token Bearer uuid（与 antd 默认 header 模式天然兼容）。

## 来源

- [Ant Design Pro Cheatsheet（mock 形状权威）](https://preview.pro.ant.design/welcome/)
- [Ant Design Pro v2 Mock API 文档](https://v2-pro.ant.design/docs/mock-api/)
- [Authority Management（权限官方文档）](https://beta-pro.ant.design/docs/authority-management/)
- [Layout 文档（路由结构）](https://beta-pro.ant.design/docs/layout/)
- [Umi Max Layout & Menu](https://umijs.org/en-US/docs/max/layout-menu/)
- [ProTable 文档（request 契约）](https://procomponents.ant.design/en-US/components/table/)
- [Ant Design Pro v6.0.0 Release](https://github.com/ant-design/ant-design-pro/issues/11734)
- [Issue #10827（服务端菜单刷新坑）](https://oss.issuehunt.io/r/ant-design/ant-design-pro/issues/10827)

> 注：github.com / pro.ant.design / umijs.org / procomponents.ant.design 直接抓取被网络策略拦截，字段形状来自这些官方域名经搜索引擎原文摘录，可信度高。

## 本项目基线文件

- `GLOSSARY.md`（后端契约快照 §「接口清单」「关键 DTO」）
- `src/lib/admin-api.ts`（现有 TS 类型 + Long→string 处理，迁移后类型沿用）
