/** 攻方的技能（外溢、激增、蛰伏）和退化 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { HAS_SURGE } from '../view.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
const steady = { eventChance: 0, trustBaseline: 1, startTrust: 1, trustDeaths: 0 };
const skillOf = (state: OutbreakState, id: string) =>
  outbreak.observe(state, ATTACKER).pathogen.skills.find((skill) => skill.id === id)!;

describe('技能', () => {
  it('外溢：在没到过的地区凭空落脚；花点数、进冷却，只有攻方知道', () => {
    const state = createState(testConfig(steady));
    state.points = 20;
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'spillover', region: 5 });
    expect(state.exposed[5]).toBe(20);
    expect(state.points).toBe(12);
    expect(skillOf(state, 'spillover').readyIn).toBe(30);
    expect(outbreak.observe(state, ATTACKER).news.at(-1)).toMatchObject({
      kind: 'skill',
      subject: 'spillover',
      region: 5,
    });
    expect(outbreak.observe(state, DEFENDER).news.some((item) => item.kind === 'skill')).toBe(
      false,
    );

    // 冷却里再用没有用；已经到过的地区（起源地）也不行
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'spillover', region: 6 });
    expect(state.exposed[6]).toBe(0);
    state.skillReadyAt.fill(0);
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'spillover', region: 0 });
    expect(state.points).toBe(12);
  });

  it('激增：到过的地区在一段时间里传得更快，过了就恢复', () => {
    const state = createState(testConfig(steady));
    state.points = 20;
    const before = outbreak.observe(state, ATTACKER).reproduction[0]!;
    // 没到过的地区用不了
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'surge', region: 4 });
    expect(state.points).toBe(20);
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'surge', region: 0 });
    const during = outbreak.observe(state, ATTACKER);
    expect(during.reproduction[0]).toBeCloseTo(before * state.config.rules.surgeBoost, 4);
    expect(during.happening[0]! & HAS_SURGE).not.toBe(0);
    // 守方看不到这个标记
    expect(outbreak.observe(state, DEFENDER).happening[0]! & HAS_SURGE).toBe(0);
    state.tick += 10;
    expect(outbreak.observe(state, ATTACKER).happening[0]! & HAS_SURGE).toBe(0);
  });

  it('蛰伏：一段时间里更难被发现、也传得慢一些；修正只有攻方看得到，到期消失', () => {
    const config = testConfig({ ...steady, landRate: 0, airRate: 0, seaRate: 0 });
    const reportedAfter = (veiled: boolean) => {
      const state = createState(config);
      state.points = 20;
      if (veiled) applyCommand(state, ATTACKER, { type: 'skill', skill: 'veil' });
      run(state, 14);
      return state.reported[0]!;
    };
    expect(reportedAfter(true)).toBeLessThan(reportedAfter(false));

    const state = createState(config);
    state.points = 20;
    const before = outbreak.observe(state, ATTACKER).reproduction[0]!;
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'veil' });
    const view = outbreak.observe(state, ATTACKER);
    expect(view.reproduction[0]).toBeCloseTo(before * 0.9, 4);
    expect(view.modifiers).toEqual([
      { key: 'detect', amount: -0.2, daysLeft: 15 },
      { key: 'spread', amount: -0.1, daysLeft: 15 },
    ]);
    expect(outbreak.observe(state, DEFENDER).modifiers).toEqual([]);
    run(state, 16);
    expect(state.modifiers).toEqual([]);
  });

  it('用技能、换性状只扣它自己的价钱：剩下的点数留着，接着攒、接着用', () => {
    const state = createState(testConfig({ ...steady, pointsPerDay: 0.5 }));
    state.points = 31;
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'veil' });
    expect(state.points).toBe(25);
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'stealth' });
    expect(state.points).toBe(19);
    // 接着攒：过几天只多不少
    run(state, 4);
    expect(state.points).toBeGreaterThanOrEqual(21);
    // 剩下的还能接着用在别的技能上
    const before = state.points;
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'surge', region: 0 });
    expect(state.points).toBe(before - 5);
  });

  it('点数不够、没有这个技能、守方来下命令：都不生效', () => {
    const state = createState(testConfig(steady));
    state.points = 2;
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'surge', region: 0 });
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'nonsense', region: 0 });
    state.points = 50;
    applyCommand(state, DEFENDER, { type: 'skill', skill: 'surge', region: 0 });
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'surge', region: 99 });
    expect(state.points).toBe(50);
    expect([...state.surgeUntil]).toEqual(new Array(state.surgeUntil.length).fill(0));
  });
});

describe('退化', () => {
  it('退掉一个性状拿回底价的一部分，之后的性状跟着便宜', () => {
    const state = createState(testConfig(steady));
    state.points = 100;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'stealth' });
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'drift' });
    const priceWithTwo = outbreak
      .observe(state, ATTACKER)
      .pathogen.offers.find((offer) => offer.id === 'air1')!.cost;
    const points = state.points;

    expect(outbreak.observe(state, ATTACKER).pathogen.removable).toContainEqual({
      id: 'stealth',
      cost: 3,
    });
    applyCommand(state, ATTACKER, { type: 'devolve', trait: 'stealth' });
    const view = outbreak.observe(state, ATTACKER);
    expect(state.points).toBe(points + 3);
    expect(view.pathogen.owned).toEqual(['drift']);
    expect(view.pathogen.stats?.stealth).toBe(0);
    expect(view.pathogen.offers.find((offer) => offer.id === 'air1')!.cost).toBeLessThan(
      priceWithTwo,
    );
    expect(view.news.at(-1)).toMatchObject({ kind: 'devolve', subject: 'stealth' });
  });

  it('别的性状还靠它当前置时退不掉；还有另一条前置撑着就可以', () => {
    const state = createState(testConfig(steady));
    state.points = 200;
    for (const trait of ['fever', 'failure']) {
      applyCommand(state, ATTACKER, { type: 'evolve', trait });
    }
    // “衰竭”的前置是“发热”或“水源”任意一个：现在只有“发热”撑着
    applyCommand(state, ATTACKER, { type: 'devolve', trait: 'fever' });
    expect(outbreak.observe(state, ATTACKER).pathogen.owned).toEqual(['fever', 'failure']);

    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'water1' });
    applyCommand(state, ATTACKER, { type: 'devolve', trait: 'fever' });
    expect(outbreak.observe(state, ATTACKER).pathogen.owned).toEqual(['water1', 'failure']);
    // 没有的性状、守方来退：不生效
    const points = state.points;
    applyCommand(state, ATTACKER, { type: 'devolve', trait: 'fever' });
    applyCommand(state, DEFENDER, { type: 'devolve', trait: 'water1' });
    expect(state.points).toBe(points);
  });
});
