/**
 * 抉择：隔一阵子，某一方会碰上一件要它拿主意的事——几个选项，各有得失，限几天之内选；
 * 到期没选就按第一个选项办（表里把“什么都不做”放在第一个）。每一方同时最多有一件等着。
 * 有哪些事、各个选项的得失由抉择表定；这里只管什么时候冒出来、选了以后怎么生效。
 * 事有两种来路：平时的靠运气；危机是局面到了某个地步就出（见 crises.ts），而且多半冲着某一个地区。
 */
import { chance, clamp, type PlayerId } from '@rune-engine/core';
import {
  measureLevel,
  withMeasure,
  type DecisionDef,
  type DecisionOption,
  type DefenseStats,
  type MeasureLevel,
} from '../config.ts';
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
import { crisisOnce, crisisRaised, crisisRegion } from './crises.ts';
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

/** 给这一方挑一件事：按表里的常见程度，出现过的降低权重，上一次出的那件这次不出（不老是同一件） */
const pick = (state: OutbreakState, player: PlayerId): number =>
  pickWeighted(
    state.random,
    state.config.decisions.map((decision, index) =>
      !decision.crisis &&
      playerOf(decision) === player &&
      index !== state.decisionLast[player] &&
      eligible(state, decision)
        ? decision.weight / (1 + 2 * state.decisionSeen[index]!)
        : 0,
    ),
  );

/** 这一方现在有没有成立的危机（表里靠前的先出）：是哪一件、冲着哪个地区 */
function crisis(
  state: OutbreakState,
  player: PlayerId,
  defense: DefenseStats,
): { index: number; region: number } | undefined {
  const { decisions, rules } = state.config;
  if (rules.crisisGap < 0) return undefined;
  for (let index = 0; index < decisions.length; index++) {
    const decision = decisions[index]!;
    if (!decision.crisis || playerOf(decision) !== player) continue;
    if (state.tick < state.crisisReadyAt[index]!) continue;
    if (crisisOnce(decision.crisis) && state.decisionSeen[index]! > 0) continue;
    const region = crisisRegion(state, decision.crisis, defense);
    if (region !== undefined) return { index, region };
  }
  return undefined;
}

/** 一件事落到一方手里 */
function raise(state: OutbreakState, player: PlayerId, index: number, region: number) {
  state.pendingDecision[player] = index;
  state.decisionRegion[player] = region;
  state.decisionExpires[player] = state.tick + state.config.decisions[index]!.days;
  state.decisionSeen[index] = Math.min(255, state.decisionSeen[index]! + 1);
  state.decisionLast[player] = index;
}

/** 一个选项生效；region 是这件事冲着的地区（-1 是不针对某个地区） */
function apply(
  state: OutbreakState,
  decision: DecisionDef,
  option: DecisionOption,
  region: number,
) {
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
  if (region >= 0) {
    if (option.unrest) state.unrestUntil[region] = state.tick + option.unrest;
    if (option.relief) state.reliefUntil[region] = state.tick + option.relief;
    if (option.leak) state.leakUntil[region] = state.tick + option.leak;
    if (option.relax) {
      const bits = state.measures[region]!;
      const level = Math.max(0, measureLevel(bits, 'lockdown') - option.relax) as MeasureLevel;
      state.measures[region] = withMeasure(bits, 'lockdown', level);
    }
  }
  report(state, 'decision', audience, region, `${decision.id}.${option.id}`);
}

function settle(state: OutbreakState, player: PlayerId, option: number) {
  const decision = state.config.decisions[state.pendingDecision[player]!];
  const region = state.decisionRegion[player]!;
  state.pendingDecision[player] = -1;
  state.decisionRegion[player] = -1;
  // 没有事等着的时候，这个数记的是“下一件最早哪一步出”
  state.decisionExpires[player] = state.tick + state.config.rules.decisionGap;
  const chosen = decision?.options[option];
  if (decision && chosen) apply(state, decision, chosen, region);
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

/** 每天：到期没选的按第一个选项办；手里没有事的，先看有没有危机，没有再按小概率碰上一件平时的 */
export function rollDecisions(state: OutbreakState, defense: DefenseStats) {
  const { rules, decisions } = state.config;
  for (const player of [ATTACKER, DEFENDER]) {
    if (state.pendingDecision[player]! >= 0) {
      if (state.decisionExpires[player]! <= state.tick) settle(state, player, 0);
      continue;
    }
    // 上一件刚定下来：隔一阵子再出（危机也一样，不然一件接一件）
    if (state.tick < state.decisionExpires[player]!) continue;
    const urgent = crisis(state, player, defense);
    if (urgent) {
      raise(state, player, urgent.index, urgent.region);
      state.crisisReadyAt[urgent.index] = state.tick + rules.crisisGap;
      crisisRaised(state, decisions[urgent.index]!.crisis!, urgent.region);
      continue;
    }
    if (rules.decisionChance <= 0 || state.tick < rules.decisionAfter) continue;
    if (!chance(state.random, rules.decisionChance)) continue;
    const index = pick(state, player);
    if (index >= 0) raise(state, player, index, -1);
  }
}
