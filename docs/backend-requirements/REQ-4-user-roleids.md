# [REQ-4] 用户接口补充 roleIds（用于「分配角色」回显）

> 前端（semgravio-admin-web）→ 后端（semgravio-admin）需求。中优先级。

## 背景
前端「用户管理 → 分配角色」弹窗需要回显该用户当前已分配的角色，但当前 `AdminUserResponse`（`GET /users` 列表与 `GET /users/{id}` 详情）均不含 `roleIds`/`roleCodes`，前端无法回显，只能做「全量覆盖无回显」的分配，体验差且易误操作。

## 现状
`AdminUserResponse`：`id/username/nickname/email/phone/avatar/status/statusName/breakGlass/createdAt/updatedAt` —— **无角色字段**。
已有 `PUT /users/{id}/roles`（`AssignRolesCommand{roleIds}`）用于分配，但**没有读取该用户当前角色的途径**。

## 需求
在 `GET /users/{id}` 详情响应中补充该用户当前的角色 id 列表：
- 字段：`roleIds: number[]`（或 `roles: {id,name,code}[]`，后者更便于列表直接展示角色名）
- 填充：从 `admin_user_role` 关联表聚合

## 验收标准
- [ ] `GET /users/{id}` 返回该用户的 `roleIds`（或 `roles`）
- [ ] 分配角色（`PUT /users/{id}/roles`）后再查详情，`roleIds` 反映最新分配
- [ ] （可选）列表 `GET /users` 也返回 `roleIds`/`roles`，便于列表展示角色列

## 对前端的影响（解锁）
- 「分配角色」弹窗正确回显当前角色
- （可选）用户列表显示「角色」列

## 优先级
**中** —— 阻塞分配角色回显，不阻塞其他用户管理功能。前端 spec（admin-web issue #1）的 Further Notes 已标注。
