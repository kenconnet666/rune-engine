/** 一个地区当下的条件：季节、措施有没有开、发现率——传播、出行、研究几条规则都要用 */
import { clamp, lerp } from '@rune-engine/core';
import {
  COLD,
  MEASURE_BITS,
  TROPICAL,
  type DefenseStats,
  type Measure,
  type PathogenStats,
} from '../config.ts';
import type { OutbreakState } from '../state.ts';

/** 冬至在一年里的第几天（北半球，一月中） */
const MIDWINTER = 15;
const YEAR = 365;

/**
 * 一个地区现在有多“冬天”：冬至是 1，夏至是 -1，中间按直线走（不用三角函数：不同引擎算出来的不一样）。
 * 热带没有四季，恒为 0；南半球和北半球相反。
 */
export function winter(state: OutbreakState, region: number): number {
  const config = state.config.regions[region]!;
  if (config.climate === TROPICAL) return 0;
  const day = (state.startYearDay + state.tick - MIDWINTER + YEAR * 4) % YEAR;
  const x = day / YEAR;
  const north = (x < 0.5 ? 1 - 2 * x : 2 * x - 1) * 2 - 1;
  return config.south ? -north : north;
}

/** 一个地区的措施（按位）里某一项开着没有 */
export const measureOn = (bits: number, measure: Measure): boolean =>
  (bits & MEASURE_BITS[measure]) !== 0;

export function hasMeasure(state: OutbreakState, region: number, measure: Measure): boolean {
  return measureOn(state.measures[region]!, measure);
}

/**
 * 一项措施打完折剩下的比例：没开是 1，开了是 1 − 效果 × 配合程度。
 * bits 是那个地区的措施；传 0 就是“假如一项都没开”（算措施一共压掉了多少时用）
 */
export function after(bits: number, measure: Measure, effect: number, comply: number): number {
  return measureOn(bits, measure) ? 1 - effect * comply : 1;
}

/** 按富裕程度查表；国际援助把低于中等（2）的地区往中等的数值拉 */
export function effectiveWealth(table: readonly number[], wealth: number, aid: number): number {
  const own = table[wealth] ?? 0;
  return wealth < 2 ? lerp(own, table[2] ?? own, clamp(aid, 0, 1)) : own;
}

/** 病原体在这个地区的气候里有多适应：档案里的适宜程度，耐寒、耐热把不足的部分补回来 */
export function climateFit(state: OutbreakState, region: number, pathogen: PathogenStats): number {
  const { climate } = state.config.regions[region]!;
  const fit = state.config.pathogen.climate[climate] ?? 1;
  if (climate === TROPICAL) return lerp(fit, 1, pathogen.heat);
  if (climate === COLD) return lerp(fit, 1, pathogen.cold);
  return fit;
}

/** 这个地区的一个发病者被发现并上报的概率 */
export function detectionIn(
  state: OutbreakState,
  region: number,
  pathogen: PathogenStats,
  defense: DefenseStats,
  comply: number,
  bits: number = state.measures[region]!,
): number {
  const { rules, regions } = state.config;
  const base =
    effectiveWealth(rules.detectByWealth, regions[region]!.wealth, defense.aid) +
    rules.detectPerSeverity * pathogen.severity -
    rules.detectPerStealth * pathogen.stealth +
    defense.detection +
    (measureOn(bits, 'testing') ? rules.testingDetect * comply : 0);
  const struck = state.disasterUntil[region]! > state.tick ? rules.disasterCare : 1;
  return clamp(base * struck, rules.detectMin, rules.detectMax);
}
