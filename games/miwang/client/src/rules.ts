/**
 * 界面上要显示的几个“规则里的数”：措施的价格、实验室的数量。
 * 它们取决于地区的人口和规则里的数值，和种子、日期无关，所以拿一份参考配置来算就行。
 * 真正扣多少钱由主机里的模拟说了算；这里和它用的是同一份数据、同一个函数。
 */
import { createConfig } from '@miwang/content';
import { setupCost, upkeepOf, type Measure } from '@miwang/sim';

const reference = createConfig(0, '2000-01-01');

/** 开一项措施要预付多少、之后每天多少 */
export const measureCost = (region: number, measure: Measure) => ({
  setup: setupCost(reference, region, measure),
  daily: upkeepOf(reference, region, measure),
});

/** 同时能进行几项研究 */
export const LABS = reference.rules.labs;
