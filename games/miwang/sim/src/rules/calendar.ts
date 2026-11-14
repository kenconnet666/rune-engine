/**
 * 日程：每年固定日子到来的事，提前若干天就知道（日程表见内容的 tables/calendar.ts）。
 *   travel 出行高峰：这段时间各条路线上的人都多
 *   rains  雨季：热带地区的水源、蚊媒传播加强
 *   games  国际赛事：一个经济大国办赛，那里人群聚集，全世界坐飞机的人也多
 * 和随机的事件不同，它们是可以提前准备的：守方可以赶在高峰前管住口子，攻方可以把力气留到这时候。
 * 什么时候开始只看日期，不占状态；开始、预告各记一条新闻，赛事开始时在主办地记一场集会。
 */
import { TROPICAL, type CalendarDef, type CalendarKind, type OutbreakConfig } from '../config.ts';
import { FOR_BOTH, report, type OutbreakState } from '../state.ts';

const YEAR = 365;
/** 办赛的候选：经济最大的这么多个地区，一年换一个 */
const HOSTS = 12;

/** 今天是一年里的第几天（0 起） */
const yearDay = (state: OutbreakState) => (state.startYearDay + state.tick) % YEAR;

/** 这一项进行到第几天了（0 起）；不在进行中是 -1 */
function dayInto(def: CalendarDef, day: number): number {
  const into = (day - def.day + YEAR) % YEAR;
  return into < def.days ? into : -1;
}

/** 离这一项开始还有几天（今天开始是 0） */
const daysUntil = (def: CalendarDef, day: number) => (def.day - day + YEAR) % YEAR;

/** 这一类日程现在一共把那个数加了多少（没有在进行的是 0） */
export function calendarBoost(state: OutbreakState, kind: CalendarKind): number {
  const { calendar, rules } = state.config;
  if (calendar.length === 0 || rules.calendarStrength <= 0) return 0;
  const day = yearDay(state);
  let total = 0;
  for (const def of calendar) {
    if (def.kind === kind && dayInto(def, day) >= 0) total += def.amount;
  }
  return total * rules.calendarStrength;
}

/** 雨季让一个地区的水源、蚊媒传播变成几倍（只有热带有雨季） */
export const rainsIn = (state: OutbreakState, region: number): number =>
  state.config.regions[region]!.climate === TROPICAL ? 1 + calendarBoost(state, 'rains') : 1;

const hostsOf = new WeakMap<OutbreakConfig, readonly number[]>();

/** 第几年（从开局那年算起）的赛事在哪里办；别的日程不针对某个地区，是 -1 */
function hostOf(state: OutbreakState, def: CalendarDef, year: number): number {
  if (def.kind !== 'games') return -1;
  const { config } = state;
  let hosts = hostsOf.get(config);
  if (!hosts) {
    hosts = config.regions
      .map((region, index) => ({ index, economy: region.economy }))
      .sort((a, b) => b.economy - a.economy || a.index - b.index)
      .slice(0, HOSTS)
      .map((candidate) => candidate.index);
    hostsOf.set(config, hosts);
  }
  return hosts[(Math.abs(config.seed) + year) % hosts.length] ?? -1;
}

/** 从现在起 ahead 天之后是开局以来的第几年 */
const yearAt = (state: OutbreakState, ahead: number) =>
  Math.floor((state.startYearDay + state.tick + ahead) / YEAR);

/** 每天：到了预告的日子、开始的日子各记一条新闻；赛事开始时主办地有一场集会 */
export function rollCalendar(state: OutbreakState) {
  const { calendar, rules } = state.config;
  if (calendar.length === 0 || rules.calendarStrength <= 0) return;
  const day = yearDay(state);
  for (const def of calendar) {
    const until = daysUntil(def, day);
    if (until === 0) {
      const host = hostOf(state, def, yearAt(state, 0));
      if (host >= 0) {
        state.gatheringUntil[host] = Math.max(state.gatheringUntil[host]!, state.tick + def.days);
      }
      report(state, 'calendar', FOR_BOTH, host, `${def.id}.begin`);
    } else if (until === def.notice) {
      report(
        state,
        'calendar',
        FOR_BOTH,
        hostOf(state, def, yearAt(state, until)),
        `${def.id}.soon`,
      );
    }
  }
}

export interface CalendarEntry {
  readonly id: string;
  readonly kind: CalendarKind;
  /** 还有几天开始；已经开始了是 0 */
  readonly startsIn: number;
  /** 开始之后还剩几天；还没开始时是它一共几天 */
  readonly daysLeft: number;
  /** 针对的地区（赛事的主办地）；没有是 -1 */
  readonly region: number;
}

/** 正在进行的、已经预告的日程，快的排前面 */
export function calendarNow(state: OutbreakState): CalendarEntry[] {
  const { calendar, rules } = state.config;
  if (calendar.length === 0 || rules.calendarStrength <= 0) return [];
  const day = yearDay(state);
  const entries: CalendarEntry[] = [];
  for (const def of calendar) {
    const into = dayInto(def, day);
    if (into >= 0) {
      // 赛事跨年的时候，按它开始的那一年算主办地
      const region = hostOf(state, def, yearAt(state, -into));
      entries.push({ id: def.id, kind: def.kind, startsIn: 0, daysLeft: def.days - into, region });
      continue;
    }
    const until = daysUntil(def, day);
    if (until <= def.notice) {
      const region = hostOf(state, def, yearAt(state, until));
      entries.push({ id: def.id, kind: def.kind, startsIn: until, daysLeft: def.days, region });
    }
  }
  return entries.sort((a, b) => a.startsIn - b.startsIn || a.daysLeft - b.daysLeft);
}
