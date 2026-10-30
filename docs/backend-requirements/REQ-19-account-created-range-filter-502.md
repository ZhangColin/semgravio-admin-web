# REQ-19：account 列表 createdFrom/createdTo 契约内 date-time 透传 502

由 admin-web [#52](https://github.com/ZhangColin/semgravio-admin-web/issues/52)（平台账号 E2E 联调）发现提出。

## 现象

`GET /api/admin/accounts` 带 `createdFrom`/`createdTo` 时 BFF 返回 **502**（其余五个筛选字段全部正常）：

```
GET /api/admin/accounts?createdFrom=2026-08-07T00%3A00%3A00&createdTo=2026-08-08T00%3A00%3A00&page=1&size=10

{"code":502,"message":"Third-party service error: {0}","data":null,"requestId":"52fba654-c745-4268-9fec-4ae9085602f4","errors":null}
```

502 = BFF 调下游 identity 抛异常被兜底。对照 api-docs（`AccountQuery.createdFrom: string, format: date-time`），以下**契约内取值均 502**，稳定复现：

| 取值 | 结果 |
|---|---|
| `2026-08-07T00:00:00`（ISO 本地，带秒） | 502 |
| `2026-08-07T00:00`（不带秒） | 502 |
| `2026-08-07`（纯日期） | 400 typeMismatch（合理拒绝，非契约内） |

契约内格式全军覆没、契约外格式正常 400——说明**北向绑定没问题，炸在 BFF→identity 透传或 identity 侧解析**。

## 影响

平台账号列表「注册时间区间」筛选不可用（六字段筛选缺一角）。前端发送格式与 payment 域时间筛选同形（`YYYY-MM-DDTHH:mm:ss`，NDatePicker datetimerange 产出），payment 域时间区间正常——问题独见于 account 链路。

## 需求

修复 `createdFrom`/`createdTo` 的 BFF→identity 透传，使契约内 `date-time` 取值正常过滤（`createdAt` 含两端）。修复侧在 BFF 还是 identity 由 admin 侧定位后定夺；若根因在 identity，请向 identity 仓转提。

## 复现环境（2026-09-16 联调）

- admin :8081 / identity :10001 均 local profile；admin 含 V14 菜单 seed，REQ-18（全链 1-based）已落地。
- identity 库 `act_account` 含 `created_at=2026-08-07 22:53:03` 的行（测试账号 18001828301），上述区间应命中。
