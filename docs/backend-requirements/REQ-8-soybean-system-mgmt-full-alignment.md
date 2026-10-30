# REQ-8 ~ REQ-11 — 后端对齐 Soybean admin-web 系统管理完整功能（用户/角色/菜单）

> ⚠️ **2026-07-31 更新**：**REQ-12（操作人审计 `AuditorAware`）已撤回**——经核实非 Soybean UI 需求（example 用户/角色/菜单三列表均不渲染审计字段）。审计整体拎为单独待办 admin-web[#19](https://github.com/ZhangColin/semgravio-admin-web/issues/19)（等系统管理功能做完后前后端共审），审计列 ticket #18 已关，前端不动 `CommonRecord`。下文 REQ-12 章节及各 REQ 表里的审计行均作废。

> 前端仓 `semgravio-admin-web`（Soybean Admin v2.2 / Vue3）→ 后端仓 `semgravio-admin`（Spring Boot 3.4 / Sa-Token / PostgreSQL）。
>
> **本轮决策原则（用户 2026-07-31 拍板，覆盖此前一切相反记录）**：
> 1. Soybean `example` 的系统管理模块（用户/角色/菜单）= **功能规约，完整移植**。它怎么实现，前端就怎么要。
> 2. 后端**只保留「通用结构」层规范**：`ApiResponse{code,message,data,requestId,errors}` 外壳、`PageResponse{items,total,page,size}` 分页壳、`/api/admin/...` 路径风格、Long→字符串、枚举整数序列化（`BaseEnumSerializer`）、错误走 HTTP 非 2xx + `onError`。**这些不改**。
> 3. **其余一切功能字段/操作/行为，后端缺什么补什么、字段不对就改字段。** 不再做「前端裁掉 Soybean 某字段去将就后端」的反向适配。
> 4. 这**推翻** GLOSSARY.md 旧决策「菜单管理页重写、不移植，按 MenuResponse 重写」（L116-117）——菜单改为完整移植 Soybean 的路由生成器模型，后端扩字段支撑。

> 本文档取代先前「REQ-8..13 nav-tree/裁字段」草稿（该草稿基于已被覆盖的反向适配思路，作废）。

---

## 既有 REQ 状态（REQ-1 ~ REQ-7，**勿重复提**）

| REQ | 主题 | 状态 |
|-----|------|------|
| REQ-1 | `MenuResponse.type` 字段 | ✅ 已交付（issues #4/#5/#6 CLOSED） |
| REQ-2 | RBAC 必修 bug（loginType / 超管 bypass） | ✅ 已核实通过 |
| REQ-3 | `/auth/captcha` | ✅ wontfix（issue #2 CLOSED） |
| REQ-4 | 用户接口补 roleIds/roles | ✅ **已实现并 CLOSED**（issue #3）：`AdminUserResponse.roles` 详情回显，被 `AdminUserRolesEchoIntegrationTest` 钉住 |
| REQ-5 | 用户软删未生效 | ✅ 已修复验证（issue #7）。⚠️ 见「待核实」：Role/Menu 软删过滤是否同样生效（critique 指出三聚合共用同一 `SoftDeletableRestrictionContributor`，应一致；与「Role 同样中招」的旧备注冲突，需统一核实） |
| REQ-6 | 种子菜单对齐前端路由/图标 | ⚠️ Soybean 重写后部分过时（图标系统见 REQ-8 子决策） |
| REQ-7 | 分配 400（关联实体 id 策略） | ✅ 已修复验证（issue #9 CLOSED） |

---

## 新增 REQ（REQ-8 ~ REQ-12）

### REQ-8（P0，菜单核心）— 菜单模型扩成 Soybean「路由生成器」全字段

**背景**：Soybean 菜单（`example` 分支 `src/typings/api/system-manage.d.ts` `Menu`）是**路由生成器**：每条菜单携带 Vue Router 渲染所需的全部元数据，CRUD 页编辑它们，动态路由生成器读取它们生成 `ElegantRoute`。我方后端 `MenuResponse` 现仅 `{id, name, path, icon, parentId, sortOrder, type, children}`（8 字段），**零路由元数据、零按钮、零状态、零审计出站**。这是本轮最大的模型 gap。

**需求**：`AdminMenu` 聚合 + `sys_admin_menus` DDL + `MenuResponse` + `CreateMenuCommand` + `UpdateMenuCommand` 增补 Soybean `Menu` 的全套功能字段：

| Soybean 字段 | 现状 | 后端动作 |
|--------------|------|----------|
| `menuName` | `name`（已有） | 对齐命名/或保留 `name` |
| `routePath` | `path`（已有，语义≈routePath） | 对齐（保留 `path` 或更名 `routePath`） |
| `routeName` | **缺** | **加** `routeName: String`（Vue Router 名；@elegant-router 按它索引组件） |
| `component` | **缺** | **加** `component: String?`（编码 `layout.<L>$view.<P>`，见 Soybean `shared.ts`） |
| `order` | `sortOrder`（已有） | 对齐（保留 `sortOrder` 或更名 `order`） |
| `parentId` | 已有 | 保留 |
| `icon` | 已有 | 保留 |
| `iconType` | **缺** | **加** `iconType`（`1`=iconify / `2`=local svg，对齐 Soybean `IconType`） |
| `i18nKey` | **缺** | **加** `i18nKey: String?`（sidebar 标签国际化键，如 `route.manage_user`） |
| `keepAlive` | **缺** | **加** `keepAlive: Boolean` |
| `constant` | **缺** | **加** `constant: Boolean`（是否免鉴权常驻路由） |
| `href` | **缺** | **加** `href: String?`（外链） |
| `hideInMenu` | **缺** | **加** `hideInMenu: Boolean` |
| `activeMenu` | **缺** | **加** `activeMenu: String?`（隐藏路由的高亮菜单） |
| `multiTab` | **缺** | **加** `multiTab: Boolean` |
| `fixedIndexInTab` | **缺** | **加** `fixedIndexInTab: Int?` |
| `query` | **缺** | **加** `query`（静态路由 query，建议 JSON 列或子表 `{key,value}[]`） |
| `buttons` | **缺** | **加** `buttons`（逐菜单按钮权限 `{code,desc}[]`，见 REQ-9） |
| `status` | **缺** | **加** `status`（启停，复用用户启停枚举，见 REQ-10/11） |
| `menuType` ↔ `type` | `type` 现为 3 值（1=MENU/2=GROUP/3=DIVIDER） | **改为 Soybean directory(1)/menu(2) 2 值**（废弃 DIVIDER） |
| `createBy/createTime/updateBy/updateTime` | 聚合已存 createdAt/updatedAt（未出站）；createdBy/updatedBy 恒 NULL | **出站** + REQ-12 wiring |

**按 Soybean 定（既定，非开放项）**：
- **type 枚举**：采用 Soybean 的 **directory(1)/menu(2) 2 值**模型。我方此前 3 值（MENU/GROUP/DIVIDER）属已废弃的 nav-tree 旧方案——**DIVIDER 不保留**，REQ-1 的 type/DIVIDER 工作被本次 Soybean 移植覆盖；种子菜单结构按 Soybean 模型重建。
- **图标**：采用 Soybean 的 **iconify + `iconType`**（`1`=iconify / `2`=local），`SvgIcon` 原生渲染。REQ-6 的 Material Symbols 约定**作废**，种子 icon 改 iconify id（如 `mdi:xxx`）。

**菜单相关端点（Soybean 功能所需）**：
- `fetchGetMenuList`（Soybean = **分页扁平列表** `{records,current,size,total}`）：我方 `GET /menus` 现返回**非分页嵌套树**。为完整搬 Soybean 菜单表格，**新增分页扁平菜单列表端点**（如 `GET /menus/page` → `PageResponse<MenuResponse>`，扁平非树），`GET /menus`（树）保留供父级选择器/角色分配。
- `fetchGetMenuTree`（父级选择器 / 角色分配树）：**已满足**——`GET /menus` 嵌套树直接可用（前端按 `id/name/children` 消费，剔 DIVIDER）。
- `fetchGetAllPages`（路由页名选择器，供 component 的 page 下拉）：⚠️ 页名是**前端构建期产物**（`@elegant-router` 扫 `src/views/**` 生成 `src/router/elegant/imports.ts`），后端天然不知。**此项前端自行派生**，不向后端要（这是 BFF 不变式下唯一「数据归前端」的例外）。
- CRUD（POST/PUT/DELETE/GET `/menus[/{id}]`）：**已存在**，按新字段透传即可。

**职责**：前端定义需求 + 完整移植 Soybean 菜单页（仅适配 Response 外壳与端点 URL）；后端扩聚合/DDL/DTO/端点（含分页扁平列表端点）。
**阻塞**：菜单管理页完整功能 + 动态菜单 #11。
**证据**：Soybean `example` `src/typings/api/system-manage.d.ts`（`Menu`/`MenuPropsOfRoute`/`MenuButton`/`IconType`）、`src/views/manage/menu/{index,modules/menu-operate-modal,modules/shared}`；后端 `MenuResponse.java`（8 字段）、`AdminMenu.java`、`Create/UpdateMenuCommand.java`、`AdminMenuController.java`。

---

### REQ-9（P1，⚠️ 架构影响，请确认）— 按钮权限模型：per-menu buttons + 角色→按钮分配

**背景**：Soybean 的权限模型是**逐菜单按钮权限**——`Menu.buttons: {code,desc}[]`（在菜单 CRUD 里声明某菜单暴露哪些按钮），角色分配走 `button-auth-modal`（勾选按钮 code）。我方后端权限是**扁平注解扫描**：`@RequirePermission` + `PermissionScanner` → `GET /permissions` 返回扁平 `{code,name}[]`，**无菜单归属**，权限码为代码定义、不可 UI 增删，仅角色→`permissionCodes` 分配。

**需求（完整搬 Soybean）**：后端支持 per-menu buttons（REQ-8 的 `buttons` 字段）+ 角色→按钮 code 分配（`button-auth-modal` 等价端点）。按钮权限码成为**可 UI 管理**（随菜单增删）且**按菜单归属**。

**按 Soybean 实现（既定，非开放项）**：按钮权限 = per-menu `buttons`（DB 管理，随菜单增删）+ 角色→按钮 code 分配。注解扫描的 `PermissionResponse` 保留作后端真实守卫码来源；菜单 `buttons` 为前端 UI 呈现与角色分配层——二者并存，以后端守卫码为准、UI 按 Soybean 模型组织。

**职责**：前端移植 `button-auth-modal`；后端实现 per-menu buttons 模型 + 角色→按钮分配端点。
**阻塞**：Soybean 逐菜单按钮授权功能。
**证据**：Soybean `MenuButton{code,desc}`、`button-auth-modal.vue`；后端 `PermissionResponse.java`、`PermissionController`、`PermissionScanAppService`（注解扫描）。

---

### REQ-10（P1）— 角色增强：启停 status / 默认首页 home / 审计出站 / 允许清空分配 / 轻量字典端点

**背景**：Soybean 角色页（`role-operate-drawer` + `menu-auth-modal` + `button-auth-modal`）相对我方 `RoleResponse{id,name,code,description,sortOrder,menuIds,permissionCodes}`（7 字段）的增量：

| Soybean 功能 | 现状 | 后端动作 |
|--------------|------|----------|
| 角色启停 `status`（表格 status 列 + 表单开关） | **无 status**（生命周期=删除） | **加** `AdminRole.status` + DDL + `AdminRoleQuery.status` + `PUT /roles/{id}/status`（仿 `PUT /users/{id}/status`） |
| 角色默认首页 `home`（`menu-auth-modal` 顶部 NSelect，经 `getAllPages` 选 route 名） | **无 home 字段** | **加** `RoleResponse.home` + `Create/UpdateRoleCommand.home`（route name，可空） |
| 审计字段 `createTime/updateTime`（列表列） | 聚合已存 `created_at/updated_at`，未出站 | **出站** `RoleResponse.createdAt/updatedAt`（+ `createdBy/updatedBy` 见 REQ-12） |
| 清空角色全部菜单/权限/角色 | `AssignMenusCommand`/`AssignPermissionsCommand`/`AssignRolesCommand` 均 **`@NotEmpty`**（三处均确认，无法清空） | **去掉三处 `@NotEmpty`**（服务层 clear-then-add 语义已支持空集=清空，仅注解拦） |
| 轻量角色字典 `fetchGetAllRoles → {id,roleName,roleCode}`（仅启用、不分页，供用户分配角色下拉） | 仅 `GET /roles`（分页、带 `menuIds/permissionCodes`，重） | **加** `GET /roles/all`（或等价）→ `[{id,name,code}]`（仅启用、不分页） |

**职责**：前端移植 Soybean 角色页全套（status 列、home 选择器、button-auth）；后端加字段/端点/去注解/字典端点。
**阻塞**：角色启停、默认首页、清空分配、（用户页）角色分配下拉轻量化。
**证据**：Soybean `src/views/manage/role/**`、`src/typings/api/system-manage.d.ts Role`；后端 `RoleResponse.java`（7 字段）、`AdminRoleQuery.java`、`AssignMenusCommand.java:13-14` / `AssignPermissionsCommand.java:13-14` / `AssignRolesCommand.java:13-14`（均 `@NotEmpty`）、`AdminUserController PUT /users/{id}/status`（启停先例）。

---

### REQ-11（P1）— 用户增强：gender / 列表内 userRoles 回显 / 手机号搜索 / 审计出站

**背景**：Soybean 用户页（`index.vue` + `user-operate-drawer` + `user-search` + `user-detail/[id]`）相对我方 `AdminUserResponse` 的增量：

| Soybean 功能 | 现状 | 后端动作 |
|--------------|------|----------|
| `userGender`（`'1'`男/`'2'`女；表格 NTag + 搜索下拉 + 抽屉 radio） | **全链路无 gender**（聚合/DTO/Query 均无） | **加** `AdminUser.gender` 枚举 + `Create/UpdateAdminUserCommand.gender` + `AdminUserQuery.gender`(EQUAL) + `AdminUserResponse.gender` |
| `userRoles: string[]` **列表每行**（Soybean User 类型自带，表格可列角色 tag） | 仅 `GET /users/{id}` 详情回显 `roles`（`@JsonInclude(NON_NULL)`，列表项无 roles 键——被测试钉住） | **加** 列表项内联角色摘要（`roleCodes` 或精简 `roles`），避免 N+1 详情查询 |
| `userPhone` 搜索（Soybean 有独立手机号过滤） | `AdminUserQuery.keyword` 模糊 username/nickname/email，**不含 phone** | **加** `AdminUserQuery.phone`（或把 phone 并入 keyword blurry） |
| 审计 `createBy/updateBy` | `AdminUserResponse` 有 `createdAt/updatedAt`，无 `createdBy/updatedBy`（且恒 NULL） | **出站** `createdBy/updatedBy`（依赖 REQ-12 wiring） |
| 用户分配角色 UI | 后端已支持（`PUT /users/{id}/roles` + 详情回显，REQ-4 CLOSED） | 无后端动作（前端补 UI；选项来自 REQ-10 的 `/roles/all`） |
| 用户详情页 | Soybean 预留 `user-detail/[id]`，后端 `GET /users/{id}` 已支持 | 无后端动作 |

**职责**：前端移植 Soybean 用户页增量字段/UI；后端加 gender/列表角色摘要/phone 查询/审计出站。
**阻塞**：gender 存储展示、用户列表角色列、手机号搜索。
**证据**：Soybean `src/views/manage/user/**` + `user-detail/[id].vue`、`src/typings/api/system-manage.d.ts User/UserGender`；后端 `AdminUserResponse.java`、`CreateAdminUserCommand.java`、`AdminUserQuery.java`（keyword blurry 不含 phone）、`AdminUserRolesEchoIntegrationTest`（列表无 roles 键）。

---

### REQ-12（P1，平台级 wiring）— 操作人审计：实现 `AuditorAware<Long>`（createdBy/updatedBy 当前恒 NULL）

**背景**：`Auditable` 基类带 `@CreatedBy`/`@LastModifiedBy(Long)`，但 cartisan-boot 的 `CartesianDataJpaAutoConfiguration` 提供**默认 `AuditorAware` 返回 `Optional.empty()`**（其测试 `NullAuditorTestConfiguration` 即此默认行为写照），admin 后端**无自定义 `AuditorAware` 读 Sa-Token loginId** → **所有表 `createdBy/updatedBy` 恒为 NULL**。REQ-8/10/11 要出站 `createBy/updateBy`，前提是这里先接通。

**需求**：admin 实现 `AuditorAware<Long>` bean，从 `StpUtil.getLoginIdAsLong()`（cartisan Sa-Token）取当前登录管理员 id（无登录上下文时安全返回 `empty`，如系统级/种子操作）。落地后 REQ-8/10/11 的 DTO 即可暴露有意义的 `createdBy/updatedBy`。

**职责**：后端实现 bean（+ 无上下文安全降级）；前端在落地后渲染审计列。
**阻塞**：所有实体的「谁创建/修改」可追溯审计。
**证据**：`cartisan-boot/.../CartesianDataJpaAutoConfiguration.java`（默认 AuditorAware）、`cartisan-data-jpa` test `NullAuditorTestConfiguration.java`、`Auditable.java` `@CreatedBy`/`@LastModifiedBy`；admin grep 无 `AuditorAware` 实现。

---

## 不需后端改动（前端自行适配，仅同步）

下列为「通用结构」层，前端搬 Soybean 时**只**做这些适配（符合用户原则第 2 条）：

- **Response 外壳**：解包 `ApiResponse.data`、错误走 `onError`（HTTP 状态码即 code）——已实现。
- **分页**：请求 `page` 0-based、响应 `PageResponse{items,total,page(1-based),size}`；`defaultTransform` 已读 `items` + `Number(total)`。
- **字段命名/类型**：id/parentId 按 string（Long 防精度）；status 整数 1/0；命名直接用后端字段名。
- **getAllPages**：由 `@elegant-router` `src/router/elegant/imports.ts` 派生（前端构建期数据，非后端端点）。
- **getMenuTree**：复用 `GET /menus` 嵌套树（已满足）。

## 待核实（不阻塞 REQ，请后端一并确认）

1. **用户列表「total 显示 2 但无行」bug → ✅ 已查清（2026-08-01）= 陈旧后端构建，非契约/字段缺陷**。curl 当前后端 `GET /users?page=0&size=10` → `data.items` **有 1 条**、`GET /roles` → **2 条**；反编译 cartisan `PageResponse.class` 字段 = `items/total/page/size`，与前端 `defaultTransform` 逐字段吻合；fresh dev build 浏览器实测两表均正常出行（用户 `admin`、角色 `超级管理员/运营测试14`）。结论：当时看到的"不出记录"是后端跑在软删过滤修复/菜单字段改名**之前的旧 build**（即原候选根因 ②）。**行动**：重建/重启后端 + 重启前端 dev 即恢复，前后端代码均无 bug。
2. **软删过滤一致性**：核实 User/Role/Menu 三聚合的软删读过滤是否都生效（critique 指出应共用同一 contributor，旧「Role 同样中招」备注与之冲突）。

## Checklist

后端：
- [ ] REQ-8 菜单扩 Soybean 路由生成器全字段 + 分页扁平列表端点（type=directory/menu 2 值、icon=iconify+iconType，既定）
- [ ] REQ-9 按钮权限模型（per-menu `buttons` + 角色→按钮分配，既定）
- [ ] REQ-10 角色增强（status / home / 审计出站 / 去 3 处 @NotEmpty / `/roles/all`）
- [ ] REQ-11 用户增强（gender / 列表 userRoles / phone 搜索 / 审计出站）
- [ ] REQ-12 实现 `AuditorAware<Long>`
- [ ] 核实用户列表 bug + 软删一致性

前端（不等后端）：
- [ ] 菜单管理页完整移植 Soybean（适配 Response/URL）
- [ ] 用户/角色页按新字段补 UI（gender / status / home / button-auth / 列表 userRoles）
- [ ] 修正 `src/typings/api/auth.d.ts` L55 与 `src/views/manage/role/modules/menu-tree.ts` 注释（`1=MENU, 2=GROUP, 3=DIVIDER`，旧注写反）
