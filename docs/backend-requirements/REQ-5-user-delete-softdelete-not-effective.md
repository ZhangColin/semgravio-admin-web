# REQ-5 — 用户删除软删未生效（查询不过滤 deleted）

> 来源：admin-web T2（用户管理页）E2E 验证发现（2026-07-29）。
> 前端 ticket：ZhangColin/semgravio-admin-web#3。
> 状态：**待提后端**（本文件为前端侧需求记录；尚未提交后端 issue）。

## 现象

`DELETE /api/admin/users/{id}` 返回 `{"code":200,"message":"Success"}`，但删除后：

- `GET /api/admin/users`（列表）仍包含该用户；
- `GET /api/admin/users/{id}`（详情）仍 `200` 返回该用户。

即：删除接口「成功」了，但用户并未从查询中消失。

## 复现（curl 直连后端，已排除前端 / Vite 反代）

```bash
TOK=$(curl -s -X POST localhost:8081/api/admin/auth/login \
  -H Content-Type:application/json \
  -d '{ "username":"admin","password":"<内置超管密码>","rememberMe":false }' \
  | jq -r .data.token)

# 建一个待删用户
curl -s -X POST localhost:8081/api/admin/users \
  -H "Authorization: Bearer $TOK" -H Content-Type:application/json \
  -d '{ "username":"delme1","password":"Test1234","nickname":"x" }'

ID=$(curl -s "localhost:8081/api/admin/users?page=0&size=20" \
  -H "Authorization: Bearer $TOK" \
  | jq -r '.data.items[] | select(.username=="delme1") | .id')

# 删除
curl -s -X DELETE "localhost:8081/api/admin/users/$ID" -H "Authorization: Bearer $TOK"
# => {"code":200,"message":"Success",...}

# 紧接着查：仍 200 返回该用户（期望：404 或不再出现在列表）
curl -s "localhost:8081/api/admin/users/$ID" -H "Authorization: Bearer $TOK"
```

> ⚠️ 复现脚本中 `password` 用占位符；内置超管口令不在本文档明文出现（避免随仓库 / issue 泄露）。

## 读码定位（`semgravio-admin` 仓库）

- `AdminUserManagementAppService.delete(id)` → `adminUserRepository.delete(entity)`。
- 框架 `BaseRepositoryImpl.delete` 走 `entity.markAsDeleted()`（`AdminUser#markAsDeleted` → `super.markAsDeleted()`），属**逻辑删**：实测删除后 `updatedAt` 确有变化，说明 `deleted` 标志被置位。
- 但 `sys_admin_users` 的查询（`findAll` / `findById`）**未过滤 `deleted`**：缺 `@SQLRestriction("deleted = false")` / `@Where(deleted = false)`，或框架级软删查询开关未启用 → 已删记录仍被返回。

## 期望

删除后，该用户不再出现在列表与详情查询中（符合软删语义）。

## 影响与优先级

- 前端删除流（DELETE 请求 / 成功 toast / 列表刷新）实现**正确**，**无前端 workaround**——后端返回 200 即视为成功是正确语义。
- **优先级：高**（用户管理核心写操作实际失效；任何被删用户都将永驻列表）。
- 建议一并核查其他聚合（Role / Menu / Permission）是否存在相同的「软删标志置位但查询不过滤」遗漏。

## 附：Long 精度（无问题，仅记录）

后端已将 `Long` 以**字符串**序列化（如 `"id":"340764699553880311"`、`PageResponse.total` 也为字符串），前端按 `string` 处理 `AdminUser.id`、对 `total` 归一化为 number，**无精度丢失**。
