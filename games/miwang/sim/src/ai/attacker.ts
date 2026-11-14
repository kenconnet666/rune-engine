/**
 * 攻方的电脑对手。思路只有一条：先铺开、后致命——
 * 感染面还小的时候买传播和隐蔽（太早致命会被发现、病人也走不远），铺开之后（或者疫苗快出来了）转去买致死性。
 * 技能是手头宽裕时用的：激增放在病例最多的地方；困难档还会外溢到没到过的大地区，
 * 在守方开始到处设防、自己还没铺开的时候蛰伏。
 */
import type { Command } from '../commands.ts';
import { EFFECT_KEYS, type EffectKey, type OutbreakConfig, type TraitDef } from '../config.ts';
import type { OutbreakView } from '../view.ts';
import { noise, type AiLevel } from './shared.ts';

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

/** 各难度用技能之前手里要留多少点（简单档不用技能） */
const SKILL_CUSHION = [Infinity, 12, 4] as const;

/** 现在该用哪个技能（最多一个） */
function skill(view: OutbreakView, config: OutbreakConfig, level: AiLevel, spreading: boolean) {
  const ready = (kind: string) => {
    const def = config.skills.find((candidate) => candidate.kind === kind);
    const state = view.pathogen.skills.find((candidate) => candidate.id === def?.id);
    return def && state?.readyIn === 0 && view.resource >= def.cost + SKILL_CUSHION[level]
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
  if (surge && view.totals.cases > 200) {
    const region = top((r) => view.cases[r]!);
    if (region >= 0) return [{ type: 'skill', skill: surge.id, region } as const];
  }
  if (level < 2) return [];
  const spillover = ready('spillover');
  if (spillover && view.totals.regions >= 3) {
    // 没到过的地区里人最多的那个
    const region = top((r) =>
      view.cases[r] === 0 && view.deaths[r] === 0 ? config.regions[r]!.population : 0,
    );
    if (region >= 0) return [{ type: 'skill', skill: spillover.id, region } as const];
  }
  const veil = ready('veil');
  const guarded = view.measures.reduce((count, bits) => count + (bits !== 0 ? 1 : 0), 0);
  if (veil && spreading && guarded >= 3) return [{ type: 'skill', skill: veil.id } as const];
  return [];
}

function worth(trait: TraitDef, weights: Weights): number {
  let value = 0;
  for (const key of EFFECT_KEYS) value += (trait.effects[key] ?? 0) * weights[key];
  return value;
}

export function attack(view: OutbreakView, config: OutbreakConfig, level: AiLevel): Command[] {
  const { every } = LEVELS[level];
  if (view.tick % every !== 0) return [];
  const killing = harvesting(view, config, level);
  return [...evolution(view, config, level, killing), ...skill(view, config, level, !killing)];
}

/** 是不是该从“铺开”转到“收割”了 */
function harvesting(view: OutbreakView, config: OutbreakConfig, level: AiLevel): boolean {
  const world = view.totals.population + view.totals.deaths;
  const infectedShare = world > 0 ? view.totals.infected / world : 0;
  // 疫苗做到第二步，或者拖得太久，就不能再等了
  const vaccineSteps = view.defense.done.filter(
    (id) => config.techs.find((tech) => tech.id === id)?.effects.vaccine,
  ).length;
  return infectedShare >= LEVELS[level].killAt || vaccineSteps >= 2 || view.tick > 420;
}

/** 换哪个性状 */
function evolution(
  view: OutbreakView,
  config: OutbreakConfig,
  level: AiLevel,
  killing: boolean,
): Command[] {
  const { reserve, random } = LEVELS[level];
  if (view.pathogen.offers.length === 0) return [];
  const weights = killing ? KILL : SPREAD;

  const affordable = view.pathogen.offers.filter(
    (offer) => offer.cost <= view.resource * (1 - reserve),
  );
  if (affordable.length === 0) return [];

  if (noise(view.tick, 1) < random) {
    const pick = affordable[Math.floor(noise(view.tick, 2) * affordable.length)]!;
    return [{ type: 'evolve', trait: pick.id }];
  }
  let best: { id: string; score: number } | undefined;
  for (const offer of view.pathogen.offers) {
    const trait = config.traits.find((candidate) => candidate.id === offer.id);
    if (!trait) continue;
    const score = worth(trait, weights) / offer.cost;
    if (!best || score > best.score) best = { id: offer.id, score };
  }
  // 最想要的那个还买不起就攒着，不退而求其次（除非它根本不值）
  if (!best || best.score <= 0) return [];
  return affordable.some((offer) => offer.id === best.id)
    ? [{ type: 'evolve', trait: best.id }]
    : [];
}
