/** 界面上数字、日期的写法，各个面板共用 */
import { DateFormatter, parseDate } from '@internationalized/date';
import { createConfig } from '@miwang/content';
import { setupCost, upkeepOf, type Measure } from '@miwang/sim';

const dateFormat = new DateFormatter('zh-CN', { dateStyle: 'long', timeZone: 'UTC' });

/** 'YYYY-MM-DD' → “2026年11月13日” */
export const longDate = (date: string) => dateFormat.format(parseDate(date).toDate('UTC'));

/** 大数：1.4亿、27.3万 */
export const compact = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
export const whole = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
export const percent = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  maximumFractionDigits: 0,
});
/** 小额的预算：保留一位小数 */
export const amount = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * 只用来在界面上算措施的价格：价格取决于地区的人口和规则里的数值，和种子、日期无关。
 * 真正扣多少钱由主机里的模拟说了算；这里和它用的是同一份数据、同一个函数。
 */
const reference = createConfig(0, '2000-01-01');

/** 开一项措施要预付多少、之后每天多少 */
export const measureCost = (region: number, measure: Measure) => ({
  setup: setupCost(reference, region, measure),
  daily: upkeepOf(reference, region, measure),
});

/** 同时能进行几项研究 */
export const LABS = reference.rules.labs;
