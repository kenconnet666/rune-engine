/**
 * 过线的格式：Decimal、bigint、日历日期这些值过不了 JSON，过线程边界（结构化克隆）时类的身份也会丢。
 * 存档、发消息之前用 toWire 换成带标记的普通对象，收到之后用 fromWire 换回来。
 *
 *   toWire({ cost: new Decimal('0.1'), day: parseDate('2026-11-13') })
 *   // { cost: { $decimal: '0.1' }, day: { $date: '2026-11-13' } }
 *
 * 数值数组（TypedArray）原样通过：结构化克隆本来就支持它们，还能零拷贝转移。
 */
import { CalendarDate, parseDate } from '@internationalized/date';
import Decimal from 'decimal.js';

/** 把值里的 Decimal、bigint、日历日期换成带标记的普通对象（深层，返回新对象） */
export function toWire(value: unknown): unknown {
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (typeof value !== 'object' || value === null) return value;
  if (Decimal.isDecimal(value)) return { $decimal: value.toString() };
  if (value instanceof CalendarDate) return { $date: value.toString() };
  if (ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return value.map(toWire);
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = toWire(item);
  return out;
}

/** toWire 的反向：把带标记的对象换回 Decimal、bigint、日历日期 */
export function fromWire(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return value.map(fromWire);
  const record = value as Record<string, unknown>;
  if (typeof record.$decimal === 'string') return new Decimal(record.$decimal);
  if (typeof record.$bigint === 'string') return BigInt(record.$bigint);
  if (typeof record.$date === 'string') return parseDate(record.$date);
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) out[key] = fromWire(item);
  return out;
}
