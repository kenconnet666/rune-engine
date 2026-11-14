/**
 * 世界条件：这一局的世界和平时有哪里不一样。普通对局开局时按种子抽两条——一条对攻方有利，一条对守方有利，
 * 所以每一局的打法都要跟着变一变，又不至于整体偏向哪一方。章节不抽（章节的条件是它自己定的）。
 *
 * 每一条是在默认规则上改几个数。只改界面不直接显示的数（界面上的价钱、档位的成数、实验室的数量
 * 是按默认规则写的，见 client 的 rules.ts）。同一个 axis 的两条说的是同一件事的两头，不会同时抽到。
 */
import type { Rules } from '@miwang/sim';

export interface ConditionDef {
  readonly id: string;
  /** 对哪一方有利 */
  readonly favours: 'attacker' | 'defender';
  /** 说的是哪一件事（航线、季节、信任……）：同一件事的两头不同时出现 */
  readonly axis: string;
  readonly rules: (base: Rules) => Partial<Rules>;
}

export const CONDITIONS: readonly ConditionDef[] = [
  // ───── 对攻方有利 ─────
  // 航空业的好年景：航线上的人多
  {
    id: 'busySkies',
    favours: 'attacker',
    axis: 'skies',
    rules: (r) => ({ airRate: r.airRate * 1.35 }),
  },
  // 财政紧缩：守方每天的预算少
  {
    id: 'tightBudget',
    favours: 'attacker',
    axis: 'money',
    rules: (r) => ({ budgetPerDay: r.budgetPerDay * 0.82 }),
  },
  // 上一场风波之后：公众本来就不太信
  {
    id: 'shakenTrust',
    favours: 'attacker',
    axis: 'trust',
    rules: (r) => ({ startTrust: r.startTrust - 0.12 }),
  },
  // 冷冬热夏：季节对飞沫传播的影响更大
  {
    id: 'harshSeasons',
    favours: 'attacker',
    axis: 'seasons',
    rules: (r) => ({ seasonAir: r.seasonAir * 1.6 }),
  },
  // 厌倦：封不了多久就有人闹，封锁更伤信任
  {
    id: 'wearyPublic',
    favours: 'attacker',
    axis: 'patience',
    rules: (r) => ({
      fatigueDays: Math.round(r.fatigueDays * 0.6),
      trustLockdown: r.trustLockdown * 1.3,
    }),
  },
  // 不安分的基因组：变异点自己涨得快
  {
    id: 'restlessGenome',
    favours: 'attacker',
    axis: 'genome',
    rules: (r) => ({ pointsPerDay: r.pointsPerDay * 2.5 }),
  },

  // ───── 对守方有利 ─────
  // 航空业的淡季
  {
    id: 'quietSkies',
    favours: 'defender',
    axis: 'skies',
    rules: (r) => ({ airRate: r.airRate * 0.7 }),
  },
  // 捐助方大方：开局的预算多
  {
    id: 'generousDonors',
    favours: 'defender',
    axis: 'money',
    rules: (r) => ({ startBudget: r.startBudget + 30 }),
  },
  // 有信得过的声音：信任高，恢复得也快
  {
    id: 'trustedVoices',
    favours: 'defender',
    axis: 'trust',
    rules: (r) => ({
      startTrust: Math.min(1, r.startTrust + 0.08),
      trustRecovery: r.trustRecovery * 1.3,
    }),
  },
  // 警觉的诊所：头一簇病例少一半就认得出来
  {
    id: 'watchfulClinics',
    favours: 'defender',
    axis: 'watch',
    rules: (r) => ({ recognizeFirst: Math.ceil(r.recognizeFirst / 2) }),
  },
  // 多一支应急队
  { id: 'extraTeam', favours: 'defender', axis: 'teams', rules: (r) => ({ teams: r.teams + 1 }) },
  // 温和的季节
  {
    id: 'mildSeasons',
    favours: 'defender',
    axis: 'seasons',
    rules: (r) => ({ seasonAir: r.seasonAir * 0.5 }),
  },
];

/** 把种子搅成一个不小的正整数（相邻的种子抽到的不该挨着） */
function mix(seed: number, salt: number): number {
  let h = Math.imul((Math.abs(seed) | 0) + salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/** 这个种子抽到哪两条：先抽一条对攻方有利的，再抽一条对守方有利、而且说的不是同一件事的 */
export function drawConditions(seed: number): string[] {
  const forAttacker = CONDITIONS.filter((condition) => condition.favours === 'attacker');
  const first = forAttacker[mix(seed, 1) % forAttacker.length]!;
  const forDefender = CONDITIONS.filter(
    (condition) => condition.favours === 'defender' && condition.axis !== first.axis,
  );
  const second = forDefender[mix(seed, 2) % forDefender.length]!;
  return [first.id, second.id];
}

/** 在一套规则上依次套上这几条（表里没有的 id 不管） */
export function applyConditions(base: Rules, ids: readonly string[]): Rules {
  let rules = base;
  for (const id of ids) {
    const condition = CONDITIONS.find((candidate) => candidate.id === id);
    if (condition) rules = { ...rules, ...condition.rules(rules) };
  }
  return rules;
}
