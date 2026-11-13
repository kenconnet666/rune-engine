/**
 * 胜负：死亡越过灾厄线攻方赢；病原体被清除、或者守到期限，守方赢。
 * 剧本（章节）另有目标：攻方在期限内全做到就赢，到期没做到算守方守住了。
 */
import { WEALTHIEST, type GoalMetric } from '../config.ts';
import {
  ATTACKER,
  DEFENDER,
  FOR_BOTH,
  REACHED,
  report,
  REPORTED,
  type Outcome,
  type OutbreakState,
} from '../state.ts';

const sum = (values: Float64Array) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/** 全世界的累计死亡 */
export const totalDeaths = (state: OutbreakState) => sum(state.deaths);

/**
 * 剧本里的一个数现在是多少。truth 是真实的那个（判胜负用、攻方看到的）；
 * 否则是守方按上报看到的——性状数要做完病原鉴定（known）才知道，不知道是 null。
 */
export function goalValue(
  state: OutbreakState,
  metric: GoalMetric,
  truth: boolean,
  known = true,
): number | null {
  switch (metric) {
    case 'infected':
      return truth ? state.infectedTotal : sum(state.reported);
    case 'deaths':
      return truth ? totalDeaths(state) : sum(state.reportedDeaths);
    case 'traits': {
      if (!truth && !known) return null;
      let owned = 0;
      for (const has of state.traits) owned += has;
      return owned;
    }
    case 'regions':
    case 'wealthy': {
      const bit = truth ? REACHED : REPORTED;
      let count = 0;
      for (let r = 0; r < state.reached.length; r++) {
        if ((state.reached[r]! & bit) === 0) continue;
        if (metric === 'regions' || state.config.regions[r]!.wealth === WEALTHIEST) count++;
      }
      return count;
    }
  }
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

  const { scenario } = state.config;
  /** 这一局按剧本的目标分胜负（剧本里列了目标的话） */
  const byGoals = scenario !== undefined && scenario.goals.length > 0;
  const deadline = scenario?.days ?? rules.maxDays;

  let outcome: Outcome | null = null;
  if (
    byGoals &&
    scenario.goals.every((goal) => goalValue(state, goal.metric, true)! >= goal.target)
  ) {
    outcome = { winner: ATTACKER, reason: 'goal', tick: state.tick };
  } else if (!byGoals && calamity(state) >= 1) {
    outcome = { winner: ATTACKER, reason: 'calamity', tick: state.tick };
  } else if (state.clearStreak >= rules.clearDays) {
    outcome = { winner: DEFENDER, reason: 'eradicated', tick: state.tick };
  } else if (state.tick + 1 >= deadline) {
    outcome = { winner: DEFENDER, reason: byGoals ? 'held' : 'timeout', tick: state.tick };
  }
  if (!outcome) return;
  state.outcome = outcome;
  report(state, 'outcome', FOR_BOTH, -1, outcome.reason);
}
