/**
 * 界面上要显示的几个“规则里的数”：措施的价格、各档的成数、实验室的数量、发布会的代价。
 * 它们取决于地区的人口和规则里的数值，和种子、日期无关，所以拿一份参考配置来算就行。
 * 真正扣多少钱由主机里的模拟说了算；这里和它用的是同一份数据、同一个函数。
 */
import { createConfig } from '@miwang/content';
import {
  measureLevel,
  MEASURES,
  setupCost,
  upkeepOf,
  type Measure,
  type MeasureLevel,
} from '@miwang/sim';

// 不带世界条件：条件只改界面不直接显示的数，这里要的是默认规则
const reference = createConfig(0, '2000-01-01', { conditions: [] });

/** 规则里的数值（界面上写“全力的几成”“发布会要多少预算”时用） */
export const RULES = reference.rules;

/** 同时能进行几项研究 */
export const LABS = RULES.labs;

/** 把一项措施从 from 档设到 level 档：要预付多少、之后每天多少 */
export const measureCost = (
  region: number,
  measure: Measure,
  level: MeasureLevel,
  from: MeasureLevel = 0,
) => ({
  setup: setupCost(reference, region, measure, level, from),
  daily: upkeepOf(reference, region, measure, level),
});

/** 一组“各项措施设到第几档”：没写的那几项不动 */
export type MeasurePlan = Readonly<Partial<Record<Measure, MeasureLevel>>>;

/** 把一个地区现在的措施（那个数）写成一份完整的方案 */
export const planOf = (bits: number): MeasurePlan =>
  Object.fromEntries(MEASURES.map((measure) => [measure, measureLevel(bits, measure)]));

/**
 * 把一份方案用到几个地区：每项措施要改哪些地区、一共要预付多少、之后每天的维持费多出（或者省下）多少。
 * measures 是各地区现在的措施。已经是那一档的地区不用动。
 */
export function planChanges(
  plan: MeasurePlan,
  regions: readonly number[],
  measures: ArrayLike<number>,
) {
  let setup = 0;
  let daily = 0;
  const changes: { measure: Measure; level: MeasureLevel; regions: number[] }[] = [];
  for (const measure of MEASURES) {
    const level = plan[measure];
    if (level === undefined) continue;
    const touched = regions.filter(
      (region) => measureLevel(measures[region] ?? 0, measure) !== level,
    );
    if (touched.length === 0) continue;
    for (const region of touched) {
      const from = measureLevel(measures[region] ?? 0, measure);
      setup += setupCost(reference, region, measure, level, from);
      daily +=
        upkeepOf(reference, region, measure, level) - upkeepOf(reference, region, measure, from);
    }
    changes.push({ measure, level, regions: touched });
  }
  return { setup, daily, changes };
}
