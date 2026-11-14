import { seedRandom, type PlayerId, type RandomState } from '@rune-engine/core';
import type { ModifierKey, OutbreakConfig } from './config.ts';
import { emptyHistory, type History } from './rules/history.ts';

/** 攻方、守方的编号 */
export const ATTACKER: PlayerId = 0;
export const DEFENDER: PlayerId = 1;

/** reached 里的位：真的出现过感染（攻方知道）、上报过病例（守方知道） */
export const REACHED = 1;
export const REPORTED = 2;

/** techs 里的取值 */
export const TECH_IDLE = 0;
export const TECH_ACTIVE = 1;
export const TECH_DONE = 2;

/** 谁看得到一条新闻（按位） */
export const FOR_ATTACKER = 1;
export const FOR_DEFENDER = 2;
export const FOR_BOTH = 3;

/**
 * 新闻的种类：
 *   spread 病原体出现在一个新地区（只有攻方知道）   report 一个地区第一次上报病例
 *   evolve 病原体换了一个性状   research 一项研究完成   vaccine 开始接种
 *   event 发生了一件事（subject 是事件的 id）   traced 找到了起源地   outcome 分出了胜负
 *   team 应急队抵达一个地区   briefing 守方开了发布会
 *   skill 攻方用了一个技能（subject 是技能的 id）   devolve 病原体退掉了一个性状
 *   decision 一方对一件事拿了主意（subject 是“事.选项”）
 */
export type NewsKind =
  | 'spread'
  | 'report'
  | 'evolve'
  | 'research'
  | 'vaccine'
  | 'event'
  | 'traced'
  | 'outcome'
  | 'team'
  | 'briefing'
  | 'skill'
  | 'devolve'
  | 'decision';

export interface NewsItem {
  readonly tick: number;
  readonly kind: NewsKind;
  /** 相关的地区（下标），没有时是 -1 */
  readonly region: number;
  /** 相关的性状、科技、事件的 id，没有时是空串 */
  readonly subject: string;
  readonly audience: number;
}

/** 疾病跳到一个新地区的那一下：从哪里来、走的哪种路线（地图上画成一道弧线） */
export interface Hop {
  readonly tick: number;
  readonly from: number;
  readonly to: number;
  readonly route: 'land' | 'air' | 'sea';
}

/**
 * 胜负：calamity 死亡越过灾厄线（攻方赢）、eradicated 病原体被清除、timeout 守到了期限（后两种守方赢）；
 * 剧本里是 goal 攻方做到了这一章的目标、held 守方守到了这一章的期限
 */
export interface Outcome {
  readonly winner: PlayerId;
  readonly reason: 'calamity' | 'eradicated' | 'timeout' | 'goal' | 'held';
  readonly tick: number;
}

/** 一条临时的全局修正：把哪个数改多少，到哪一步为止（不含），谁看得到 */
export interface Modifier {
  readonly key: ModifierKey;
  readonly amount: number;
  readonly until: number;
  readonly audience: number;
}

/** 新闻最多留这么多条，旧的丢掉 */
export const NEWS_LIMIT = 80;

export interface OutbreakState {
  tick: number;
  random: RandomState;

  // 各地区的人群，都是整数人数
  susceptible: Float64Array;
  exposed: Float64Array;
  infectious: Float64Array;
  recovered: Float64Array;
  /** 接种得到免疫的人 */
  immune: Float64Array;
  deaths: Float64Array;

  // 守方看得到的部分
  /** 累计上报的病例、死亡 */
  reported: Float64Array;
  reportedDeaths: Float64Array;
  /** 按上报估出来的“现在还在发病”的人数：每天加上新上报的，再按病程衰减 */
  visible: Float64Array;
  /** 各地区按位：REACHED、REPORTED */
  reached: Uint8Array;

  /** 各地区的措施：每项两位，是它的档位（见 config 的 measureLevel） */
  measures: Uint32Array;
  /** 各支应急队派去了哪个地区（下标，-1 是待命），和到达的那一步（到了才起作用） */
  teamRegion: Int16Array;
  teamArrives: Int32Array;
  /** 疫苗先给谁（VACCINE_POLICIES 的下标） */
  priority: number;
  /** 下一次能开发布会的那一步 */
  briefingReadyAt: number;
  /** 大型集会、自然灾害、攻方的“激增”在各地区持续到哪一步（不含） */
  gatheringUntil: Int32Array;
  disasterUntil: Int32Array;
  surgeUntil: Int32Array;
  /** 各个技能下一次能用的那一步（下标同 config.skills） */
  skillReadyAt: Int32Array;
  /** 正在起作用的临时修正 */
  modifiers: Modifier[];
  /**
   * 等着双方各自拿主意的事（下标是玩家：0 攻方、1 守方）：是 config.decisions 里的第几件（-1 是没有）、
   * 到哪一步为止；和每件事出现过几次
   */
  pendingDecision: Int16Array;
  decisionExpires: Int32Array;
  decisionSeen: Uint8Array;

  /** 攻方有没有某个性状（下标同 config.traits） */
  traits: Uint8Array;
  /** 各项科技的状态（TECH_*）和还要做几天 */
  techs: Uint8Array;
  techRemaining: Float64Array;

  /** 攻方的变异点、守方的预算 */
  points: number;
  budget: number;
  /** 公众信任（0–1） */
  trust: number;
  /** 昨天的维持费付得起多少（0–1）：付不起的部分，措施的效果跟着打折 */
  funding: number;
  /** 守方累计少收的预算（封锁、停飞等的经济代价） */
  economyLost: number;
  /** 累计感染过的人次 */
  infectedTotal: number;
  /** 连续多少天任何地方都没有潜伏者和发病者 */
  clearStreak: number;

  news: NewsItem[];
  /** 疾病每一次跳到新地区的记录，按先后排 */
  hops: Hop[];
  /** 态势随时间的记录：真实的一份、上报的一份 */
  history: History;
  reportedHistory: History;
  outcome: Outcome | null;

  // 下面是开局时从配置算出来的，整局不变，不进哈希
  /** 开局时的世界人口 */
  readonly worldPopulation: number;
  /** 开局那天是一年里的第几天（0 起） */
  readonly startYearDay: number;
  /** 性状、科技的 id → 下标 */
  readonly traitIndex: ReadonlyMap<string, number>;
  readonly techIndex: ReadonlyMap<string, number>;
  readonly config: OutbreakConfig;
}

/** 平年里每个月 1 日是第几天 */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** 'YYYY-MM-DD' 是一年里的第几天（0 起，不管闰年：季节用不着那一天的精度） */
function yearDay(date: string): number {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return (MONTH_START[month - 1] ?? 0) + day - 1;
}

const indexById = (items: readonly { readonly id: string }[]) =>
  new Map(items.map((item, index) => [item.id, index]));

export function createState(config: OutbreakConfig): OutbreakState {
  const count = config.regions.length;
  const { rules } = config;
  const state: OutbreakState = {
    tick: 0,
    random: seedRandom(config.seed),
    susceptible: Float64Array.from(config.regions, (region) => region.population),
    exposed: new Float64Array(count),
    infectious: new Float64Array(count),
    recovered: new Float64Array(count),
    immune: new Float64Array(count),
    deaths: new Float64Array(count),
    reported: new Float64Array(count),
    reportedDeaths: new Float64Array(count),
    visible: new Float64Array(count),
    reached: new Uint8Array(count),
    measures: new Uint32Array(count),
    teamRegion: new Int16Array(rules.teams).fill(-1),
    teamArrives: new Int32Array(rules.teams),
    priority: 0,
    briefingReadyAt: 0,
    gatheringUntil: new Int32Array(count),
    disasterUntil: new Int32Array(count),
    surgeUntil: new Int32Array(count),
    skillReadyAt: new Int32Array(config.skills.length),
    modifiers: [],
    pendingDecision: new Int16Array(2).fill(-1),
    decisionExpires: new Int32Array(2),
    decisionSeen: new Uint8Array(config.decisions.length),
    traits: new Uint8Array(config.traits.length),
    techs: new Uint8Array(config.techs.length),
    techRemaining: new Float64Array(config.techs.length),
    points: rules.startPoints,
    budget: rules.startBudget,
    trust: rules.startTrust,
    funding: 1,
    economyLost: 0,
    infectedTotal: 0,
    clearStreak: 0,
    news: [],
    hops: [],
    history: emptyHistory(),
    reportedHistory: emptyHistory(),
    outcome: null,
    worldPopulation: config.regions.reduce((sum, region) => sum + region.population, 0),
    startYearDay: yearDay(config.startDate),
    traitIndex: indexById(config.traits),
    techIndex: indexById(config.techs),
    config,
  };
  const seeded = Math.min(rules.seedCases, state.susceptible[config.origin] ?? 0);
  if (seeded > 0) {
    state.susceptible[config.origin]! -= seeded;
    state.infectious[config.origin]! += seeded;
    state.infectedTotal = seeded;
    state.reached[config.origin]! |= REACHED;
  }
  return state;
}

/** 记一条新闻 */
export function report(
  state: OutbreakState,
  kind: NewsKind,
  audience: number,
  region = -1,
  subject = '',
) {
  state.news.push({ tick: state.tick, kind, region, subject, audience });
  if (state.news.length > NEWS_LIMIT) state.news.splice(0, state.news.length - NEWS_LIMIT);
}

/** 一个地区还活着的人数 */
export function alive(state: OutbreakState, region: number): number {
  return (
    state.susceptible[region]! +
    state.exposed[region]! +
    state.infectious[region]! +
    state.recovered[region]! +
    state.immune[region]!
  );
}
