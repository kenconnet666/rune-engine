/**
 * 内核原生支持的数值：number、bigint 与 decimal.js 的 Decimal。
 * 人数、资源这类要精确或会很大的量可以直接用 Decimal：它的运算是纯整数算出来的，任何引擎上逐位一致。
 *
 *   compareNumeric(new Decimal('1.5'), 1.25)   // 1：不同类型也按大小比
 *   numericText(new Decimal('1e21'))           // '1000000000000000000000'
 */
import Decimal from 'decimal.js';

/** 内核接受的数值 */
export type Numeric = number | bigint | Decimal;

/** 是不是 decimal.js 的 Decimal（含 Decimal.clone 出来的构造函数的实例） */
export function isDecimal(value: unknown): value is Decimal {
  return Decimal.isDecimal(value);
}

/** 是不是内核接受的数值 */
export function isNumeric(value: unknown): value is Numeric {
  return typeof value === 'number' || typeof value === 'bigint' || isDecimal(value);
}

/** 转成 Decimal：之后的运算不丢精度 */
export function toDecimal(value: Numeric): Decimal {
  return isDecimal(value) ? value : new Decimal(numericText(value));
}

/** 转成 number：只给需要浮点数的地方用（画面上的位置、颜色、动画），会丢精度 */
export function toNumber(value: Numeric): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return value.toNumber();
}

/** 十进制文本，不用科学计数法：存档、显示前的格式化都从它出发 */
export function numericText(value: Numeric): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    // 1e21 以上的整数 String() 会写成科学计数法：经 BigInt 写出完整的十进制
    if (Number.isInteger(value))
      return Math.abs(value) >= 1e21 ? String(BigInt(value)) : String(value);
    return new Decimal(value).toFixed();
  }
  return value.isFinite() ? value.toFixed() : value.toString();
}

/** 按大小比较两个数值，不同类型混着也行：返回负数、0 或正数；有 Decimal 时按十进制精确比较 */
export function compareNumeric(a: Numeric, b: Numeric): number {
  if (isDecimal(a) || isDecimal(b)) return toDecimal(a).cmp(toDecimal(b));
  // number、bigint 之间：关系运算符对混合类型按数学值比较，不丢精度
  return a < b ? -1 : a > b ? 1 : 0;
}
