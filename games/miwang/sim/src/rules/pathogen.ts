/** 攻方：病原体当前的数值、性状的价格与前置、换性状、退掉性状 */
import { clamp } from '@rune-engine/core';
import { EFFECT_KEYS, type PathogenStats, type TraitDef } from '../config.ts';
import { FOR_ATTACKER, FOR_DEFENDER, report, type OutbreakState } from '../state.ts';
import { defenseStats } from './research.ts';

/** 取值是比例的那几项，加总之后夹在 0–1 */
const SHARES = ['lethality', 'cold', 'heat', 'resistance', 'presymptomatic'] as const;

/** 病原体现在的数值：档案的底数加上已有性状的效果 */
export function pathogenStats(state: OutbreakState): PathogenStats {
  const { pathogen, traits } = state.config;
  const stats = Object.fromEntries(EFFECT_KEYS.map((key) => [key, 0])) as PathogenStats;
  const add = (effects: TraitDef['effects']) => {
    for (const key of EFFECT_KEYS) stats[key] += effects[key] ?? 0;
  };
  add(pathogen.base);
  for (let index = 0; index < traits.length; index++) {
    if (state.traits[index]) add(traits[index]!.effects);
  }
  for (const key of SHARES) stats[key] = clamp(stats[key], 0, 1);
  // 性状可以是负的效果（比如“减轻症状”），但强度、严重度不会低于 0
  for (const key of EFFECT_KEYS) if (stats[key] < 0) stats[key] = 0;
  return stats;
}

/** 已经有几个性状 */
function ownedCount(state: OutbreakState): number {
  let count = 0;
  for (const owned of state.traits) count += owned;
  return count;
}

/** 现在换这个性状要多少变异点：底价 × 这种病原体的倍数 ×（每多一个性状贵一点） */
export function traitCost(state: OutbreakState, index: number): number {
  const { traits, pathogen, rules } = state.config;
  const trait = traits[index]!;
  const scale = pathogen.costScale?.[trait.group] ?? 1;
  return Math.round(trait.cost * scale * (1 + rules.costGrowth * ownedCount(state)));
}

/** 还没有、而且前置满足（已有前置里的任意一个，或者没有前置） */
export function canEvolve(state: OutbreakState, index: number): boolean {
  const trait = state.config.traits[index];
  if (!trait || state.traits[index]) return false;
  return (
    trait.requires.length === 0 ||
    trait.requires.some((id) => state.traits[state.traitIndex.get(id) ?? -1] === 1)
  );
}

/** 换一个性状；点数不够、前置不满足、已经有了都不生效 */
export function evolve(state: OutbreakState, id: string) {
  const index = state.traitIndex.get(id);
  if (index === undefined || !canEvolve(state, index)) return;
  const cost = traitCost(state, index);
  if (state.points < cost) return;
  state.points -= cost;
  state.traits[index] = 1;
  // 守方做完病原鉴定之后，对手每次变异都瞒不过去
  const identified = defenseStats(state).identify >= 1;
  report(state, 'evolve', identified ? FOR_ATTACKER | FOR_DEFENDER : FOR_ATTACKER, -1, id);
}

/** 退掉这个性状能拿回多少变异点：它底价的一部分（不是现在涨过的价） */
export function devolveRefund(state: OutbreakState, index: number): number {
  const { traits, pathogen, rules } = state.config;
  const trait = traits[index]!;
  return Math.floor(trait.cost * (pathogen.costScale?.[trait.group] ?? 1) * rules.devolveRefund);
}

/** 有这个性状，而且退掉它之后，靠它当前置的那些已有性状都还站得住（前置是“任意一个”，还剩一个就行） */
export function canDevolve(state: OutbreakState, index: number): boolean {
  const { traits } = state.config;
  const trait = traits[index];
  if (!trait || !state.traits[index]) return false;
  const owned = (id: string) => state.traits[state.traitIndex.get(id) ?? -1] === 1;
  return traits.every(
    (other, at) =>
      !state.traits[at] ||
      !other.requires.includes(trait.id) ||
      other.requires.some((id) => id !== trait.id && owned(id)),
  );
}

/** 退掉一个性状，拿回一部分变异点；之后的性状也跟着便宜一点（价格看已有几个） */
export function devolve(state: OutbreakState, id: string) {
  const index = state.traitIndex.get(id);
  if (index === undefined || !canDevolve(state, index)) return;
  state.points += devolveRefund(state, index);
  state.traits[index] = 0;
  const identified = defenseStats(state).identify >= 1;
  report(state, 'devolve', identified ? FOR_ATTACKER | FOR_DEFENDER : FOR_ATTACKER, -1, id);
}
