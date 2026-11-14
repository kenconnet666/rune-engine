import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { measuresOf } from '../config.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
/** 信任满格、不出事件：措施不打折，数好核对 */
const steady = { eventChance: 0, trustBaseline: 1, startTrust: 1, trustDeaths: 0 };

describe('传播数、措施压掉的传播、医疗挤兑（给界面看的）', () => {
  it('没人免疫、没有措施时，传播数就是“每天传几个人 × 能传几天”，各地区按自己的条件不一样', () => {
    const state = createState(testConfig(steady));
    const view = outbreak.observe(state, ATTACKER);
    // 测试世界的病原体：一个发病者一天传 0.2–0.3 个人、病程 7 天上下
    for (const value of view.reproduction) {
      expect(value).toBeGreaterThan(0.5);
      expect(value).toBeLessThan(6);
    }
    expect(new Set(view.reproduction).size).toBeGreaterThan(2);
    // 没开措施：什么都没压掉
    expect([...view.suppression]).toEqual(new Array(view.suppression.length).fill(0));
  });

  it('开了措施，那里的传播数下来，压掉的比例上去；别的地区不受影响', () => {
    const state = createState(testConfig(steady));
    const before = outbreak.observe(state, ATTACKER);
    state.measures[0] = measuresOf({ lockdown: 3, masks: 3 });
    const after = outbreak.observe(state, ATTACKER);
    expect(after.reproduction[0]).toBeLessThan(before.reproduction[0]!);
    expect(after.suppression[0]).toBeGreaterThan(0.3);
    expect(after.suppression[0]).toBeCloseTo(1 - after.reproduction[0]! / before.reproduction[0]!);
    expect(after.reproduction[1]).toBe(before.reproduction[1]);
  });

  it('感染过的人多了，传播数跟着易感者的比例往下掉', () => {
    const state = createState(testConfig({ ...steady, landRate: 0, seaRate: 0, airRate: 0 }));
    const start = outbreak.observe(state, ATTACKER).reproduction[0]!;
    run(state, 250);
    expect(state.susceptible[0]).toBeLessThan(state.config.regions[0]!.population * 0.9);
    expect(outbreak.observe(state, ATTACKER).reproduction[0]).toBeLessThan(start);
  });

  it('守方做完病原鉴定之前算不出传播数和压制（是 -1），做完之后和攻方看到的一样', () => {
    const state = createState(testConfig(steady));
    const hidden = outbreak.observe(state, DEFENDER);
    expect(hidden.reproduction[0]).toBe(-1);
    expect(hidden.suppression[0]).toBe(-1);

    state.budget = 1000;
    applyCommand(state, DEFENDER, { type: 'research', tech: 'identify' });
    run(state, 15);
    const known = outbreak.observe(state, DEFENDER);
    expect(known.reproduction[0]).toBeGreaterThan(0);
    expect([...known.reproduction]).toEqual([...outbreak.observe(state, ATTACKER).reproduction]);
  });

  it('医疗挤兑按发病的人占人口的比例算；守方看到的是按上报估的，不会比真实的高', () => {
    const state = createState(testConfig(steady));
    // 让刚好够把医疗挤兑的那么多人病倒（从易感的人里出，总人口不变）
    const sick = Math.round(state.susceptible[0]! * state.config.rules.careCapacity);
    state.susceptible[0]! -= sick;
    state.infectious[0]! += sick;
    expect(outbreak.observe(state, ATTACKER).strain[0]).toBeCloseTo(1, 2);
    expect(outbreak.observe(state, DEFENDER).strain[0]).toBe(0);
  });
});
