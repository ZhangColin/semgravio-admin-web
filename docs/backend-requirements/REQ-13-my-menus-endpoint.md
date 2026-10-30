# REQ-13：新增「我的导航」端点 `GET /menus/my` + `/auth/current` 移除 menus

> 前端仓库 spec：https://github.com/ZhangColin/semgravio-admin-web/issues/20
> 背景决策：admin-web #11（动态菜单适配，CLOSED）+ GLOSSARY.md「2026-08-01 动态菜单 grilling」

## 背景

前端（Soybean Admin v2.2）即将翻 `VITE_AUTH_ROUTE_MODE=dynamic`：登录后拉取当前用户可见菜单树，动态注册路由并渲染导航。Soybean dynamic 模式期望的数据形状是 `{routes, home}`（routes = 菜单树，home = 默认首页 route name）。

现 `/auth/current` 把「身份（user/roleCodes/permissions）」和「导航（menus）」混在一个响应里，且不含 home。经前后端职责讨论，按**「身份 vs 导航」划界拆分**：

- `/auth/current` = 身份与权限（user / roleCodes / permissions）
- `GET /menus/my` = 我的导航（menus / home）

## 需求

### 1. 新增 `GET /api/admin/menus/my`

**权限**：**登录即可**（Sa-Token `checkLogin`；**不得**挂 `@RequirePermission('admin:menu:read')`——普通用户登录后也要拉自己的导航，该端点是消费面不是管理面）。

**响应 data**：

```json
{
  "home": "manage_role",
  "menus": [ /* MenuResponse 树，字段同现 /auth/current.menus */ ]
}
```

- **`menus`**：按当前用户角色裁剪的可见菜单树。字段模型与现 `/auth/current.menus` 完全一致（`id/menuName/routeName/routePath/component/icon/iconType/parentId/sortOrder/menuType/i18nKey/keepAlive/constant/multiTab/hideInMenu/activeMenu/href/fixedIndexInTab/query/status/children`，Long→string、整数枚举）。超管（SUPER_ADMIN bypass）返回全量。
- **`home: string | null`**：当前用户所有角色中，**sortOrder 最小角色的非空 `home`**（REQ-10 已交付的角色默认首页字段——此前端 spec 的主要消费者）；所有角色 home 均为空 → `null`（前端兜底：第一个可见叶子菜单）。

**只返回启用（status=1）菜单**：禁用（status=0）菜单不下发；**directory（menuType=1）禁用则其整个子树不下发**。⚠️ 实测现 `/auth/current.menus` **不过滤** status=0（禁用 `manage_menu` 后仍下发、只是 `status: 0`）——消费面过滤属服务端职责，随本 REQ 一并修正。管理面 `GET /menus`（分页）与 `GET /menus/tree` 保持全量**不受影响**（菜单管理页维护用途须见禁用项）。

### 2. `/auth/current` 移除 `menus` 字段

`CurrentUserResponse` 收敛为 `{user, roleCodes, permissions}`。这是 breaking change，但**前端是唯一消费者**（已 grep 核实当前前端无任何代码消费该字段），随前端 spec #20 同步切换即可，无协调风险。钉住 `menus` 字段的集成测试需同步调整。

## 理由

1. **职责清晰**：菜单是导航资源归 menu 域；roleCodes/permissions 是身份 claims 留 auth 域。
2. **home 与 menus 同一消费场景**（路由系统：落地页 + `/` 重定向），内聚在一个响应；且 Soybean `UserRoute` 原生形状即 `{routes, home}`，前端可直通。
3. **消费 REQ-10 的角色 `home` 字段**：该字段已交付（角色管理 UI 可配），动态路由是其设计消费者，不消费即死字段。
4. 后端推导 home 时算 menus 本已拿到用户角色，顺手为之、零额外成本。

## 前端配套（不在本 REQ 范围，供参考）

- `fetchGetUserRoutes` → 打 `/menus/my`（响应直通映射 `{routes, home}`）；`fetchGetConstantRoutes`/`fetchIsRouteExist` 前端本地实现，无需后端端点。
- home 为 null 或指向本地不存在路由 → 前端兜底第一个可见叶子菜单。
