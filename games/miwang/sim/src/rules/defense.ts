/** 守方的地区措施与经济：措施的档位、每天的预算收支、公众信任；应急队、疫苗分配、发布会 */
import { clamp } from '@rune-engine/core';
import {
  MAX_LEVEL,
  measureLevel,
  MEASURES,
  VACCINE_POLICIES,
  withMeasure,
  type DefenseStats,
  type Measure,
  type MeasureLevel,
  type OutbreakConfig,
} from '../config.ts';
import { alive, FOR_BOTH, report, type OutbreakState } from '../state.ts';
import type { DayTally } from './epidemic.ts';

/** 维持费按这个人口数为 1 倍 */
const UPKEEP_POPULATION = 50_000_000;

/** 一项措施在一个地区开到 level 档每天的维持费：按人口开方折算（大国贵，但不是按人头贵），有上下限 */
export function upkeepOf(
  config: OutbreakConfig,
  region: number,
  measure: Measure,
  level: MeasureLevel = MAX_LEVEL,
): number {
  const size = clamp(Math.sqrt(config.regions[region]!.population / UPKEEP_POPULATION), 0.15, 4);
  return config.rules.upkeep[measure] * size * (config.rules.levelCost[level] ?? 0);
}

/** 把一项措施从 from 档加到 level 档要预付的钱：加出来的那部分维持费的几天。往下降不要钱 */
export function setupCost(
  config: OutbreakConfig,
  region: number,
  measure: Measure,
  level: MeasureLevel = MAX_LEVEL,
  from: MeasureLevel = 0,
): number {
  const more = upkeepOf(config, region, measure, level) - upkeepOf(config, region, measure, from);
  return Math.max(0, more) * config.rules.setupDays;
}

/** 配合程度：措施的名义效果要乘上它。跟着信任走，维持费付不起时再打折 */
export function compliance(state: OutbreakState): number {
  const { complianceFloor } = state.config.rules;
  return (complianceFloor + (1 - complianceFloor) * state.trust) * state.funding;
}

const isLevel = (value: unknown): value is MeasureLevel =>
  value === 0 || value === 1 || value === 2 || value === 3;

/** 把一个地区的一项措施设到某一档；往上加时预付不起就不生效，往下降不要钱 */
export function setMeasure(
  state: OutbreakState,
  region: number,
  measure: Measure,
  level: MeasureLevel,
) {
  if (!Number.isInteger(region) || region < 0 || region >= state.measures.length) return;
  if (!isLevel(level)) return;
  const bits = state.measures[region]!;
  const current = measureLevel(bits, measure);
  if (current === level) return;
  const cost = setupCost(state.config, region, measure, level, current);
  if (state.budget < cost) return;
  state.budget -= cost;
  state.measures[region] = withMeasure(bits, measure, level);
}

/** 一次给好几个地区设同一项措施：按给的先后来，钱不够了后面的就不生效 */
export function setMeasures(
  state: OutbreakState,
  regions: readonly number[],
  measure: Measure,
  level: MeasureLevel,
) {
  if (!Array.isArray(regions) || regions.length > state.measures.length) return;
  for (const region of regions) setMeasure(state, region, measure, level);
}

/** 派一支应急队去一个地区（-1 是召回待命）：要走几天，到了才起作用 */
export function sendTeam(state: OutbreakState, team: number, region: number) {
  if (!Number.isInteger(team) || team < 0 || team >= state.teamRegion.length) return;
  if (!Number.isInteger(region) || region < -1 || region >= state.measures.length) return;
  if (state.teamRegion[team] === region) return;
  state.teamRegion[team] = region;
  state.teamArrives[team] = state.tick + state.config.rules.teamTravelDays;
}

/** 今天到达的应急队：记一条新闻（措施和队伍都是公开的，双方都知道） */
export function arriveTeams(state: OutbreakState) {
  for (let team = 0; team < state.teamRegion.length; team++) {
    const region = state.teamRegion[team]!;
    if (region >= 0 && state.teamArrives[team] === state.tick)
      report(state, 'team', FOR_BOTH, region);
  }
}

/** 疫苗先给谁 */
export function setPriority(state: OutbreakState, policy: unknown) {
  const index = VACCINE_POLICIES.indexOf(policy as (typeof VACCINE_POLICIES)[number]);
  if (index >= 0) state.priority = index;
}

/** 开发布会：花预算换信任；离上一次不够久、钱不够都开不了 */
export function holdBriefing(state: OutbreakState) {
  const { briefingCost, briefingTrust, briefingCooldown } = state.config.rules;
  if (state.tick < state.briefingReadyAt || state.budget < briefingCost) return;
  state.budget -= briefingCost;
  state.trust = clamp(state.trust + briefingTrust, 0, 1);
  state.briefingReadyAt = state.tick + briefingCooldown;
  report(state, 'briefing', FOR_BOTH);
}

/** 这个地区的经济还剩多少在运转：各项措施的损失相加，再扣掉病倒的人 */
function openness(state: OutbreakState, region: number, people: number): number {
  const { economyLoss, levelEffect } = state.config.rules;
  const bits = state.measures[region]!;
  let loss = 0;
  if (bits !== 0) {
    for (const measure of MEASURES) {
      loss += (economyLoss[measure] ?? 0) * (levelEffect[measureLevel(bits, measure)] ?? 0);
    }
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
    const bits = state.measures[r]!;
    if (bits === 0) continue;
    for (const measure of MEASURES) {
      const level = measureLevel(bits, measure);
      if (level > 0) upkeep += upkeepOf(state.config, r, measure, level);
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
 * 信任每天的变化：往基准线回一点；被封锁、要戴口罩的人口越多（管得越严）掉得越快；死亡越多掉得越快。
 */
export function updateTrust(state: OutbreakState, defense: DefenseStats, tally: DayTally) {
  const { regions, rules } = state.config;
  let locked = 0;
  let masked = 0;
  for (let r = 0; r < regions.length; r++) {
    const bits = state.measures[r]!;
    if (bits === 0) continue;
    // 管得越严越伤信任：按档位的成数算
    locked += regions[r]!.population * (rules.levelEffect[measureLevel(bits, 'lockdown')] ?? 0);
    masked += regions[r]!.population * (rules.levelEffect[measureLevel(bits, 'masks')] ?? 0);
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
