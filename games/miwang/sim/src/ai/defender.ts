/**
 * 守方的电脑对手。它和玩家一样只看得到上报的数字：
 *   研究——按“每一点预算换来多少效果”挑；疫情越重越看重疫苗和药物，信任越低越看重沟通。
 *   措施——每个地区按上报的病例占人口的比例，一步一步往上加：检测、隔离 → 口罩 → 封锁并关口岸；
 *           降下来之后再一步一步撤（撤的线比加的线低，免得来回开关）。先试全力那一档；
 *           普通和困难档在开不起、养不起的时候会退一档再试（轻的铺开总比不开强），手头宽了再往上加。
 *   应急队——派去上报病例最重的几个地区；原来驻的地方还排在前几名就不挪（来回跑的路上什么都干不了）。
 *   发布会——信任掉得厉害、手头又有余钱时开。疫苗——困难档会把疫苗优先给疫情重的地方。
 * 花钱有两条约束：手里要留一点应急的，维持费不能超过收入太多。
 */
import type { Command } from '../commands.ts';
import {
  DEFENSE_KEYS,
  MAX_LEVEL,
  measureLevel,
  MEASURES,
  TROPICAL,
  type DefenseKey,
  type Measure,
  type MeasureLevel,
  type OutbreakConfig,
  type TechDef,
} from '../config.ts';
import { setupCost, upkeepOf } from '../rules/defense.ts';
import type { OutbreakView } from '../view.ts';
import type { AiLevel } from './shared.ts';

/** 各难度：隔几天做一次决定、封锁的线（上报病例占人口的比例）、一次最多下几条命令、留多少预算、会不会针对传播途径 */
const LEVELS = [
  { every: 7, lockAt: 3e-3, commands: 4, reserve: 20, targeted: false },
  { every: 4, lockAt: 8e-4, commands: 10, reserve: 10, targeted: true },
  { every: 2, lockAt: 3e-4, commands: 24, reserve: 6, targeted: true },
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

/** 这个地区现在该开哪些措施 */
function wanted(
  view: OutbreakView,
  config: OutbreakConfig,
  region: number,
  lockAt: number,
  targeted: boolean,
): Set<Measure> {
  const { population, wealth, climate } = config.regions[region]!;
  const share = population > 0 ? view.cases[region]! / population : 0;
  const current = view.measures[region]!;
  const has = (measure: Measure) => measureLevel(current, measure) > 0;
  /** 到了线就开；已经开着的，降到线的六分之一以下才撤 */
  const hold = (measure: Measure, line: number) =>
    share >= line || (has(measure) && share >= line / 6);

  const open = new Set<Measure>();
  if (share > 0) open.add('testing').add('isolation');
  if (hold('masks', lockAt / 8)) open.add('masks');
  if (hold('lockdown', lockAt)) open.add('lockdown').add('airports').add('borders').add('ports');
  if (targeted && view.pathogen.stats && share >= lockAt / 8) {
    // 知道了传播途径才知道该不该净水、灭蚊
    if (view.pathogen.stats.water > 0.12 && wealth < 2) open.add('sanitation');
    if (view.pathogen.stats.vector > 0.12 && climate === TROPICAL) open.add('vectorControl');
  }
  return open;
}

/** 开一项措施时从高到低试的档位 */
const TRY_LEVELS: readonly MeasureLevel[] = [3, 2, 1];

/** 应急队该去哪里：上报病例占人口最重的几个地区；原来驻的地方还在前几名里就不动 */
function dispatch(view: OutbreakView, config: OutbreakConfig): Command[] {
  const { teams } = view.defense;
  const worst = Array.from(view.cases, (cases, region) => ({
    region,
    share: cases / Math.max(1, config.regions[region]!.population),
  }))
    .filter((it) => it.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, teams.length + 2)
    .map((it) => it.region);
  const covered = new Set(teams.map((team) => team.region).filter((r) => worst.includes(r)));
  const commands: Command[] = [];
  teams.forEach((team, index) => {
    if (covered.has(team.region)) return;
    const target = worst.find((region) => !covered.has(region));
    if (target === undefined) return;
    covered.add(target);
    commands.push({ type: 'team', team: index, region: target });
  });
  return commands;
}

export function defend(view: OutbreakView, config: OutbreakConfig, level: AiLevel): Command[] {
  const { every, lockAt, commands: limit, reserve, targeted } = LEVELS[level];
  if (view.tick % every !== 0) return [];
  const commands: Command[] = research(view, config, reserve);
  const { rules } = config;

  if (level >= 1) {
    commands.push(...dispatch(view, config));
    // 信任掉得厉害、手头又有余钱：开发布会
    const spare = view.resource - reserve - rules.briefingCost;
    if (view.defense.briefingIn === 0 && view.defense.trust < 0.55 && spare > 20) {
      commands.push({ type: 'briefing' });
    }
  }
  if (level >= 2 && view.defense.vaccinating && view.defense.priority !== 'hotspots') {
    commands.push({ type: 'priority', policy: 'hotspots' });
  }

  // 先撤（不花钱），再按病例比例从重到轻开（没开到全力的也算，等着往上加）
  const openings: { region: number; measure: Measure; share: number; from: MeasureLevel }[] = [];
  for (let region = 0; region < config.regions.length; region++) {
    const current = view.measures[region]!;
    const target = wanted(view, config, region, lockAt, targeted);
    if (current === 0 && target.size === 0) continue;
    const share = view.cases[region]! / Math.max(1, config.regions[region]!.population);
    for (const measure of MEASURES) {
      const from = measureLevel(current, measure);
      if (from > 0 && !target.has(measure)) {
        commands.push({ type: 'measure', region, measure, level: 0 });
      } else if (from < MAX_LEVEL && target.has(measure)) {
        openings.push({ region, measure, share, from });
      }
    }
  }
  openings.sort((a, b) => b.share - a.share);

  let budget = view.resource - reserve;
  let upkeep = view.defense.upkeep;
  /** 最低肯开到第几档：简单档只开全力的，开不起就不开 */
  const lowest = level === 0 ? MAX_LEVEL : 1;
  for (const { region, measure, from } of openings) {
    if (commands.length >= limit) break;
    for (const to of TRY_LEVELS) {
      if (to <= from || to < lowest) break;
      const cost = setupCost(config, region, measure, to, from);
      const daily = upkeepOf(config, region, measure, to) - upkeepOf(config, region, measure, from);
      const sustainable = upkeep + daily <= view.defense.income * UPKEEP_CAP || budget > RICH;
      if (cost > budget || !sustainable) continue;
      budget -= cost;
      upkeep += daily;
      commands.push({ type: 'measure', region, measure, level: to });
      break;
    }
  }
  return commands.slice(0, limit);
}
