/**
 * 态势的记录：每隔几天把全世界的几个总数记一笔，界面上画曲线、结算时回看整局用。
 * 真实的数和上报的数各记一份——攻方看前者，守方只看得到后者。
 */
import type { OutbreakState } from '../state.ts';

/** 每隔几天记一笔 */
export const HISTORY_EVERY = 7;

/** 一条曲线上的几组数，下标是第几笔（第 i 笔是第 i × HISTORY_EVERY 天的） */
export interface History {
  /** 当时的病例：真实的是潜伏加发病，上报的是按上报估的 */
  cases: number[];
  /** 累计死亡 */
  deaths: number[];
  /** 累计感染（上报的是累计上报病例） */
  infected: number[];
}

export const emptyHistory = (): History => ({ cases: [], deaths: [], infected: [] });

const sum = (values: Float64Array) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/** 到了该记的那天就记一笔 */
export function recordHistory(state: OutbreakState) {
  if (state.tick % HISTORY_EVERY !== 0) return;
  state.history.cases.push(sum(state.exposed) + sum(state.infectious));
  state.history.deaths.push(sum(state.deaths));
  state.history.infected.push(state.infectedTotal);
  state.reportedHistory.cases.push(sum(state.visible));
  state.reportedHistory.deaths.push(sum(state.reportedDeaths));
  state.reportedHistory.infected.push(sum(state.reported));
}
