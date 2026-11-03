import dayjs from 'dayjs';
import { $t } from '@/locales';

/**
 * Format a backend datetime string for display.
 *
 * 后端返回无时区后缀的 ISO 串（Java `LocalDateTime` 序列化，墙上时钟北京时间，
 * 如 `2026-08-03T23:52:54.587222`）。按北京时间原样处理——**不做时区转换**，
 * dayjs 直接 format（dayjs 能正确解析 6 位微秒）。
 *
 * `null` / 空串 / 非法日期 → 返回 `'-'`（沿用现有占位约定）。
 *
 * @param value datetime 字符串，可空
 * @param fmt dayjs format token，默认 `YYYY-MM-DD HH:mm:ss`
 */
export function formatDateTime(value?: string | null, fmt: string = 'YYYY-MM-DD HH:mm:ss') {
  if (!value) return '-';
  const d = dayjs(value);
  if (!d.isValid()) return '-';
  return d.format(fmt);
}

/**
 * Serialize a picker timestamp as an ISO-8601 Instant UTC string (second precision, trailing `Z`).
 *
 * 成本域时间窗契约（admin #67 拍板）：from/to 必填、ISO-8601 Instant **UTC 带 Z**（如
 * `2026-09-01T00:00:00Z`）、半开 `[from, to)` 直传零调整。与各筛选条的 tsToIso（本地串、
 * 无 Z）是**两种契约形**——本函数是 UTC 形的唯一实现（tsToIso 家族第 8 份拷贝起收编于此，
 * 后续 UTC Instant 端点复用）。秒精度切片对齐契约示例（截断毫秒，`to` 端影响 <1s）。
 *
 * @param ts 毫秒时间戳（NDatePicker value）
 */
export function tsToUtcInstant(ts: number): string {
  return `${new Date(ts).toISOString().slice(0, 19)}Z`;
}

/**
 * Serialize a picker timestamp as an ISO-8601 **local** string (no timezone suffix).
 *
 * 订单/项目/合同等筛选条创建时间区间的契约形（BFF `@DateTimeFormat(iso = DATE_TIME)`
 * `LocalDateTime`）：闭区间含两端、本地串无 Z（如 `2026-09-01T00:00:00`）——与
 * tsToUtcInstant（成本域 UTC 带 Z）是**两种契约形**勿混用。tsToIso 家族第 8 份拷贝
 * （#87 合同筛选条）起收编于此；存量域内拷贝（order/project/payment）留待各域顺路迁移。
 *
 * @param ts 毫秒时间戳（NDatePicker value）
 */
export function tsToIsoLocal(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DDTHH:mm:ss');
}

/**
 * Format a money amount (integer cents) for display as `¥1,234.56`.
 *
 * payment 域金额单位为**整数分**（`Long`，北向 JSON 为 **string**——框架全局 Long→ToStringSerializer，
 * admin BFF 同型透传，ADR-0011），故统一 `Number()` 显式转换后 ÷100 展示：
 * 千分位 + 2 位小数 + `¥` 前缀。列表 / 详情 / 仪表盘共用，保证金额展示一致。
 *
 * `null` / 空串 / 非数 → 返回 `'-'`（沿用占位约定）。
 *
 * @param cents 整数分（**string** 为契约正形，number 兼容），可空
 */
export function formatMoney(cents?: number | string | null): string {
  if (cents === null || cents === undefined || cents === '') return '-';
  const n = Number(cents);
  if (Number.isNaN(n)) return '-';
  return `¥${(n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a byte count for display (`512 B` / `1.82 KB` / `5 MB`).
 *
 * aiplatform 文件树 `size` 为 Long（字节）→ JSON **字符串**（同全局 Long 序列化口径），
 * `Number()` 兜底后按二进制 1024 折算，1 位小数（整数值不带小数点）。
 *
 * `null` / 空串 / 非数 / 负数 → `'-'`（沿用占位约定）。
 *
 * @param bytes 字节 size（**string** 为契约正形，number 兼容），可空
 */
export function formatFileSize(bytes?: number | string | null): string {
  if (bytes === null || bytes === undefined || bytes === '') return '-';
  const n = Number(bytes);
  if (Number.isNaN(n) || n < 0) return '-';
  let value = n;
  let unit = 'B';
  for (const next of ['KB', 'MB', 'GB']) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  const text = unit === 'B' ? `${value}` : value.toFixed(Number.isInteger(value) ? 0 : 1);
  return `${text} ${unit}`;
}

/**
 * Format a 0–1 decimal rate as a percentage string (`95.60%`).
 *
 * payment 统计的比率（successRate / approvalRate）线上为 **小数 0–1 区间**（BigDecimal → number，
 * 见 Api.Payment 各 stats 类型注释），展示统一 ×100 + 2 位小数 + `%`。
 *
 * `null` / 非数 → `'-'`（沿用占位约定）。
 *
 * @param rate 0–1 区间小数（number 或字符串），可空
 */
export function formatRate(rate?: number | string | null): string {
  if (rate === null || rate === undefined || rate === '') return '-';
  const n = Number(rate);
  if (Number.isNaN(n)) return '-';
  return `${(n * 100).toFixed(2)}%`;
}

/**
 * Format a Long-as-string count for display (`72` / `1,234`).
 *
 * payment 统计的笔数字段为 Long → JSON **字符串**（见 Api.Payment 各 stats 类型注释），
 * 展示经 `Number()` 兜底 + 千分位。
 *
 * `null` / 非数 → `'-'`。
 *
 * @param count Long 序列化的字符串（或 number），可空
 */
export function formatCount(count?: number | string | null): string {
  if (count === null || count === undefined || count === '') return '-';
  const n = Number(count);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('zh-CN');
}

/**
 * Format a by-currency cost bucket amount for display (`USD 12.34` / `1,234.5`).
 *
 * aiplatform 成本域 `cost` 桶值为 swagger **number 直读**（BigDecimal 聚合和，可能带多位小数）——
 * 与订单金额的 Long 分口径**有意不同**：**不做 ÷100 换算**（勿套 formatMoney）。
 * 千分位 + 去尾零（`toLocaleString` 自带），小数上限 8 位（单价表微小价位聚合后仍有意义的最小粒度，
 * 超出部分呈现价值趋零——容忍四舍五入）。
 *
 * `null` / 非数 → `'-'`（沿用占位约定）。
 *
 * @param amount 币种桶金额（number 直读），可空
 */
export function formatCostAmount(amount?: number | null): string {
  if (amount === null || amount === undefined) return '-';
  if (Number.isNaN(amount)) return '-';
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 8 });
}

/**
 * Trigger a browser download for an in-memory blob.
 *
 * 二进制流端点（订单源码包 / 项目文件包 tar.gz，无 ApiResponse 信封）取回 Blob 后的统一
 * 落盘动作：objectURL → 隐藏 anchor click → revoke 收口。文件名由调用方解析
 * （服务端 Content-Disposition 优先，端侧兜底——#57 review ⑤ 先例）。
 *
 * @param blob 二进制响应体
 * @param filename 已解析的下载文件名
 */
export function saveBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Transform record to option
 *
 * @example
 *   ```ts
 *   const record = {
 *     key1: 'label1',
 *     key2: 'label2'
 *   };
 *   const options = transformRecordToOption(record);
 *   // [
 *   //   { value: 'key1', label: 'label1' },
 *   //   { value: 'key2', label: 'label2' }
 *   // ]
 *   ```;
 *
 * @param record
 */
export function transformRecordToOption<T extends Record<string, string>>(record: T) {
  return Object.entries(record).map(([value, label]) => ({
    value,
    label
  })) as CommonType.Option<keyof T, T[keyof T]>[];
}

/**
 * Translate options
 *
 * @param options
 */
export function translateOptions(options: CommonType.Option<string, App.I18n.I18nKey>[]) {
  return options.map(option => ({
    ...option,
    label: $t(option.label)
  }));
}

/**
 * Toggle html class
 *
 * @param className
 */
export function toggleHtmlClass(className: string) {
  function add() {
    document.documentElement.classList.add(className);
  }

  function remove() {
    document.documentElement.classList.remove(className);
  }

  return {
    add,
    remove
  };
}
