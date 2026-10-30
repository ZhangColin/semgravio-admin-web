# REQ-17：payment 统计 3 端点（overview/gateway-health/operations-audit）BFF 未转发必填 `from/to` → 400

> 发现于：admin-web issue [#47](https://github.com/ZhangColin/semgravio-admin-web/issues/47) 仪表盘 T6（2026-08-12）
> 关联：admin T7 stats tier-1（`.scratch/payment-admin/issues/T7-stats-tier1.md`）；payment `StatsApiV1Controller`
> 状态：**待后端处理**（2026-08-12 提后端 issue [#51](https://github.com/ZhangColin/semgravio-admin/issues/51)）

## 现象

仪表盘 tier-1 四块中，三块端点对前端返回 **HTTP 400 "Invalid request"**，仅 `status-distribution` 正常：

```bash
TOK=$(… login …)
for ep in "stats/payments/overview" "stats/orders/status-distribution" "stats/gateway/health" "stats/operations/audit"; do
  printf "%-40s " "$ep"
  curl -s -H "Authorization: Bearer $TOK" "http://localhost:8081/api/admin/payment/$ep" | jq -c '{code,message}'
done
# stats/payments/overview        {"code":400,"message":"Invalid request"}
# stats/orders/status-distribution {"code":200,"message":"Success"}
# stats/gateway/health           {"code":400,"message":"Invalid request"}
# stats/operations/audit         {"code":400,"message":"Invalid request"}
```

## 根因

payment `StatsApiV1Controller` 的三个端点把 `from`/`to` 声明为**必填** `@RequestParam`：

```java
@GetMapping("/payments/overview")
public ApiResponse<PaymentOverviewResponse> overview(
    @RequestParam @DateTimeFormat(iso = ISO.DATE_TIME) LocalDateTime from,
    @RequestParam @DateTimeFormat(iso = ISO.DATE_TIME) LocalDateTime to,
    @RequestParam(required = false) StatsGranularity granularity) { … }
// gatewayHealth(from, to) 与 operationsAudit(from, to) 同样 from/to 必填
```

而 admin `PaymentClient` 调用它们时**不带任何 query 参数**：

```java
public PaymentOverviewWireResponse getPaymentOverview() {
    String url = baseUrl + "/api/v1/stats/payments/overview";   // 无 from/to
    ApiResponse<PaymentOverviewWireResponse> resp = openApiClient.get(url, PAYMENT_OVERVIEW_TYPEREF);
    return resp.data();
}
// getGatewayHealth() / getOperationsAudit() 同样无参 GET
```

payment 因缺必填 `from`/`to` 返回 400 → admin `translatePaymentError` 翻译为「Invalid request」。
`statusDistribution()` 无参、故正常。

admin 对前端的三个 controller 端点本身也不收参（`getPaymentOverview()` 无参），**前端无法绕过**。

## 期望

admin BFF 为这三个统计端点提供时间窗（任选其一，建议 a）：

- **(a) BFF 内置默认窗口**（推荐）：admin 调 payment 时补默认 `from`/`to`（如近 30 天 / 近 7 天），
  对前端端点保持无参——仪表盘 tier-1 是全局快照、前端不暴露时间筛选（spec user story 22–27 无时间维度）。
- (b) admin 端点接收可选 `from`/`to`/`granularity` 并透传 payment；前端仪表盘加时间窗控件（超出 tier-1 范围）。

## 复现

见上 `for ep` 循环；三个端点均 `{"code":400,…}`，payment 侧日志为缺必填参数。

## 备注

- 前端已按锁定契约全量建 4 块 widget；这 3 块对 400 走降级态（loading/error），BFF 修复后自动出数，零前端改动。
- `status-distribution` 不受影响（无时间窗），已能端到端出数。
