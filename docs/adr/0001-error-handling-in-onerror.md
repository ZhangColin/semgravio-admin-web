# 0001 — 业务错误处理走 axios onError（非 Soybean 的 onBackendFail）

后端约定 `ApiResponse.code` 即 HTTP 状态码本身（见 GLOSSARY.md「后端契约快照」），业务错（账密错、过期 token、权限不足等）以 **HTTP 非 2xx** 返回。而 Soybean 的请求层默认"HTTP 恒 200、成败看 `body.code`"，其 `onBackendFail`（成功拦截器内、仅 HTTP 2xx 时触发）对我们后端是**死代码**。

**决策**：后端 `message` 提取与 logoutCodes 处理统一放在 `onError`（error 拦截器），从 `error.response.data` 取 `{code,message}`；登录接口（`/auth/login`）的 401 视为账密错——只弹 toast，不触发自动登出（受保护接口的 401 才算会话过期）。**不改后端**：其 HTTP-status=code 是平台级约定、RESTful 正确、identity 等其它消费方共用（R2 审计已定调"UI 语义不泄漏到 API"，不动 envelope）。

**遗留**：会话过期（受保护接口 401）的自动登出尚未接（logoutCodes 原本在死代码 `onBackendFail` 里）——刷新页面可恢复（守卫 `initUserInfo` 失败 → `resetStore` → 登录页），待 follow-up 把 logoutCodes 也挪进 `onError`。
