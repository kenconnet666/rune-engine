/**
 * 抉择：隔一阵子，某一方会碰上一件要它拿主意的事——几个选项，各有得失，限几天之内选；
 * 到期没选就按第一个选项办（表里把“什么都不做”放在第一个）。每一方同时最多有一件等着。
 * 有哪些事、各个选项的得失由抉择表定；这里只管什么时候冒出来、选了以后怎么生效。
 */
import { chance, clamp, type PlayerId } from '@rune-engine/core';
import type { DecisionDef, DecisionOption } from '../config.ts';
import {
  ATTACKER,
  DEFENDER,
  FOR_ATTACKER,
  FOR_BOTH,
  REACHED,
  report,
  TECH_ACTIVE,
  type OutbreakState,
} from '../state.ts';
import { addModifiers } from './modifiers.ts';
import { pickWeighted } from './pick.ts';
import { activeResearch } from './research.ts';

/** “已经传开了”：到过这么多个地区 */
const SPREAD_REGIONS = 5;

const playerOf = (decision: DecisionDef): PlayerId =>
  decision.side === 'attacker' ? ATTACKER : DEFENDER;

function eligible(state: OutbreakState, decision: DecisionDef): boolean {
  switch (decision.when) {
    case 'research':
      return activeResearch(state) > 0;
    case 'spread': {
      let reached = 0;
      for (const bits of state.reached) if ((bits & REACHED) !== 0) reached++;
      return reached >= SPREAD_REGIONS;
    }
    default:
      return true;
  }
}

/** 给这一方挑一件事：按表里的常见程度，出现过的降低权重（不老是同一件） */
const pick = (state: OutbreakState, player: PlayerId): number =>
  pickWeighted(
    state.random,
    state.config.decisions.map((decision, index) =>
      playerOf(decision) === player && eligible(state, decision)
        ? decision.weight / (1 + 2 * state.decisionSeen[index]!)
        : 0,
    ),
  );

/** 一个选项生效 */
function apply(state: OutbreakState, decision: DecisionDef, option: DecisionOption) {
  state.points = Math.max(0, state.points + (option.points ?? 0));
  state.budget = Math.max(0, state.budget + (option.budget ?? 0));
  state.trust = clamp(state.trust + (option.trust ?? 0), 0, 1);
  if (option.research) {
    for (let index = 0; index < state.techs.length; index++) {
      if (state.techs[index] === TECH_ACTIVE) state.techRemaining[index]! *= 1 - option.research;
    }
  }
  // 守方的决定是公开的；攻方那边的事只有攻方自己知道
  const audience = decision.side === 'attacker' ? FOR_ATTACKER : FOR_BOTH;
  addModifiers(state, option.modifiers, option.days ?? 0, audience);
  report(state, 'decision', audience, -1, `${decision.id}.${option.id}`);
}

function settle(state: OutbreakState, player: PlayerId, option: number) {
  const decision = state.config.decisions[state.pendingDecision[player]!];
  state.pendingDecision[player] = -1;
  const chosen = decision?.options[option];
  if (decision && chosen) apply(state, decision, chosen);
}

/** 一方做了选择；不是它的事、没有这个选项都不生效 */
export function resolveDecision(
  state: OutbreakState,
  player: PlayerId,
  id: string,
  optionId: string,
) {
  const decision = state.config.decisions[state.pendingDecision[player] ?? -1];
  if (!decision || decision.id !== id) return;
  const option = decision.options.findIndex((candidate) => candidate.id === optionId);
  if (option >= 0) settle(state, player, option);
}

/** 每天：到期没选的按第一个选项办；然后各方有小概率碰上一件新的 */
export function rollDecisions(state: OutbreakState) {
  const { rules, decisions } = state.config;
  for (const player of [ATTACKER, DEFENDER]) {
    if (state.pendingDecision[player]! >= 0) {
      if (state.decisionExpires[player]! <= state.tick) settle(state, player, 0);
      continue;
    }
    if (rules.decisionChance <= 0 || state.tick < rules.decisionAfter) continue;
    if (!chance(state.random, rules.decisionChance)) continue;
    const index = pick(state, player);
    if (index < 0) continue;
    state.pendingDecision[player] = index;
    state.decisionExpires[player] = state.tick + decisions[index]!.days;
    state.decisionSeen[index] = Math.min(255, state.decisionSeen[index]! + 1);
  }
}
