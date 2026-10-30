# REQ-14：角色删除「使用中」检查未过滤已软删用户 → 角色无法删除

> 发现于：admin-web issue [#23](https://github.com/ZhangColin/semgravio-admin-web/issues/23) E2E 测试数据清理（2026-08-02）
> 同类先例：REQ-5（用户/角色软删查询不过滤 deleted，已修复）——本条是软删过滤在「角色删除守卫」路径上的漏网
> 状态：**后端处理中**（已提后端 issue [#24](https://github.com/ZhangColin/semgravio-admin/issues/24)（2026-08-02）；2026-08-03 用户确认后端方向——尽量放弃软删除，即使保留也由后端彻底处理）

## 现象

`DELETE /api/admin/roles/{id}` 返回 `403 角色正在使用中，不能删除`（`ADMIN_013`），但该角色当前**没有任何有效用户**——唯一挂过它的用户已被软删（`DELETE /users/{id}` 返回 200 且列表已不可见）。软删用户的角色关联记录（`sys_admin_user_roles`）仍留在表里，角色删除的 in-use 检查把它计为「使用中」，导致角色**永远无法删除**。

## 复现

```bash
# 1. 建角色 + 建用户 + 挂角色（均 200）
ROLE_ID=$(curl -s -X POST $BASE/roles -H "$H" -H "$CT" -d '{"name":"测试角色","code":"TEST_OPS"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['data'])")
USER_ID=$(curl -s -X POST $BASE/users -H "$H" -H "$CT" -d '{"username":"testdel1","password":"Test@2026","nickname":"t"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['data'])")
curl -s -X PUT $BASE/users/$USER_ID/roles -H "$H" -H "$CT" -d "{\"roleIds\":[\"$ROLE_ID\"]}"

# 2. 删除用户（软删）→ 200，用户列表已查无此人
curl -s -X DELETE $BASE/users/$USER_ID -H "$H"

# 3. 清空已删用户的角色关联 → 404 管理员不存在（软删后接口已不可达，符合预期）
curl -s -X PUT $BASE/users/$USER_ID/roles -H "$H" -H "$CT" -d '{"roleIds":[]}'

# 4. 删除角色 → 403「角色正在使用中，不能删除」❌ 应为 200
curl -s -X DELETE $BASE/roles/$ROLE_ID -H "$H"
```

（`$BASE=http://localhost:8081/api/admin`，`$H`/`$CT` 为超管鉴权头，口令从略。）

## 定位

`AdminRoleRepository.isUsedByAnyAdmin`（`src/main/java/com/semgravio/admin/domain/repository/AdminRoleRepository.java:52`）：

```java
@Query("SELECT COUNT(ur) > 0 FROM AdminUserRole ur WHERE ur.roleId = :roleId")
boolean isUsedByAnyAdmin(@Param("roleId") Long roleId);
```

只按 `roleId` 计数关联记录，**未排除已软删用户的关联**——`AdminUserRole` 记录不随用户软删而移除，查询也未关联 `AdminUser` 过滤 `deleted=false`。与 REQ-5 的软删查询过滤是同一类缺陷的不同路径。

## 需求

角色删除的 in-use 判定只统计**未软删用户**的关联，二选一（实现方定）：

1. **查询侧过滤**：in-use 查询排除已软删用户——`SELECT COUNT(ur) > 0 FROM AdminUserRole ur JOIN AdminUser u ON ur.adminId = u.id WHERE ur.roleId = :roleId AND u.deleted = false`（软删过滤显式进行，同 `findByIdInAndDeletedFalse` 既有惯例）；
2. **级联侧清理**：用户软删时一并删除其 `AdminUserRole` 关联记录（聚合内联级，关联是用户的从属记录）。

倾向 1（最小改动、与既有显式过滤惯例一致）；若认为关联记录本身不该残留，2 也合理、可两者并做。

## 影响

- 任何「挂过角色的用户被删除」的角色都无法再删除 → 角色管理写路径事实残缺（只能新建/编辑，删不掉）。
- 测试/运营数据清理受阻（本次 E2E 只能靠直连 DB 删关联记录完成清理）。

## 验证方式（后端修复后）

按「复现」脚本重跑：步骤 4 应返回 200，且 `GET /roles?keyword=TEST_OPS` 查无该角色。
