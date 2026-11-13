/** 守方的地区措施与经济：开关措施、每天的预算收支、公众信任 */
import { clamp } from '@rune-engine/core';
import {
  MEASURE_BITS,
  MEASURES,
  type DefenseStats,
  type Measure,
  type OutbreakConfig,
} from '../config.ts';
import { alive, type OutbreakState } from '../state.ts';
import type { DayTally } from './epidemic.ts';

/** 维持费按这个人口数为 1 倍 */
const UPKEEP_POPULATION = 50_000_000;

/** 一项措施在一个地区每天的维持费：按人口开方折算（大国贵，但不是按人头贵），有上下限 */
export function upkeepOf(config: OutbreakConfig, region: number, measure: Measure): number {
  const size = clamp(Math.sqrt(config.regions[region]!.population / UPKEEP_POPULATION), 0.15, 4);
  return config.rules.upkeep[measure] * size;
}

/** 开一项措施要预付的钱 */
export function setupCost(config: OutbreakConfig, region: number, measure: Measure): number {
  return upkeepOf(config, region, measure) * config.rules.setupDays;
}

/** 配合程度：措施的名义效果要乘上它。跟着信任走，维持费付不起时再打折 */
export function compliance(state: OutbreakState): number {
  const { complianceFloor } = state.config.rules;
  return (complianceFloor + (1 - complianceFloor) * state.trust) * state.funding;
}

/** 开或关一个地区的一项措施；开的时候预付不起就不生效，关不要钱 */
export function setMeasure(state: OutbreakState, region: number, measure: Measure, on: boolean) {
  if (!Number.isInteger(region) || region < 0 || region >= state.measures.length) return;
  const bit = MEASURE_BITS[measure];
  const active = (state.measures[region]! & bit) !== 0;
  if (active === on) return;
  if (!on) {
    state.measures[region]! &= ~bit;
    return;
  }
  const cost = setupCost(state.config, region, measure);
  if (state.budget < cost) return;
  state.budget -= cost;
  state.measures[region]! |= bit;
}

/** 这个地区的经济还剩多少在运转：各项措施的损失相加，再扣掉病倒的人 */
function openness(state: OutbreakState, region: number, people: number): number {
  const { economyLoss } = state.config.rules;
  let loss = 0;
  for (const measure of MEASURES) {
    if ((state.measures[region]! & MEASURE_BITS[measure]) !== 0) loss += economyLoss[measure] ?? 0;
  }
  const working = people > 0 ? 1 - state.infectious[region]! / people : 0;
  return clamp(1 - loss, 0, 1) * working;
}

/** 守方这一天能收多少、要付多少维持费（不改状态；界面上显示每天的净收入也用它） */
export function dailyBalance(state: OutbreakState): { income: number; upkeep: number } {
  const { regions, rules } = state.config;
  let income = 0;
  let upkeep = 0;
  for (let r = 0; r < regions.length; r++) {
    const region = regions[r]!;
    const people = alive(state, r);
    // 死去的人不再有产出：按活着的人占开局人口的比例算
    const share = region.population > 0 ? people / region.population : 0;
    income += region.economy * share * openness(state, r, people);
    if (state.measures[r] === 0) continue;
    for (const measure of MEASURES) {
      if ((state.measures[r]! & MEASURE_BITS[measure]) !== 0) {
        upkeep += upkeepOf(state.config, r, measure);
      }
    }
  }
  return { income: income * rules.budgetPerDay, upkeep };
}

/**
 * 一天的收支：各地区的经济贡献预算，措施收维持费。
 * 付不起维持费时不强行关措施，而是明天所有措施的效果按付得起的比例打折（funding）。
 */
export function settleEconomy(state: OutbreakState) {
  const { income, upkeep } = dailyBalance(state);
  state.economyLost += state.config.rules.budgetPerDay - income;
  const available = state.budget + income;
  if (available >= upkeep) {
    state.budget = available - upkeep;
    state.funding = 1;
  } else {
    state.budget = 0;
    state.funding = upkeep > 0 ? available / upkeep : 1;
  }
}

/**
 * 信任每天的变化：往基准线回一点；被封锁、要戴口罩的人口越多掉得越快；死亡越多掉得越快。
 */
export function updateTrust(state: OutbreakState, defense: DefenseStats, tally: DayTally) {
  const { regions, rules } = state.config;
  let locked = 0;
  let masked = 0;
  for (let r = 0; r < regions.length; r++) {
    const bits = state.measures[r]!;
    if (bits === 0) continue;
    if ((bits & MEASURE_BITS.lockdown) !== 0) locked += regions[r]!.population;
    if ((bits & MEASURE_BITS.masks) !== 0) masked += regions[r]!.population;
  }
  const world = state.worldPopulation;
  const shock = clamp(tally.deaths / (world * rules.trustDeathScale), 0, 1);
  const baseline = clamp(rules.trustBaseline + defense.trust, 0, 1);
  state.trust = clamp(
    state.trust +
      (baseline - state.trust) * rules.trustRecovery -
      (rules.trustLockdown * locked) / world -
      (rules.trustMasks * masked) / world -
      rules.trustDeaths * shock,
    0,
    1,
  );
}
