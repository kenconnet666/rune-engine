/** 守方的研究：科技的效果、开始一项研究、每天推进、疫苗接种 */
import {
  DEFENSE_KEYS,
  VACCINE_POLICIES,
  type DefenseStats,
  type PathogenStats,
} from '../config.ts';
import {
  alive,
  FOR_BOTH,
  report,
  TECH_ACTIVE,
  TECH_DONE,
  TECH_IDLE,
  type OutbreakState,
} from '../state.ts';
import { modifier } from './modifiers.ts';
import { effectiveWealth } from './regional.ts';

/** 做完的科技的效果之和 */
export function defenseStats(state: OutbreakState): DefenseStats {
  const stats = Object.fromEntries(DEFENSE_KEYS.map((key) => [key, 0])) as DefenseStats;
  const { techs } = state.config;
  for (let index = 0; index < techs.length; index++) {
    if (state.techs[index] !== TECH_DONE) continue;
    for (const key of DEFENSE_KEYS) stats[key] += techs[index]!.effects[key] ?? 0;
  }
  return stats;
}

/** 还没开始、而且前置全部做完 */
export function canResearch(state: OutbreakState, index: number): boolean {
  const tech = state.config.techs[index];
  if (!tech || state.techs[index] !== TECH_IDLE) return false;
  return tech.requires.every((id) => state.techs[state.techIndex.get(id) ?? -1] === TECH_DONE);
}

/** 正在进行的研究有几项 */
export function activeResearch(state: OutbreakState): number {
  let count = 0;
  for (const status of state.techs) if (status === TECH_ACTIVE) count++;
  return count;
}

/** 开始一项研究：预算一次付清；前置没做完、实验室占满、钱不够都不生效 */
export function startResearch(state: OutbreakState, id: string) {
  const index = state.techIndex.get(id);
  if (index === undefined || !canResearch(state, index)) return;
  const tech = state.config.techs[index]!;
  if (activeResearch(state) >= state.config.rules.labs || state.budget < tech.cost) return;
  state.budget -= tech.cost;
  state.techs[index] = TECH_ACTIVE;
  state.techRemaining[index] = tech.days;
}

/** 每天推进进行中的研究；带疫苗进度的研究被抗原漂移拖慢 */
export function advanceResearch(state: OutbreakState, pathogen: PathogenStats) {
  const { techs, rules } = state.config;
  const vaccinePace = 1 / (1 + rules.driftVaccineDelay * pathogen.drift);
  for (let index = 0; index < techs.length; index++) {
    if (state.techs[index] !== TECH_ACTIVE) continue;
    const tech = techs[index]!;
    state.techRemaining[index]! -= tech.effects.vaccine ? vaccinePace : 1;
    if (state.techRemaining[index]! > 0) continue;
    state.techRemaining[index] = 0;
    state.techs[index] = TECH_DONE;
    report(state, 'research', FOR_BOTH, -1, tech.id);
    if (tech.effects.trace) report(state, 'traced', FOR_BOTH, state.config.origin);
    if (tech.effects.vaccine && vaccineReady(state, defenseStats(state))) {
      report(state, 'vaccine', FOR_BOTH);
    }
  }
}

export function vaccineReady(state: OutbreakState, defense: DefenseStats): boolean {
  return defense.vaccine >= state.config.rules.vaccineStages;
}

/** 上报的在病人数占人口到这个比例，就算“疫情重的地方”（疫苗优先给热点时用） */
const HOTSPOT_SHARE = 2e-4;

/**
 * 疫苗量产之后每天接种：各地区按富裕程度（援助会把穷地区往上拉）把一部分易感者变成免疫者。
 * 疫苗分配决定偏向谁：被优先的地区速度是别处的 priorityBoost 倍，然后整体按比例缩回去——
 * 一天能打的总量和不偏向谁时大致一样，变的是分给谁。
 */
export function vaccinate(state: OutbreakState, defense: DefenseStats, comply: number) {
  if (!vaccineReady(state, defense)) return;
  const { regions, rules } = state.config;
  const policy = VACCINE_POLICIES[state.priority] ?? 'even';
  const count = regions.length;
  // 临时的修正：有人不肯打、强制接种……
  const shift = Math.max(0, 1 + modifier(state, 'rollout'));
  const pace = new Float64Array(count);
  let plain = 0;
  let weighted = 0;
  for (let r = 0; r < count; r++) {
    const people = alive(state, r);
    if (people <= 0 || state.susceptible[r]! <= 0) continue;
    const base =
      effectiveWealth(rules.rolloutByWealth, regions[r]!.wealth, defense.aid) *
      (1 + defense.rollout) *
      shift *
      comply;
    const favoured =
      policy === 'hotspots'
        ? state.visible[r]! / people > HOTSPOT_SHARE
        : policy === 'vulnerable'
          ? regions[r]!.wealth < 2
          : policy === 'productive'
            ? regions[r]!.economy > 1 / count
            : false;
    pace[r] = base * (favoured ? rules.priorityBoost : 1);
    plain += people * base;
    weighted += people * pace[r]!;
  }
  const scale = weighted > 0 ? plain / weighted : 1;
  for (let r = 0; r < count; r++) {
    if (pace[r] === 0) continue;
    const doses = Math.min(state.susceptible[r]!, Math.ceil(alive(state, r) * pace[r]! * scale));
    state.susceptible[r]! -= doses;
    state.immune[r]! += doses;
  }
}
