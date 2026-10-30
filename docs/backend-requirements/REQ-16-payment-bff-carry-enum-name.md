# REQ-16：payment BFF 未透传枚举 `*Name`（statusName / payModeName …）→ 前端列表/详情/仪表盘显示原始 code

> 发现于：admin-web issue [#47](https://github.com/ZhangColin/semgravio-admin-web/issues/47) 仪表盘 T6（2026-08-12）
> 关联：平台统一枚举范式（SystemManage user/role/menu 均带后端序列化的 `statusName`）；payment 域枚举为 `BaseEnum(code, name)`
> 状态：**待后端处理**（2026-08-12 提后端 issue [#50](https://github.com/ZhangColin/semgravio-admin/issues/50)）

## 现象

payment 能力域的枚举（PaymentStatus / RefundStatus / PayMode / AccessType / PaymentChannel / AuditType /
OperationType / OperationLogTargetType）是 `BaseEnum(Integer code, String name)`。payment 经全局 Jackson
序列化为 **Integer code 的字符串**（如 `status: "5"`），线上实测：

```bash
curl -s -H "Authorization: Bearer $TOK" "http://localhost:8081/api/admin/payment/payments?page=0&size=1"
# => "status": "5"   （= EXPIRED 的 code；不是 "EXPIRED"，也不是中文名）
```

payment **同时**给出对应中文名（`statusName` 等）——其 v1 响应 DTO 明确携带：

- `PaymentOrderResponse(Integer status, String statusName, …, String paymentChannelName, …)`
- `StatusDistributionResponse.PaymentStatusBucket(Integer status, String statusName, long count, long amount)`
- `OperationLogResponse(Integer operation, String operationName, Integer targetType, String targetTypeName, …)`

但 **admin BFF 的 wire DTO 没有这些 `*Name` 字段**，Jackson 反序列化时丢弃：

- `PaymentOrderWireResponse(… String status, String payMode, String accessType, String paymentChannel …)` —— 无 `statusName / payModeName / accessTypeName / paymentChannelName`
- `OrderStatusDistributionWireResponse.StatusBucketWireResponse(String status, Long count, BigDecimal amount)` —— 无 `statusName`
- `OperationLogWireResponse(… String operation, String targetType …)` —— 无 `operationName / targetTypeName`

于是 admin 对前端下发**只有 code、没有中文名**。前端按平台统一范式（display backend `*Name`）展示时，
在 BFF 落地 `*Name` 前只能回退显示原始 code（如状态列显示 "5" 而非 "已过期"）。

## 受影响端点 / 字段

| 端点 | 缺失字段（payment wire 已给、admin 丢弃） |
| --- | --- |
| `GET /payments`、`GET /payments/{no}` | statusName、payModeName、accessTypeName、paymentChannelName |
| `GET /refunds`、`GET /refunds/{no}` | statusName、auditTypeName |
| `GET /stats/orders/status-distribution` | 各 StatusBucket.statusName（payment+refund） |
| `GET /operation-logs`、生命周期事件 | operationName、targetTypeName |

（`PaymentLog.logType`、`OperationLog.result` 是纯 String token、非枚举，不涉及。）

## 期望

admin BFF 把 payment wire 已提供的 `*Name` 透传到对前端的响应：

1. 各 wire DTO 增补对应 `*Name` 字段（从 payment v1 响应接收）；
2. 各 admin Response DTO + `toXxx()` 映射带上 `*Name`；
3. 前端展示即自动从 code 回退切换到中文名（displayEnumName：`name || $t(record[code]) || code`），零前端改动。

## 复现

```bash
TOK=$(curl -s -X POST localhost:8081/api/admin/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Hcy@2026","rememberMe":false}' | jq -r .data.token)
curl -s -H "Authorization: Bearer $TOK" "http://localhost:8081/api/admin/payment/stats/orders/status-distribution" | jq '.data.paymentStatuses[0]'
# { "status": "5", "count": "72", "amount": 7200 }   ← 无 statusName
```

## 备注

- 前端已按锁定契约（含 `*Name` 字段）全量建，并以既有 i18n record 兜底显示（过渡期也显示中文，
  与筛选下拉选项同源）。BFF 落地 `*Name` 后自动切到后端值为统一来源。
- 不要求 payment 侧改动（payment 已提供 `*Name`）；本 REQ 仅 admin BFF 透传层。
