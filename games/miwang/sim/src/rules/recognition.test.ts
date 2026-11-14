/** 认出一种新的病：零星的病例要攒够一小簇才开始上报 */
import { describe, expect, it } from 'vitest';
import { outbreak } from '../outbreak.ts';
import { createState, DEFENDER, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';

/** 只在起源地里传（不出行），没有随机的事 */
const sealed = { eventChance: 0, landRate: 0, airRate: 0, seaRate: 0 };
/** 走到头一回有地区上报为止，返回那是第几天（一直没有是 -1） */
function firstReportDay(state: OutbreakState, limit = 200): number {
  for (let day = 0; day < limit; day++) {
    outbreak.step(state, []);
    if (state.news.some((item) => item.kind === 'report')) return state.tick;
  }
  return -1;
}

describe('认出一种新的病', () => {
  it('要攒的例数越多，头一回上报越晚；上报之前守方什么都看不到', () => {
    const quick = createState(testConfig({ ...sealed, recognizeFirst: 1 }));
    const slow = createState(testConfig({ ...sealed, recognizeFirst: 12 }));
    const quickDay = firstReportDay(quick);
    expect(quickDay).toBeGreaterThan(0);

    for (let day = 0; day < quickDay; day++) outbreak.step(slow, []);
    // 同一天，慢的那边已经零星发现了几例，但还没认出来
    expect(slow.unnoticed[0]).toBeGreaterThan(0);
    expect(slow.news.some((item) => item.kind === 'report')).toBe(false);
    const hidden = outbreak.observe(slow, DEFENDER);
    expect(hidden.totals.regions).toBe(0);
    expect(hidden.cases[0]).toBe(0);

    expect(firstReportDay(slow)).toBeGreaterThan(quickDay);
  });

  it('认出来的那天，之前零星发现的一起算进上报', () => {
    const state = createState(testConfig({ ...sealed, recognizeFirst: 8 }));
    expect(firstReportDay(state)).toBeGreaterThan(0);
    expect(state.reported[0]).toBeGreaterThanOrEqual(8);
    expect(state.unnoticed[0]).toBe(0);
    expect(outbreak.observe(state, DEFENDER).cases[0]).toBeGreaterThanOrEqual(8);
  });

  it('别处报过之后有了戒心，新的地区几例就认得出；做完病原鉴定一例就够', () => {
    const rules = { ...sealed, recognizeFirst: 8, recognizeLater: 3 };
    /** 起源地已经上报，1 号地区刚进来一批感染者：看它攒到几例才上报 */
    const reportedAt = (identified: boolean) => {
      const state = createState(testConfig(rules));
      expect(firstReportDay(state)).toBeGreaterThan(0);
      if (identified) state.techs[state.techIndex.get('identify')!] = 2;
      state.susceptible[1]! -= 400;
      state.exposed[1]! += 400;
      state.reached[1]! |= 1;
      for (let day = 0; day < 60 && state.reported[1] === 0; day++) outbreak.step(state, []);
      return state.reported[1]!;
    };
    // 上报的那一刻攒到的例数不会少于门槛
    expect(reportedAt(false)).toBeGreaterThanOrEqual(3);
    expect(reportedAt(true)).toBeGreaterThanOrEqual(1);
  });
});
