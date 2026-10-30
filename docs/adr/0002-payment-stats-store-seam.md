# Payment dashboard widgets consume a stats store, not endpoints directly

支付「统计概览」仪表盘的 8 个 widget（tier-1 overview/status-distribution/gateway-health/operations-audit + tier-2 by-business-system/by-channel/anomalies/operations-activity）经 `usePaymentStats`（composable 或 Pinia store）消费 admin-bff stats 端点，**widget 不直接 `fetch` 端点**。

这多一层在当前看似多余——store 现在只是透传 8 个 `/api/admin/payment/stats/**` 端点。但 admin-bff spec（[admin#38](https://github.com/ZhangColin/semgravio-admin/issues/38)）明确：「仪表盘 widget 不必与端点 1:1，日后可能跨服务聚合（payment / 钱包 / Token）」。store 是那道聚合 seam：未来要组合多服务数据时，只改 store、widget 不动。若让 widget 直连端点，会把「widget ↔ 端点」焊死、关上跨服务聚合的门——这正是未来读者看到「一个只透传的 store」会想拆掉它的地方，故记此 ADR 防回退。
