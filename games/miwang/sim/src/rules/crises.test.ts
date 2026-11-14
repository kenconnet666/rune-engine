/** 危机：局面到了某个地步才出的抉择，和选项落在那个地区的效果 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { withMeasure } from '../config.ts';
import { outbreak } from '../outbreak.ts';
import {
  ATTACKER,
  createState,
  DEFENDER,
  REPORTED,
  TECH_DONE,
  type OutbreakState,
} from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { HAS_LEAK, HAS_RELIEF, HAS_UNREST } from '../view.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
/** 危机开着，别的随机的事不出；封锁、关口子连着五天就算久 */
const crises = { eventChance: 0, crisisGap: 40, fatigueDays: 5, sealedDays: 5 };
const pendingOf = (state: OutbreakState, player: number) =>
  outbreak.observe(state, player).decision;

describe('危机', () => {
  it('封锁太久：守方碰上一件冲着那个地区的事；硬撑，那里闹事、措施打折', () => {
    const state = createState(testConfig(crises));
    state.budget = 1000;
    state.measures[0] = withMeasure(0, 'lockdown', 2);
    run(state, 4);
    expect(pendingOf(state, DEFENDER)).toBeNull();
    run(state, 1);
    expect(pendingOf(state, DEFENDER)).toMatchObject({ id: 'weary', region: 0 });
    // 攻方没有这件事
    expect(pendingOf(state, ATTACKER)).toBeNull();

    const before = outbreak.observe(state, ATTACKER).reproduction[0]!;
    const trust = state.trust;
    applyCommand(state, DEFENDER, { type: 'decide', decision: 'weary', option: 'hold' });
    expect(state.unrestUntil[0]).toBe(state.tick + 20);
    expect(state.trust).toBeCloseTo(trust - 0.04);
    expect(outbreak.observe(state, ATTACKER).reproduction[0]).toBeGreaterThan(before);
    // 闹事是公开的：双方都看得到，新闻里带着地区
    expect(outbreak.observe(state, DEFENDER).happening[0]! & HAS_UNREST).toBe(HAS_UNREST);
    expect(outbreak.observe(state, ATTACKER).news.at(-1)).toMatchObject({
      kind: 'decision',
      subject: 'weary.hold',
      region: 0,
    });
    // 过了日子就平息
    run(state, 20);
    expect(outbreak.observe(state, DEFENDER).happening[0]! & HAS_UNREST).toBe(0);
  });

  it('封锁太久：放松一档；同一种危机隔够了天数才再出', () => {
    const state = createState(testConfig(crises));
    state.budget = 1000;
    state.measures[0] = withMeasure(0, 'lockdown', 3);
    state.measures[1] = withMeasure(0, 'lockdown', 2);
    run(state, 5);
    expect(pendingOf(state, DEFENDER)).toMatchObject({ id: 'weary', region: 0 });
    applyCommand(state, DEFENDER, { type: 'decide', decision: 'weary', option: 'ease' });
    expect(outbreak.observe(state, DEFENDER).measures[0]).toBe(withMeasure(0, 'lockdown', 2));
    // 另一个地区也封了很久，但这种危机刚出过：要等
    run(state, 30);
    expect(pendingOf(state, DEFENDER)).toBeNull();
    run(state, 10);
    expect(pendingOf(state, DEFENDER)?.id).toBe('weary');
  });

  it('到期没选按第一个选项办，落在那个地区', () => {
    const state = createState(testConfig(crises));
    state.budget = 1000;
    state.measures[0] = withMeasure(0, 'lockdown', 2);
    run(state, 5);
    expect(pendingOf(state, DEFENDER)?.id).toBe('weary');
    run(state, 5);
    expect(pendingOf(state, DEFENDER)).toBeNull();
    expect(state.unrestUntil[0]).toBeGreaterThan(state.tick);
  });

  it('医疗挤兑：建临时病房，那里死的人少', () => {
    const play = (option: string) => {
      const state = createState(testConfig({ ...crises, startBudget: 100 }));
      // 起源地一下子病倒了一大片，而且已经上报过
      state.infectious[0] = state.susceptible[0]! * 0.05;
      state.susceptible[0]! -= state.infectious[0]!;
      state.reached[0]! |= REPORTED;
      run(state, 1);
      expect(pendingOf(state, DEFENDER)).toMatchObject({ id: 'swamped', region: 0 });
      applyCommand(state, DEFENDER, { type: 'decide', decision: 'swamped', option });
      run(state, 15);
      return state;
    };
    const coped = play('cope');
    const warded = play('ward');
    expect(warded.budget).toBeLessThan(coped.budget);
    expect(warded.reliefUntil[0]).toBeGreaterThan(0);
    expect(outbreak.observe(warded, DEFENDER).happening[0]! & HAS_RELIEF).toBe(HAS_RELIEF);
    expect(warded.deaths[0]).toBeLessThan(coped.deaths[0]!);
  });

  it('口子关得太久：攻方得到走私的机会；漏风只有攻方看得到', () => {
    const state = createState(testConfig(crises));
    state.budget = 1000;
    state.points = 10;
    state.measures[0] = withMeasure(0, 'borders', 3);
    run(state, 5);
    expect(pendingOf(state, ATTACKER)).toMatchObject({ id: 'smuggle', region: 0 });
    expect(pendingOf(state, DEFENDER)).toBeNull();
    applyCommand(state, ATTACKER, { type: 'decide', decision: 'smuggle', option: 'routes' });
    expect(state.points).toBeCloseTo(8, 0);
    expect(state.leakUntil[0]).toBe(state.tick + 30);
    expect(outbreak.observe(state, ATTACKER).happening[0]! & HAS_LEAK).toBe(HAS_LEAK);
    expect(outbreak.observe(state, DEFENDER).happening[0]! & HAS_LEAK).toBe(0);
    // 攻方那边的事守方不知道
    expect(outbreak.observe(state, DEFENDER).news.some((item) => item.kind === 'decision')).toBe(
      false,
    );
  });

  it('漏风的口子拦不住多少：同样关着陆路，漏风的那一局传出去得早', () => {
    const reachedAfter = (leak: boolean) => {
      const state = createState(
        testConfig({ eventChance: 0, airRate: 0, seaRate: 0, landRate: 0.01, leakGate: 0 }),
      );
      state.budget = 100000;
      state.infectious[0] = 5000;
      state.measures[0] = withMeasure(0, 'borders', 3);
      if (leak) state.leakUntil[0] = 1000;
      run(state, 20);
      return outbreak.observe(state, ATTACKER).totals.regions;
    };
    expect(reachedAfter(true)).toBeGreaterThan(reachedAfter(false));
  });

  it('疫苗开打而信任不高：不管它，接种慢一截', () => {
    const state = createState(testConfig({ ...crises, vaccineStages: 0, startTrust: 0.5 }));
    run(state, 1);
    expect(pendingOf(state, DEFENDER)).toMatchObject({ id: 'reluctant', region: -1 });
    applyCommand(state, DEFENDER, { type: 'decide', decision: 'reluctant', option: 'ignore' });
    expect(outbreak.observe(state, DEFENDER).modifiers).toEqual([
      { key: 'rollout', amount: -0.3, daysLeft: 30 },
    ]);
  });

  it('守方做完病原鉴定：攻方碰上一次，一局只有这一次', () => {
    const state = createState(testConfig({ ...crises, crisisGap: 3 }));
    run(state, 3);
    expect(pendingOf(state, ATTACKER)).toBeNull();
    state.techs[state.techIndex.get('identify')!] = TECH_DONE;
    run(state, 1);
    expect(pendingOf(state, ATTACKER)).toMatchObject({ id: 'named', region: -1 });
    applyCommand(state, ATTACKER, { type: 'decide', decision: 'named', option: 'steady' });
    run(state, 20);
    expect(pendingOf(state, ATTACKER)).toBeNull();
  });

  it('默认的测试配置里不出危机', () => {
    const state = createState(testConfig({ eventChance: 0, fatigueDays: 2 }));
    state.budget = 1000;
    state.measures[0] = withMeasure(0, 'lockdown', 3);
    run(state, 10);
    expect(pendingOf(state, DEFENDER)).toBeNull();
    expect(state.lockedDays[0]).toBe(0);
  });
});
