/** 胜负：死亡越过灾厄线攻方赢；病原体被清除、或者守到期限，守方赢 */
import {
  ATTACKER,
  DEFENDER,
  FOR_BOTH,
  report,
  type Outcome,
  type OutbreakState,
} from '../state.ts';

/** 全世界的累计死亡 */
export function totalDeaths(state: OutbreakState): number {
  let sum = 0;
  for (const value of state.deaths) sum += value;
  return sum;
}

/** 死亡离灾厄线还有多远（0–1，到 1 攻方赢） */
export function calamity(state: OutbreakState): number {
  const line = state.config.rules.calamityShare * state.worldPopulation;
  return line > 0 ? Math.min(1, totalDeaths(state) / line) : 0;
}

/** 每天结算之后看一眼分没分出胜负 */
export function judge(state: OutbreakState) {
  const { rules } = state.config;
  let active = 0;
  for (let r = 0; r < state.exposed.length; r++) active += state.exposed[r]! + state.infectious[r]!;
  state.clearStreak = active > 0 ? 0 : state.clearStreak + 1;

  let outcome: Outcome | null = null;
  if (calamity(state) >= 1) {
    outcome = { winner: ATTACKER, reason: 'calamity', tick: state.tick };
  } else if (state.clearStreak >= rules.clearDays) {
    outcome = { winner: DEFENDER, reason: 'eradicated', tick: state.tick };
  } else if (state.tick + 1 >= rules.maxDays) {
    outcome = { winner: DEFENDER, reason: 'timeout', tick: state.tick };
  }
  if (!outcome) return;
  state.outcome = outcome;
  report(state, 'outcome', FOR_BOTH, -1, outcome.reason);
}
