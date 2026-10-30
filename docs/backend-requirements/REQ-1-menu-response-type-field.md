# [REQ-1] MenuResponse 补充 `type` 字段（区分 GROUP / MENU / DIVIDER）

> 前端（semgravio-admin-web）→ 后端（semgravio-admin）需求。按 Matt issue 规范提交到后端仓库。

## 背景
统一后台前端 sidebar 采用「双面板」交互：一级图标栏（分组）+ 二级菜单面板（叶子菜单）。前端需按 `/auth/current` 返回的 `menus` 树渲染，但当前 `MenuResponse` 没有 `type` 字段，前端无法区分一个节点是**分组容器**、**可路由叶子菜单**、还是**分隔线**，无法正确渲染双面板层级。

## 现状
`MenuResponse`（`application/dto/response/MenuResponse.java`）字段：
```
id, name, path, icon, parentId, sortOrder, children[]
```
领域层已有 `MenuType` 枚举（MENU / GROUP / DIVIDER），但 Response 未暴露。

## 需求
在 `MenuResponse` 增加 `type` 字段：
- 类型：`MenuType` 枚举，序列化为**整数 code**（与 `status` 等其他枚举一致，走 `BaseEnumSerializer`）
- 取值：`GROUP`=分组容器（一级）/ `MENU`=可路由叶子菜单 / `DIVIDER`=分隔线
- 填充：从 `AdminMenu` 聚合的 `type` 字段映射（领域已有）

## 验收标准
- [ ] `GET /menus` 与 `GET /auth/current` 返回的每个 `MenuResponse` 节点含 `type` 字段（整数）
- [ ] `type` 值与节点语义一致（分组=GROUP、叶子菜单=MENU、分隔线=DIVIDER）
- [ ] 种子数据（用户管理等）的 `type` 值正确
- [ ] 前端拿到后能据 `type` 渲染「一级分组 / 二级菜单 / 分隔线」

## 对前端的影响（解锁）
- sidebar 读后端真 menus 并按 `type` 渲染双面板（替代当前硬编码）
- 菜单管理页树形 CRUD 的分层展示

## 优先级
**高** —— 阻塞前端 sidebar 真数据对接与菜单管理页。

## 职责
前端定义需求（本 issue）→ 后端实现（补字段 + 填充 + 种子数据）→ 前端对接渲染。
