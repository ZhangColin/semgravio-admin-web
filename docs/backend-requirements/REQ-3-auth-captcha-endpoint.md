# [REQ-3] `/auth/captcha` 端点占位未实现（调用 404）

> 前端（semgravio-admin-web）→ 后端（semgravio-admin）需求。低优先级。

## 现状
`/api/admin/auth/captcha` 已列在 `application.yml` 的 Sa-Token `exclude-path-patterns`（放行名单）里，但后端无任何 Controller 实现（`AdminAuthController` 只有 `login`/`logout`/`current`/`current/password` 四个端点）。前端调用会 **404**。

## 影响
- **当前**：前端登录流程**不调用** captcha，**不影响**对接。
- **未来**：若前端登录要加图形验证码，需后端先实现该端点（生成验证码图 + 校验）。

## 需求（低优先级，可延后）
二选一：
1. **实现 captcha 端点**：`GET /api/admin/auth/captcha` 返回验证码图（base64）+ captchaId；登录时 `AdminUserLoginCommand` 增加 captchaId/captcha 字段校验。
2. **或移除占位**：若短期不做验证码，从放行名单移除该路径，避免误导。

## 优先级
**低** —— 前端当前不调，不阻塞对接。后续加验证码时再处理。
