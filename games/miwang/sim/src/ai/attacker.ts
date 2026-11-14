/**
 * 攻方的电脑对手。思路只有一条：先铺开、后致命——
 * 感染面还小的时候买传播和隐蔽（太早致命会被发现、病人也走不远），铺开之后（或者疫苗快出来了）转去买致死性。
 * 技能是手头宽裕时用的：激增放在病例最多的地方；困难档还会外溢到没到过的大地区，
 * 在守方开始到处设防、自己还没铺开的时候蛰伏。
 * 性格（见 shared.ts）在这条思路上偏一偏：什么时候转去致命、看重传播还是隐蔽、技能用得勤不勤。
 */
import type { Command } from '../commands.ts';
import {
  EFFECT_KEYS,
  type EffectKey,
  type Effects,
  type OutbreakConfig,
  type TraitDef,
} from '../config.ts';
import type { Offer, OutbreakView } from '../view.ts';
import { noise, type AiLevel, type AttackStyle } from './shared.ts';

type Weights = Readonly<Record<EffectKey, number>>;

/** 铺开阶段：每一点效果值多少 */
const SPREAD: Weights = {
  air: 10,
  contact: 9,
  water: 6,
  vector: 5,
  blood: 5,
  animal: 0.4,
  severity: -0.3,
  lethality: -12,
  stealth: 0.9,
  cold: 1.4,
  heat: 1.4,
  resistance: 0.3,
  drift: 0.5,
  presymptomatic: 2.5,
  incubation: 0.08,
  duration: 0.12,
  aviation: 1.5,
  maritime: 0.8,
};

/** 收割阶段 */
const KILL: Weights = {
  ...SPREAD,
  air: 4,
  contact: 4,
  water: 3,
  vector: 3,
  blood: 3,
  severity: 0.1,
  lethality: 130,
  resistance: 2.5,
  drift: 1.5,
  stealth: 0.2,
};

/** 各难度：隔几天做一次决定、留多少点数不花、有多大概率随手乱买、感染面到多少转入收割 */
const LEVELS = [
  { every: 10, reserve: 0.3, random: 0.5, killAt: 0.12 },
  { every: 5, reserve: 0.1, random: 0.15, killAt: 0.25 },
  { every: 2, reserve: 0, random: 0, killAt: 0.35 },
] as const;

/**
 * 各种性格怎么偏：
 *   harvest  转去收割的那条线乘几（小于 1 是早收割）
 *   routes   铺开阶段各条传播途径的看重程度乘几
 *   stealth  铺开阶段隐蔽、潜伏期传人的看重程度乘几
 *   surgeAt  病例到多少就舍得用激增
 *   veilAt   守方在几个地区设了防就考虑蛰伏
 */
const STYLES: Readonly<
  Record<
    AttackStyle,
    { harvest: number; routes: number; stealth: number; surgeAt: number; veilAt: number }
  >
> = {
  steady: { harvest: 1, routes: 1, stealth: 1, surgeAt: 200, veilAt: 3 },
  swift: { harvest: 0.7, routes: 1.3, stealth: 0.6, surgeAt: 60, veilAt: 6 },
  lurker: { harvest: 1.3, routes: 0.9, stealth: 3, surgeAt: 400, veilAt: 1 },
  lethal: { harvest: 0.4, routes: 1, stealth: 0.8, surgeAt: 200, veilAt: 3 },
};

const ROUTE_KEYS: readonly EffectKey[] = ['air', 'contact', 'water', 'vector', 'blood'];
const STEALTH_KEYS: readonly EffectKey[] = ['stealth', 'presymptomatic'];

/** 这种性格在铺开阶段的权重 */
function spreadWeights(style: AttackStyle): Weights {
  const { routes, stealth } = STYLES[style];
  if (routes === 1 && stealth === 1) return SPREAD;
  const weights: Record<EffectKey, number> = { ...SPREAD };
  for (const key of ROUTE_KEYS) weights[key] *= routes;
  for (const key of STEALTH_KEYS) weights[key] *= stealth;
  return weights;
}

/** 最想要的性状比手里能花的贵到这个倍数以上，就不等它了 */
const WAIT_WITHIN = 2;

/** 各难度用技能之前手里要留多少点（简单档不用技能） */
const SKILL_CUSHION = [Infinity, 12, 4] as const;
/** 接种的人占到世界人口这么多，才值得用抗原转变 */
const SHIFT_IMMUNE = 0.1;
/** 平均一个病人传给这么多人以上，才舍得用蛰伏（它让传播弱一截：本来就勉强在涨的话会把自己闷死） */
const VEIL_REPRODUCTION = 1.3;

/**
 * 现在该用哪个技能（最多一个）。saving 是正攒着要买的那个性状的价钱：用完技能还得买得起它——
 * 性状是长久的，技能是一阵子的，不能为了技能把进化饿着。
 */
function skill(
  view: OutbreakView,
  config: OutbreakConfig,
  level: AiLevel,
  style: AttackStyle,
  spreading: boolean,
  saving: number,
): Command[] {
  const { surgeAt, veilAt } = STYLES[style];
  const ready = (kind: string) => {
    const def = config.skills.find((candidate) => candidate.kind === kind);
    const state = view.pathogen.skills.find((candidate) => candidate.id === def?.id);
    return def && state?.readyIn === 0 && view.resource >= def.cost + SKILL_CUSHION[level] + saving
      ? def
      : undefined;
  };
  /** 取 score 最高的地区；都不够格（score ≤ 0）就没有 */
  const top = (score: (region: number) => number) => {
    let best = -1;
    let bestScore = 0;
    for (let region = 0; region < config.regions.length; region++) {
      const value = score(region);
      if (value > bestScore) [best, bestScore] = [region, value];
    }
    return best;
  };

  const surge = ready('surge');
  if (surge && view.totals.cases > surgeAt) {
    const region = top((r) => view.cases[r]!);
    if (region >= 0) return [{ type: 'skill', skill: surge.id, region }];
  }
  // 抗原转变：疫苗已经打开了一片（接种的人占到世界的一成以上）才值得用
  const shift = ready('shift');
  if (shift) {
    let vaccinated = 0;
    let people = 0;
    for (let r = 0; r < config.regions.length; r++) {
      vaccinated += view.immune[r]! * config.regions[r]!.population;
      people += config.regions[r]!.population;
    }
    if (people > 0 && vaccinated / people >= SHIFT_IMMUNE)
      return [{ type: 'skill', skill: shift.id }];
  }
  if (level < 2) return [];
  const spillover = ready('spillover');
  if (spillover && view.totals.regions >= 3) {
    // 没到过的地区里人最多的那个
    const region = top((r) =>
      view.cases[r] === 0 && view.deaths[r] === 0 ? config.regions[r]!.population : 0,
    );
    if (region >= 0) return [{ type: 'skill', skill: spillover.id, region }];
  }
  const veil = ready('veil');
  if (veil && spreading) {
    const guarded = view.measures.reduce((count, bits) => count + (bits !== 0 ? 1 : 0), 0);
    // 按病例加权的平均传播数
    let weighted = 0;
    for (let r = 0; r < view.cases.length; r++) weighted += view.cases[r]! * view.reproduction[r]!;
    const reproduction = view.totals.cases > 0 ? weighted / view.totals.cases : 0;
    if (guarded >= veilAt && reproduction >= VEIL_REPRODUCTION) {
      return [{ type: 'skill', skill: veil.id }];
    }
  }
  return [];
}

const valueOf = (effects: Effects, weights: Weights): number => {
  let value = 0;
  for (const key of EFFECT_KEYS) value += (effects[key] ?? 0) * weights[key];
  return value;
};

/**
 * 一个性状现在值多少：它自己的效果，加上它能凑齐的协同（别的都有了、就差它）；
 * 还差两个的协同算一小部分——值得往那边靠，但不值得专门去凑
 */
function worth(
  trait: TraitDef,
  weights: Weights,
  config: OutbreakConfig,
  owned: ReadonlySet<string>,
): number {
  let value = valueOf(trait.effects, weights);
  for (const synergy of config.synergies) {
    if (!synergy.requires.includes(trait.id)) continue;
    const missing = synergy.requires.filter((id) => id !== trait.id && !owned.has(id)).length;
    if (missing <= 1) value += valueOf(synergy.effects, weights) * (missing === 0 ? 1 : 0.3);
  }
  return value;
}

/** 是不是该从“铺开”转到“收割”了 */
function harvesting(
  view: OutbreakView,
  config: OutbreakConfig,
  level: AiLevel,
  style: AttackStyle,
): boolean {
  const world = view.totals.population + view.totals.deaths;
  const infectedShare = world > 0 ? view.totals.infected / world : 0;
  // 疫苗做到第二步，或者拖得太久，就不能再等了
  const vaccineSteps = view.defense.done.filter(
    (id) => config.techs.find((tech) => tech.id === id)?.effects.vaccine,
  ).length;
  const line = LEVELS[level].killAt * STYLES[style].harvest;
  return infectedShare >= line || vaccineSteps >= 2 || view.tick > 420;
}

/** offers 里最想要的性状（值不值按这个阶段的权重算，再除以价钱）；没有值得要的是 undefined */
function wanted(
  offers: readonly Offer[],
  config: OutbreakConfig,
  weights: Weights,
  owned: ReadonlySet<string>,
) {
  let best: { id: string; cost: number; score: number } | undefined;
  for (const offer of offers) {
    const trait = config.traits.find((candidate) => candidate.id === offer.id);
    if (!trait) continue;
    const score = worth(trait, weights, config, owned) / offer.cost;
    if (!best || score > best.score) best = { ...offer, score };
  }
  return best && best.score > 0 ? best : undefined;
}

export function attack(
  view: OutbreakView,
  config: OutbreakConfig,
  level: AiLevel,
  style: AttackStyle = 'steady',
): Command[] {
  const { every, reserve, random } = LEVELS[level];
  if (view.tick % every !== 0) return [];
  const killing = harvesting(view, config, level, style);
  const weights = killing ? KILL : spreadWeights(style);
  const spendable = view.resource * (1 - reserve);
  const affordable = view.pathogen.offers.filter((offer) => offer.cost <= spendable);

  if (affordable.length > 0 && noise(view.tick, 1) < random) {
    const pick = affordable[Math.floor(noise(view.tick, 2) * affordable.length)]!;
    return [{ type: 'evolve', trait: pick.id }];
  }
  // 最想要的那个差一点就买得起：攒着，不退而求其次。还差得远（手里连一半都没有）就先买个买得起、
  // 也值得要的——传得慢的病原体点数来得也慢，干等会把整局等过去
  const owned = new Set(view.pathogen.owned);
  const want = wanted(view.pathogen.offers, config, weights, owned);
  const next =
    want && want.cost > spendable * WAIT_WITHIN ? wanted(affordable, config, weights, owned) : want;
  if (next && next.cost <= spendable) return [{ type: 'evolve', trait: next.id }];
  return skill(view, config, level, style, !killing, want?.cost ?? 0);
}
