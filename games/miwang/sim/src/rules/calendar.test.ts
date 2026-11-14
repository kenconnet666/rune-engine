/** 日程：每年固定日子到来、提前预告的事；和灾后往外逃的人 */
import { describe, expect, it } from 'vitest';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, type OutbreakState } from '../state.ts';
import { TEST_CALENDAR, testConfig } from '../testing/world.ts';
import { HAS_GATHERING } from '../view.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
const quiet = { eventChance: 0 };
/** 测试配置从 11 月 13 日（一年里的第 316 天）开局 */
const withCalendar = (rules = {}) =>
  createState(testConfig({ ...quiet, ...rules }, { calendar: TEST_CALENDAR }));
const entries = (state: OutbreakState, player = DEFENDER) =>
  outbreak.observe(state, player).calendar;

describe('日程', () => {
  it('提前预告，到日子开始，过了日子结束；双方都看得到', () => {
    const state = withCalendar();
    // 开局那天：雨季（第 320 天）还有 4 天，预告是提前 3 天——还没上日程
    expect(entries(state)).toEqual([]);
    run(state, 2);
    // 第 318 天：雨季还有 2 天
    expect(entries(state)).toEqual([
      { id: 'wet', kind: 'rains', startsIn: 2, daysLeft: 20, region: -1 },
    ]);
    expect(entries(state, ATTACKER)).toEqual(entries(state));
    run(state, 4);
    // 第 322 天：雨季进行到第 3 天；出行高峰（第 326 天）进了预告；赛事（第 330 天）也预告了
    expect(entries(state).map((entry) => [entry.id, entry.startsIn, entry.daysLeft])).toEqual([
      ['wet', 0, 18],
      ['rush', 4, 10],
      ['cup', 8, 8],
    ]);
    run(state, 30);
    // 第 352 天：都过去了
    expect(entries(state)).toEqual([]);
  });

  it('预告和开始各记一条新闻', () => {
    const state = withCalendar();
    run(state, 6);
    const news = outbreak
      .observe(state, ATTACKER)
      .news.filter((item) => item.kind === 'calendar')
      .map((item) => `${item.tick}:${item.subject}`);
    // 第 1 步（第 317 天）预告雨季，第 4 步（第 320 天）开始；第 4 步同时预告赛事；第 5 步预告出行高峰
    expect(news).toEqual(['1:wet.soon', '4:wet.begin', '4:cup.soon', '5:rush.soon']);
  });

  it('国际赛事：主办地是经济最大的几个地区之一，开赛时那里有一场集会', () => {
    const state = withCalendar();
    run(state, 14);
    const cup = entries(state).find((entry) => entry.id === 'cup')!;
    expect(cup.startsIn).toBe(0);
    expect(cup.region).toBeGreaterThanOrEqual(0);
    expect(outbreak.observe(state, DEFENDER).happening[cup.region]! & HAS_GATHERING).toBe(
      HAS_GATHERING,
    );
    // 预告时说的就是这个地方
    const soon = state.news.find((item) => item.subject === 'cup.soon')!;
    expect(soon.region).toBe(cup.region);
  });

  it('雨季只让热带的水源、蚊媒传播加强', () => {
    // 水源传播的病原体；第 0 个地区是热带，找一个不是热带的比
    const config = testConfig(quiet, {
      calendar: TEST_CALENDAR,
      pathogen: {
        id: 'water',
        base: { water: 0.3, severity: 1, lethality: 0.01 },
        incubationDays: 4,
        infectiousDays: 7,
        climate: [1, 1, 1],
      },
    });
    const tropical = config.regions.findIndex((region) => region.climate === 0);
    const other = config.regions.findIndex((region) => region.climate !== 0);
    const state = createState(config);
    const before = outbreak.observe(state, ATTACKER).reproduction;
    run(state, 5);
    const during = outbreak.observe(state, ATTACKER).reproduction;
    // 易感的人几乎没变（第 other 个地区根本没人感染），传播数的变化就是雨季带来的
    expect(during[other]).toBeCloseTo(before[other]!, 5);
    expect(during[tropical]! / before[tropical]!).toBeGreaterThan(1.3);
  });

  it('出行高峰：同样的局面，高峰期传到别的地区更早', () => {
    const reached = (calendar: boolean) => {
      const state = createState(
        testConfig(
          { ...quiet, airRate: 0, seaRate: 0, landRate: 0.0006 },
          { calendar: calendar ? [{ ...TEST_CALENDAR[0]!, day: 316, days: 60, amount: 6 }] : [] },
        ),
      );
      state.infectious[0] = 3000;
      run(state, 12);
      return outbreak.observe(state, ATTACKER).totals.regions;
    };
    expect(reached(true)).toBeGreaterThan(reached(false));
  });

  it('幅度调成 0 就没有日程', () => {
    const state = withCalendar({ calendarStrength: 0 });
    run(state, 8);
    expect(entries(state)).toEqual([]);
    expect(state.news.some((item) => item.kind === 'calendar')).toBe(false);
  });
});

describe('难民', () => {
  it('遭了灾的地区，沿陆路往外走的人多：传到邻近地区更早', () => {
    const reached = (disaster: boolean) => {
      const state = createState(
        testConfig({ ...quiet, airRate: 0, seaRate: 0, landRate: 0.0006, refugeeLand: 8 }),
      );
      state.infectious[0] = 3000;
      if (disaster) state.disasterUntil[0] = 1000;
      run(state, 12);
      return outbreak.observe(state, ATTACKER).totals.regions;
    };
    expect(reached(true)).toBeGreaterThan(reached(false));
  });
});
