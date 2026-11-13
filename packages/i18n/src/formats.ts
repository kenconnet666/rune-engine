/** 跟着语言走的数字、日期写法。Intl 的格式化器建起来不便宜，每种语言只建一套 */
import { DateFormatter, parseDate } from '@internationalized/date';

/** 各项都是独立的函数（不依赖 this），可以单独拿出来传给别处 */
export interface Formats {
  /** 大数的简写：中文是 1.4亿、27.3万，英文是 1.4B、273K */
  readonly compact: (value: number) => string;
  /** 整数，带千位分隔 */
  readonly whole: (value: number) => string;
  /** 百分比，不带小数：0.42 → 42% */
  readonly percent: (value: number) => string;
  /** 保留一位小数的数：预算、每天的收支这类小额 */
  readonly amount: (value: number) => string;
  /** 'YYYY-MM-DD' → 这种语言的长日期（2026年11月13日、November 13, 2026） */
  readonly longDate: (date: string) => string;
}

const cache = new Map<string, Formats>();

/** tag 是 BCP 47 的语言标签（zh-CN、en） */
export function formatsFor(tag: string): Formats {
  const cached = cache.get(tag);
  if (cached) return cached;
  const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 });
  const amount = new Intl.NumberFormat(tag, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // 游戏里的日期没有时区：按 UTC 格式化，哪里的玩家看到的都是同一天
  const date = new DateFormatter(tag, { dateStyle: 'long', timeZone: 'UTC' });
  const formats: Formats = {
    compact: (value) => compact.format(value),
    whole: (value) => whole.format(value),
    percent: (value) => percent.format(value),
    amount: (value) => amount.format(value),
    longDate: (text) => date.format(parseDate(text).toDate('UTC')),
  };
  cache.set(tag, formats);
  return formats;
}
