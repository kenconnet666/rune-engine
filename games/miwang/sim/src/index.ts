/**
 * 《迷惘》的规则。现在是第一版骨架：按地区的易感、潜伏、发病、移出四个人群，
 * 沿陆路邻接与航线扩散；攻方强化病原体，守方在地区里采取措施。参数是为了跑通架构随手定的，不是任何真实疾病的数值。
 */
export { decide } from './ai.ts';
export { ATTACKER, COSTS, DEFENDER, MEASURE_BITS, outbreak } from './outbreak.ts';
export type {
  Command,
  Measure,
  OutbreakConfig,
  OutbreakState,
  OutbreakView,
  RegionConfig,
  Trait,
} from './types.ts';
