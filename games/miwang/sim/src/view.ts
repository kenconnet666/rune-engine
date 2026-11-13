/** 一方能看到的部分：攻方看真实的感染，守方只看得到上报；对手的底牌要满足条件才看得到 */
import { dateAtTick, dateFromText, dateToText, type PlayerId } from '@rune-engine/core';
import type { Goal, PathogenStats } from './config.ts';
import { compliance, dailyBalance } from './rules/defense.ts';
import { HISTORY_EVERY, type History } from './rules/history.ts';
import { calamity, goalValue } from './rules/outcome.ts';
import { canEvolve, pathogenStats, traitCost } from './rules/pathogen.ts';
import { canResearch, defenseStats, vaccineReady } from './rules/research.ts';
import {
  alive,
  ATTACKER,
  FOR_ATTACKER,
  FOR_DEFENDER,
  REACHED,
  REPORTED,
  TECH_ACTIVE,
  TECH_DONE,
  type Hop,
  type NewsItem,
  type Outcome,
  type OutbreakState,
} from './state.ts';

/** 地区上正在发生的事（按位）：大型集会、自然灾害 */
export const HAS_GATHERING = 1;
export const HAS_DISASTER = 2;

/** 能买的一样东西（性状或科技）和它现在的价格 */
export interface Offer {
  readonly id: string;
  readonly cost: number;
}

export interface OutbreakView {
  readonly tick: number;
  /** 这一步是哪天（'YYYY-MM-DD'）：过线程边界用文本，界面按语言格式化 */
  readonly date: string;
  readonly player: PlayerId;
  /** 这一方是攻方（看得到真实感染）还是守方（只看得到上报） */
  readonly attacker: boolean;

  // 各地区（下标同配置里的地区）
  /** 涂在地图上的“感染程度”（0–1） */
  readonly intensity: Float32Array;
  /** 措施（按 MEASURE_BITS 的位），双方都看得到 */
  readonly measures: Uint16Array;
  /** 现在的病例：攻方是真实的潜伏加发病，守方是按上报估的 */
  readonly cases: Float64Array;
  /** 累计死亡：攻方是真实的，守方是上报的 */
  readonly deaths: Float64Array;
  /** 接种得到免疫的人口比例 */
  readonly immune: Float32Array;
  /** 正在发生的事（HAS_GATHERING、HAS_DISASTER） */
  readonly happening: Uint8Array;

  readonly totals: {
    /** 现在的病例、累计感染（守方：累计上报）、累计死亡 */
    readonly cases: number;
    readonly infected: number;
    readonly deaths: number;
    /** 还活着的人口 */
    readonly population: number;
    /** 出现过病例的地区数 */
    readonly regions: number;
  };
  /** 死亡离灾厄线有多远（0–1）：按这一方看得到的死亡数算 */
  readonly calamity: number;

  /** 这一方的资源：攻方的变异点或守方的预算 */
  readonly resource: number;

  readonly pathogen: {
    /** 这一方知不知道病原体的底细（攻方总是知道，守方要做完病原鉴定） */
    readonly known: boolean;
    /** 是哪一种病原体（档案的 id）；不知道时是 null */
    readonly id: string | null;
    /** 已有的性状；不知道时是空的 */
    readonly owned: readonly string[];
    readonly stats: PathogenStats | null;
    /** 攻方现在能换的性状和价格；守方是空的 */
    readonly offers: readonly Offer[];
  };

  readonly defense: {
    readonly trust: number;
    /** 措施的实际效果是名义效果的多少（0–1） */
    readonly compliance: number;
    /** 每天的收入与维持费（只有守方看得到，攻方是 0） */
    readonly income: number;
    readonly upkeep: number;
    readonly done: readonly string[];
    readonly active: readonly { readonly id: string; readonly remaining: number }[];
    /** 守方现在能开始的研究和价格；攻方是空的 */
    readonly offers: readonly Offer[];
    readonly vaccinating: boolean;
    /** 累计的经济损失（少收的预算） */
    readonly economyLost: number;
  };

  /** 起源地：攻方总是知道，守方要做完溯源；不知道时是 -1 */
  readonly origin: number;
  /** 疾病最近跳到新地区的那几下（只有攻方看得到：守方不知道它是从哪里来的） */
  readonly hops: readonly Hop[];
  /** 态势随时间的记录（这一方看得到的那一份）：每 every 天一笔 */
  readonly history: History & { readonly every: number };
  /** 这一方看得到的新闻，旧的在前 */
  readonly news: readonly NewsItem[];
  readonly outcome: Outcome | null;
  /**
   * 这一局的剧本（章节）：目标、期限、各个目标现在到了多少。普通对局是 null。
   * 攻方看到的进度是真实的；守方看到的是按上报算的（比真实的少），它还不知道的是 null。
   */
  readonly scenario: {
    readonly id: string;
    readonly days: number;
    readonly goals: readonly (Goal & { readonly value: number | null })[];
  } | null;
}

/** 多少天以内的“跳到新地区”算最近的 */
const HOPS_SHOWN_DAYS = 30;
/** 新闻一次最多给这么多条（最近的） */
const NEWS_SHOWN = 30;

export function observe(state: OutbreakState, player: PlayerId): OutbreakView {
  const attacker = player === ATTACKER;
  const { regions, traits, techs, scenario } = state.config;
  const count = regions.length;
  const defense = defenseStats(state);

  const intensity = new Float32Array(count);
  const cases = new Float64Array(count);
  const deaths = new Float64Array(count);
  const immune = new Float32Array(count);
  const happening = new Uint8Array(count);
  let totalCases = 0;
  let totalDeaths = 0;
  let population = 0;
  let reached = 0;
  let reportedTotal = 0;

  for (let r = 0; r < count; r++) {
    const people = alive(state, r);
    const active = attacker ? state.exposed[r]! + state.infectious[r]! : state.visible[r]!;
    cases[r] = active;
    deaths[r] = attacker ? state.deaths[r]! : state.reportedDeaths[r]!;
    immune[r] = people > 0 ? state.immune[r]! / people : 0;
    // 开方让小数字也看得出来；守方看到的只是冰山一角，放大得更多
    const share = people > 0 ? active / people : 0;
    intensity[r] = Math.min(1, Math.sqrt(share * (attacker ? 4 : 12)));
    happening[r] =
      (state.gatheringUntil[r]! > state.tick ? HAS_GATHERING : 0) |
      (state.disasterUntil[r]! > state.tick ? HAS_DISASTER : 0);
    totalCases += active;
    totalDeaths += deaths[r]!;
    population += people;
    reportedTotal += state.reported[r]!;
    if ((state.reached[r]! & (attacker ? REACHED : REPORTED)) !== 0) reached++;
  }

  const known = attacker || defense.identify >= 1;
  const audience = attacker ? FOR_ATTACKER : FOR_DEFENDER;
  const balance = attacker ? { income: 0, upkeep: 0 } : dailyBalance(state);
  const line = state.config.rules.calamityShare * state.worldPopulation;

  return {
    tick: state.tick,
    date: dateToText(dateAtTick(dateFromText(state.config.startDate), state.tick)),
    player,
    attacker,
    intensity,
    measures: state.measures.slice(),
    cases,
    deaths,
    immune,
    happening,
    totals: {
      cases: totalCases,
      infected: attacker ? state.infectedTotal : reportedTotal,
      deaths: totalDeaths,
      population,
      regions: reached,
    },
    calamity: attacker ? calamity(state) : line > 0 ? Math.min(1, totalDeaths / line) : 0,
    resource: attacker ? state.points : state.budget,
    pathogen: {
      known,
      id: known ? state.config.pathogen.id : null,
      owned: known ? traits.filter((_, index) => state.traits[index] === 1).map((t) => t.id) : [],
      stats: known ? pathogenStats(state) : null,
      offers: attacker
        ? traits.flatMap((trait, index) =>
            canEvolve(state, index) ? [{ id: trait.id, cost: traitCost(state, index) }] : [],
          )
        : [],
    },
    defense: {
      trust: state.trust,
      compliance: compliance(state),
      income: balance.income,
      upkeep: balance.upkeep,
      done: techs.filter((_, index) => state.techs[index] === TECH_DONE).map((tech) => tech.id),
      active: techs.flatMap((tech, index) =>
        state.techs[index] === TECH_ACTIVE
          ? [{ id: tech.id, remaining: Math.ceil(state.techRemaining[index]!) }]
          : [],
      ),
      offers: attacker
        ? []
        : techs.flatMap((tech, index) =>
            canResearch(state, index) ? [{ id: tech.id, cost: tech.cost }] : [],
          ),
      vaccinating: vaccineReady(state, defense),
      economyLost: state.economyLost,
    },
    origin: attacker || defense.trace >= 1 ? state.config.origin : -1,
    hops: attacker ? state.hops.filter((hop) => state.tick - hop.tick <= HOPS_SHOWN_DAYS) : [],
    history: { every: HISTORY_EVERY, ...(attacker ? state.history : state.reportedHistory) },
    news: state.news.filter((item) => (item.audience & audience) !== 0).slice(-NEWS_SHOWN),
    outcome: state.outcome,
    scenario: scenario
      ? {
          id: scenario.id,
          days: scenario.days,
          goals: scenario.goals.map((goal) => ({
            ...goal,
            value: goalValue(state, goal.metric, attacker, known),
          })),
        }
      : null,
  };
}
