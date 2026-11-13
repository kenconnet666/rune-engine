/** 守方的研究：科技的效果、开始一项研究、每天推进、疫苗接种 */
import { DEFENSE_KEYS, type DefenseStats, type PathogenStats } from '../config.ts';
import {
  alive,
  FOR_BOTH,
  report,
  TECH_ACTIVE,
  TECH_DONE,
  TECH_IDLE,
  type OutbreakState,
} from '../state.ts';
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

/** 疫苗量产之后每天接种：各地区按富裕程度（援助会把穷地区往上拉）把一部分易感者变成免疫者 */
export function vaccinate(state: OutbreakState, defense: DefenseStats, comply: number) {
  if (!vaccineReady(state, defense)) return;
  const { regions, rules } = state.config;
  for (let r = 0; r < regions.length; r++) {
    const waiting = state.susceptible[r]!;
    if (waiting <= 0) continue;
    const pace =
      effectiveWealth(rules.rolloutByWealth, regions[r]!.wealth, defense.aid) *
      (1 + defense.rollout) *
      comply;
    const doses = Math.min(waiting, Math.ceil(alive(state, r) * pace));
    state.susceptible[r]! -= doses;
    state.immune[r]! += doses;
  }
}
