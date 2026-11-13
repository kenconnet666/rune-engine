/**
 * 守方的电脑对手。它和玩家一样只看得到上报的数字：
 *   研究——按“每一点预算换来多少效果”挑；疫情越重越看重疫苗和药物，信任越低越看重沟通。
 *   措施——每个地区按上报的病例占人口的比例，一档一档往上加：检测、隔离 → 口罩 → 封锁并关口岸；
 *           降下来之后再一档一档撤（撤的线比加的线低，免得来回开关）。
 * 花钱有两条约束：手里要留一点应急的，维持费不能超过收入太多。
 */
import type { Command } from '../commands.ts';
import {
  DEFENSE_KEYS,
  MEASURE_BITS,
  MEASURES,
  TROPICAL,
  type DefenseKey,
  type Measure,
  type OutbreakConfig,
  type TechDef,
} from '../config.ts';
import { setupCost, upkeepOf } from '../rules/defense.ts';
import type { OutbreakView } from '../view.ts';
import type { AiLevel } from './shared.ts';

/** 各难度：隔几天做一次决定、封锁的线（上报病例占人口的比例）、一次最多下几条命令、留多少预算、会不会针对传播途径 */
const LEVELS = [
  { every: 7, lockAt: 6e-3, commands: 4, reserve: 20, targeted: false },
  { every: 4, lockAt: 2.5e-3, commands: 10, reserve: 10, targeted: true },
  { every: 2, lockAt: 1e-3, commands: 24, reserve: 6, targeted: true },
] as const;

/** 维持费最多到收入的这个倍数；手头宽裕（超过 RICH）时可以暂时超支 */
const UPKEEP_CAP = 0.9;
const RICH = 80;

/** 一项科技现在值多少：各效果 × 当下的看重程度 */
function worth(tech: TechDef, view: OutbreakView, pressure: number): number {
  const weights: Record<DefenseKey, number> = {
    identify: 14,
    detection: 70,
    isolation: 14,
    treatment: 30 + 120 * pressure,
    trust: 30 + 160 * (1 - view.defense.trust),
    aid: 10,
    trace: 5,
    vaccine: 16 + 40 * pressure,
    rollout: view.defense.vaccinating ? 40 : 6,
  };
  let value = 0;
  for (const key of DEFENSE_KEYS) value += (tech.effects[key] ?? 0) * weights[key];
  return value;
}

function research(view: OutbreakView, config: OutbreakConfig, reserve: number): Command[] {
  if (view.defense.active.length >= config.rules.labs) return [];
  // 疫情有多重：0（刚冒头）到 1（灾厄线过半）
  const pressure = Math.min(1, view.calamity * 2 + view.totals.regions / config.regions.length / 2);
  let best: { id: string; cost: number; score: number } | undefined;
  for (const offer of view.defense.offers) {
    const tech = config.techs.find((candidate) => candidate.id === offer.id);
    if (!tech) continue;
    const score = worth(tech, view, pressure) / offer.cost;
    if (!best || score > best.score) best = { ...offer, score };
  }
  // 最值得做的那项做不起就攒着
  return best && best.cost + reserve <= view.resource ? [{ type: 'research', tech: best.id }] : [];
}

/** 这个地区现在该开哪些措施（按位） */
function wanted(
  view: OutbreakView,
  config: OutbreakConfig,
  region: number,
  lockAt: number,
  targeted: boolean,
): number {
  const { population, wealth, climate } = config.regions[region]!;
  const share = population > 0 ? view.cases[region]! / population : 0;
  const current = view.measures[region]!;
  const has = (measure: Measure) => (current & MEASURE_BITS[measure]) !== 0;
  /** 到了线就开；已经开着的，降到线的六分之一以下才撤 */
  const hold = (measure: Measure, line: number) =>
    share >= line || (has(measure) && share >= line / 6);

  let bits = 0;
  if (share > 0) bits |= MEASURE_BITS.testing | MEASURE_BITS.isolation;
  if (hold('masks', lockAt / 8)) bits |= MEASURE_BITS.masks;
  if (hold('lockdown', lockAt)) {
    bits |=
      MEASURE_BITS.lockdown | MEASURE_BITS.airports | MEASURE_BITS.borders | MEASURE_BITS.ports;
  }
  if (targeted && view.pathogen.stats && share >= lockAt / 8) {
    // 知道了传播途径才知道该不该净水、灭蚊
    if (view.pathogen.stats.water > 0.12 && wealth < 2) bits |= MEASURE_BITS.sanitation;
    if (view.pathogen.stats.vector > 0.12 && climate === TROPICAL) {
      bits |= MEASURE_BITS.vectorControl;
    }
  }
  return bits;
}

export function defend(view: OutbreakView, config: OutbreakConfig, level: AiLevel): Command[] {
  const { every, lockAt, commands: limit, reserve, targeted } = LEVELS[level];
  if (view.tick % every !== 0) return [];
  const commands: Command[] = research(view, config, reserve);

  // 先撤（不花钱），再按病例比例从重到轻开
  const openings: { region: number; measure: Measure; share: number }[] = [];
  for (let region = 0; region < config.regions.length; region++) {
    const current = view.measures[region]!;
    const target = wanted(view, config, region, lockAt, targeted);
    if (current === target) continue;
    const share = view.cases[region]! / Math.max(1, config.regions[region]!.population);
    for (const measure of MEASURES) {
      const bit = MEASURE_BITS[measure];
      if ((current & bit) !== 0 && (target & bit) === 0) {
        commands.push({ type: 'measure', region, measure, on: false });
      } else if ((current & bit) === 0 && (target & bit) !== 0) {
        openings.push({ region, measure, share });
      }
    }
  }
  openings.sort((a, b) => b.share - a.share);

  let budget = view.resource - reserve;
  let upkeep = view.defense.upkeep;
  for (const { region, measure } of openings) {
    if (commands.length >= limit) break;
    const cost = setupCost(config, region, measure);
    const daily = upkeepOf(config, region, measure);
    const sustainable = upkeep + daily <= view.defense.income * UPKEEP_CAP || budget > RICH;
    if (cost > budget || !sustainable) continue;
    budget -= cost;
    upkeep += daily;
    commands.push({ type: 'measure', region, measure, on: true });
  }
  return commands.slice(0, limit);
}
