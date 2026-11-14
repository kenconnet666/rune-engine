/** 一方能看到的部分：攻方看真实的感染，守方只看得到上报；对手的底牌要满足条件才看得到 */
import { dateAtTick, dateFromText, dateToText, type PlayerId } from '@rune-engine/core';
import {
  VACCINE_POLICIES,
  type Goal,
  type ModifierKey,
  type PathogenStats,
  type VaccinePolicy,
} from './config.ts';
import { calendarNow, type CalendarEntry } from './rules/calendar.ts';
import { compliance, dailyBalance } from './rules/defense.ts';
import { reproductionIn, strainIn } from './rules/epidemic.ts';
import { HISTORY_EVERY, type History } from './rules/history.ts';
import { calamity, goalValue } from './rules/outcome.ts';
import {
  canDevolve,
  canEvolve,
  devolveRefund,
  pathogenStats,
  traitCost,
} from './rules/pathogen.ts';
import { canResearch, defenseStats, vaccineReady } from './rules/research.ts';
import { reviewOf, type Review } from './rules/review.ts';
import { taskProgress } from './rules/tasks.ts';
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

/** 地区上正在发生的事（按位）：大型集会、自然灾害、攻方的“激增”（只有攻方看得到） */
export const HAS_GATHERING = 1;
export const HAS_DISASTER = 2;
export const HAS_SURGE = 4;
/** 这个地区在闹事（措施效果打折）、有临时的医疗支援、口子在漏风（只有攻方知道） */
export const HAS_UNREST = 8;
export const HAS_RELIEF = 16;
export const HAS_LEAK = 32;

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
  /** 措施：每项两位，是它的档位（见 measureLevel）；双方都看得到 */
  readonly measures: Uint32Array;
  /** 现在的病例：攻方是真实的潜伏加发病，守方是按上报估的 */
  readonly cases: Float64Array;
  /** 累计死亡：攻方是真实的，守方是上报的 */
  readonly deaths: Float64Array;
  /** 接种得到免疫的人口比例 */
  readonly immune: Float32Array;
  /** 正在发生的事（按位：HAS_GATHERING、HAS_DISASTER、HAS_UNREST……） */
  readonly happening: Uint8Array;
  /**
   * 有效传播数：一个发病者在这里平均传给几个人（大于 1 在涨，小于 1 在退）。
   * 攻方总是看得到；守方要做完病原鉴定——之前不知道它靠什么传，算不出来，是 -1
   */
  readonly reproduction: Float32Array;
  /** 措施在这里压掉了多少传播（0–1，和一项都不开相比）；守方不知道病原体底细时同样是 -1 */
  readonly suppression: Float32Array;
  /** 医疗被挤兑的程度（0–1）：攻方按真实的发病人数，守方按上报估的 */
  readonly strain: Float32Array;

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
    /** 攻方现在能退掉的性状，和各自返还多少（cost 是返还的点数）；守方是空的 */
    readonly removable: readonly Offer[];
    /** 攻方的技能：要多少点、还要等几天才能用（0 是现在就能用）；守方是空的 */
    readonly skills: readonly {
      readonly id: string;
      readonly cost: number;
      readonly readyIn: number;
    }[];
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
    /** 各支应急队在哪个地区（-1 是待命）、还要走几天才到（0 是已经到了）；双方都看得到 */
    readonly teams: readonly { readonly region: number; readonly arrivesIn: number }[];
    /** 疫苗先给谁 */
    readonly priority: VaccinePolicy;
    /** 再过几天才能开发布会（0 是现在就能开） */
    readonly briefingIn: number;
  };

  /** 正在起作用的临时修正（这一方看得到的）：把哪个数改了多少、还剩几天 */
  readonly modifiers: readonly {
    readonly key: ModifierKey;
    readonly amount: number;
    readonly daysLeft: number;
  }[];
  /** 日程：正在进行的、已经预告的（出行高峰、雨季、国际赛事），快的排前面；双方都看得到 */
  readonly calendar: readonly CalendarEntry[];
  /**
   * 等着这一方拿主意的事：哪一件、还剩几天（到期按第一个选项办）、冲着哪个地区（-1 是不针对某个地区）；
   * 没有是 null
   */
  readonly decision: {
    readonly id: string;
    readonly daysLeft: number;
    readonly region: number;
  } | null;

  /**
   * 这一方手里的短期任务：哪一件、还剩几天、手里有多少、要到多少（cap、shrink 是不能超过多少）；没有是 null
   */
  readonly task: {
    readonly id: string;
    readonly daysLeft: number;
    readonly have: number;
    readonly need: number;
  } | null;
  /** 这一方做到了几件短期任务 */
  readonly tasksDone: number;

  /** 起源地：攻方总是知道，守方要做完溯源；不知道时是 -1 */
  readonly origin: number;
  /** 疾病最近跳到新地区的那几下（只有攻方看得到：守方不知道它是从哪里来的） */
  readonly hops: readonly Hop[];
  /** 态势随时间的记录（这一方看得到的那一份）：每 every 天一笔 */
  readonly history: History & { readonly every: number };
  /** 这一方看得到的新闻，旧的在前 */
  readonly news: readonly NewsItem[];
  readonly outcome: Outcome | null;
  /** 分出胜负之后的回顾：评分、真实的数、大事记；对局中是 null */
  readonly review: Review | null;
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
  const reproduction = new Float32Array(count);
  const suppression = new Float32Array(count);
  const strain = new Float32Array(count);
  const known = attacker || defense.identify >= 1;
  const pathogen = pathogenStats(state);
  const comply = compliance(state);
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
    // 开三次方（八次方根）：一亿人里有一个病例也看得出一点颜色，占到一成就接近最深。
    // 疫情刚冒头时各地区的比例都小得很，只开一次方的话整张地图是黑的，看不出它到了哪里
    const share = people > 0 ? active / people : 0;
    intensity[r] = Math.min(1, Math.sqrt(Math.sqrt(Math.sqrt(share * (attacker ? 1 : 3)))));
    happening[r] =
      (state.gatheringUntil[r]! > state.tick ? HAS_GATHERING : 0) |
      (state.disasterUntil[r]! > state.tick ? HAS_DISASTER : 0) |
      (attacker && state.surgeUntil[r]! > state.tick ? HAS_SURGE : 0) |
      (state.unrestUntil[r]! > state.tick ? HAS_UNREST : 0) |
      (state.reliefUntil[r]! > state.tick ? HAS_RELIEF : 0) |
      (attacker && state.leakUntil[r]! > state.tick ? HAS_LEAK : 0);
    if (known) {
      const spread = reproductionIn(state, r, pathogen, defense, comply);
      reproduction[r] = spread.now;
      suppression[r] = spread.unchecked > 0 ? 1 - spread.now / spread.unchecked : 0;
    } else {
      reproduction[r] = -1;
      suppression[r] = -1;
    }
    strain[r] = strainIn(state, attacker ? state.infectious[r]! : state.visible[r]!, people);
    totalCases += active;
    totalDeaths += deaths[r]!;
    population += people;
    reportedTotal += state.reported[r]!;
    if ((state.reached[r]! & (attacker ? REACHED : REPORTED)) !== 0) reached++;
  }

  const audience = attacker ? FOR_ATTACKER : FOR_DEFENDER;
  const balance = attacker ? { income: 0, upkeep: 0 } : dailyBalance(state);
  const line = state.config.rules.calamityShare * state.worldPopulation;
  const pending = state.config.decisions[state.pendingDecision[player] ?? -1];
  const calendar = calendarNow(state);
  // 赛事开始的当天，主办地的集会要等这一天走完才记上：这里先标出来，免得日程说开始了、地图上还没有
  for (const entry of calendar) {
    if (entry.startsIn === 0 && entry.region >= 0) happening[entry.region]! |= HAS_GATHERING;
  }
  const task = state.config.tasks[state.task[player] ?? -1];
  const taskNow = task && taskProgress(state, task, state.taskStart[player]!);

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
    reproduction,
    suppression,
    strain,
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
      stats: known ? pathogen : null,
      offers: attacker
        ? traits.flatMap((trait, index) =>
            canEvolve(state, index) ? [{ id: trait.id, cost: traitCost(state, index) }] : [],
          )
        : [],
      removable: attacker
        ? traits.flatMap((trait, index) =>
            canDevolve(state, index) ? [{ id: trait.id, cost: devolveRefund(state, index) }] : [],
          )
        : [],
      skills: attacker
        ? state.config.skills.map((skill, index) => ({
            id: skill.id,
            cost: skill.cost,
            readyIn: Math.max(0, state.skillReadyAt[index]! - state.tick),
          }))
        : [],
    },
    defense: {
      trust: state.trust,
      compliance: comply,
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
      teams: Array.from(state.teamRegion, (region, team) => ({
        region,
        arrivesIn: region < 0 ? 0 : Math.max(0, state.teamArrives[team]! - state.tick),
      })),
      priority: VACCINE_POLICIES[state.priority] ?? 'even',
      briefingIn: Math.max(0, state.briefingReadyAt - state.tick),
    },
    modifiers: state.modifiers.flatMap((item) =>
      (item.audience & audience) !== 0 && item.until > state.tick
        ? [{ key: item.key, amount: item.amount, daysLeft: item.until - state.tick }]
        : [],
    ),
    calendar,
    decision: pending
      ? {
          id: pending.id,
          daysLeft: Math.max(0, state.decisionExpires[player]! - state.tick),
          region: state.decisionRegion[player]!,
        }
      : null,
    task:
      task && taskNow
        ? {
            id: task.id,
            daysLeft: Math.max(0, state.taskExpires[player]! - state.tick),
            have: taskNow.have,
            need: taskNow.need,
          }
        : null,
    tasksDone: state.tasksDone[player] ?? 0,
    origin: attacker || defense.trace >= 1 ? state.config.origin : -1,
    hops: attacker ? state.hops.filter((hop) => state.tick - hop.tick <= HOPS_SHOWN_DAYS) : [],
    history: { every: HISTORY_EVERY, ...(attacker ? state.history : state.reportedHistory) },
    news: state.news.filter((item) => (item.audience & audience) !== 0).slice(-NEWS_SHOWN),
    outcome: state.outcome,
    review: reviewOf(state, player),
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
