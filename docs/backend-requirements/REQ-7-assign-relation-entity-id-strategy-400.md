# REQ-7 — 角色分配权限/菜单、用户分配角色全部 400（关联实体 id 生成策略与 DDL 冲突）

> 来源：admin-web T3（角色管理页）E2E 验证发现（2026-07-29）。
> 前端 ticket：ZhangColin/semgravio-admin-web#4。
> 状态：**已提后端**（issue 见文末）。

## 现象

以下「分配」接口全部返回 `400 Invalid request`（`errors` 为空，无具体原因）：

- `PUT /api/admin/roles/{id}/permissions`（body: `{"permissionCodes":["admin:user:read","admin:menu:read"]}`）
- `PUT /api/admin/roles/{id}/menus`（body: `{"menuIds":[10]}`）
- `PUT /api/admin/users/{id}/roles`（同构 bug，已实测同样 400）

对照实验：

- `PUT /roles/{id}`（更新角色基本信息，同一 `roleRepository.save(role)` 路径但不改集合）→ **200 ✅**
- `PUT /roles/{id}/permissions` 传**无效**权限码 `bogus:code` → **404「权限不存在」**（服务层校验正常到达 ✅）
- 即：只有「清空集合 + 新增关联行 + save」的路径失败 —— 失败点在**关联实体的 INSERT**。

## 读码定位（两个独立 bug，都在关联实体）

### Bug ① 三张关联表：实体 id 策略 IDENTITY vs DDL TSID

V1 迁移（`db/migration/V1__create_admin_tables.sql`）三张关联表主键均为**应用层 TSID**（无自增）：

```sql
CREATE TABLE sys_admin_role_menus (
    -- Primary Key (TSID)
    id BIGINT PRIMARY KEY,   -- 无 IDENTITY/自增
    ...
```

但三个关联实体都用**数据库自增**：

- `domain/entity/AdminRoleMenu.java:26` — `@GeneratedValue(strategy = GenerationType.IDENTITY)`
- `domain/entity/AdminRolePermission.java:26` — 同上
- `domain/entity/AdminUserRole.java:26` — 同上（`sys_admin_user_roles` 同样是 TSID DDL）

PostgreSQL `BIGINT PRIMARY KEY` 无自增 → INSERT 时 id 无来源 → 约束违反 → 框架兜底为 400。

**对照**：聚合根（`AdminRole`/`AdminMenu` 等）是 `@Id` 无 `@GeneratedValue`，由框架 TSID 赋值 —— 关联实体应对齐同一机制。

### Bug ② `sys_admin_role_permissions.permission_name` NOT NULL vs 服务层传 null

- V1 DDL：`permission_name VARCHAR(100) NOT NULL`（第 220 行）
- 实体：`@Column(name = "permission_name", length = 100)`（nullable 默认 true）
- `RoleManagementAppService.assignPermissions` 调 `role.addPermission(permissionCode, null)` —— **显式传 null**

即使 Bug ① 修复，分配权限仍会因 `permission_name` NOT NULL 约束违反而失败。`PermissionScanner` 本就有权限名（`GET /permissions` 返回 `{code, name}`），服务层可顺手填充；或 DDL 放宽为 nullable。

## 复现（curl 直连后端，已排除前端 / Vite 反代）

```bash
TOK=$(curl -s -X POST localhost:8081/api/admin/auth/login \
  -H Content-Type:application/json \
  -d '{ "username":"admin","password":"<内置超管密码>","rememberMe":false }' \
  | jq -r .data.token)

# 建测试角色
RID=$(curl -s -X POST localhost:8081/api/admin/roles \
  -H "Authorization: Bearer $TOK" -H Content-Type:application/json \
  -d '{"name":"分配测试","code":"ASSIGN_TEST"}' | jq -r .data)

# 分配权限 → 400 Invalid request
curl -s -X PUT "localhost:8081/api/admin/roles/$RID/permissions" \
  -H "Authorization: Bearer $TOK" -H Content-Type:application/json \
  -d '{"permissionCodes":["admin:user:read"]}'

# 分配菜单 → 400 Invalid request
curl -s -X PUT "localhost:8081/api/admin/roles/$RID/menus" \
  -H "Authorization: Bearer $TOK" -H Content-Type:application/json \
  -d '{"menuIds":[10]}'
```

> ⚠️ 复现脚本中 `password` 用占位符；内置超管口令不在本文档明文出现。

## 期望

- 三个分配接口按契约成功（200），关联行正确落库；`GET /roles` 回显 `menuIds`/`permissionCodes`，`GET /users/{id}` 回显角色（REQ-4 落地后）。
- 建议顺带核查 `AdminUserRole` 之外是否还有遗漏的 IDENTITY 实体。

## 影响与优先级

- **优先级：高** —— RBAC 的「分配」写路径全灭：
  - 阻塞前端 **T3**（角色管理页：分配权限/分配菜单验收项，issue admin-web#4）；
  - 阻塞前端 **T4**（用户分配角色，issue admin-web#5）——T4 原本只等 REQ-4，实际也卡在本 bug。
- 前端无 workaround（后端 400 属契约级失败）。

## 附：E2E 中已验证正常的部分（供缩小排查面）

- 角色 CRUD：列表/搜索/新增/编辑/删除（更新走同一 `save`，未涉集合变更，正常）；
- 权限校验：`admin:role:write` 拦截与超管 bypass 正常；
- 无效权限码的 404 中文错误文案正常返回。
