/** 守方的部署（野战医院、援助物资）和攻方的“抗原转变” */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, REPORTED, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { HAS_AID, HAS_RELIEF } from '../view.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
const quiet = { eventChance: 0 };
const deploy = (state: OutbreakState, deployment: string, region: number, player = DEFENDER) =>
  applyCommand(state, player, { type: 'deploy', deployment, region });
const offer = (state: OutbreakState, id: string) =>
  outbreak.observe(state, DEFENDER).defense.deployments.find((item) => item.id === id)!;

describe('部署', () => {
  it('野战医院：花预算、进冷却，放在上报过的地区；双方都看得到', () => {
    const state = createState(testConfig(quiet));
    state.budget = 20;
    // 还没上报的地区放不了；攻方下不了这条命令
    deploy(state, 'ward', 0);
    state.reached[0]! |= REPORTED;
    deploy(state, 'ward', 0, ATTACKER);
    expect(state.budget).toBe(20);

    deploy(state, 'ward', 0);
    expect(state.budget).toBe(12);
    expect(state.reliefUntil[0]).toBe(30);
    expect(offer(state, 'ward')).toEqual({ id: 'ward', cost: 8, readyIn: 20 });
    for (const player of [ATTACKER, DEFENDER]) {
      const view = outbreak.observe(state, player);
      expect(view.happening[0]! & HAS_RELIEF).toBe(HAS_RELIEF);
      expect(view.news.at(-1)).toMatchObject({ kind: 'deploy', subject: 'ward', region: 0 });
    }
    // 攻方看不到守方的部署清单
    expect(outbreak.observe(state, ATTACKER).defense.deployments).toEqual([]);

    // 冷却没过，再放不生效；过了以后同一个地区接着算
    deploy(state, 'ward', 0);
    expect(state.budget).toBe(12);
    run(state, 20);
    const before = state.budget;
    deploy(state, 'ward', 0);
    expect(state.budget).toBeCloseTo(before - 8);
    expect(state.reliefUntil[0]).toBe(60);
  });

  it('野战医院让那里死的人少', () => {
    const play = (ward: boolean) => {
      const state = createState(testConfig({ ...quiet, startBudget: 100 }));
      state.infectious[0] = state.susceptible[0]! * 0.05;
      state.susceptible[0]! -= state.infectious[0]!;
      state.reached[0]! |= REPORTED;
      if (ward) deploy(state, 'ward', 0);
      run(state, 15);
      return state.deaths[0]!;
    };
    expect(play(true)).toBeLessThan(play(false));
  });

  it('援助物资：只给低于中等收入的地区；那里按中等收入算，发现得多', () => {
    const config = testConfig(quiet);
    const poor = config.regions.findIndex((region) => region.wealth < 2);
    const rich = config.regions.findIndex((region) => region.wealth >= 2);
    const state = createState(config);
    state.budget = 50;
    state.reached[poor]! |= REPORTED;
    state.reached[rich]! |= REPORTED;
    deploy(state, 'supplies', rich);
    expect(state.budget).toBe(50);

    // 发现率看守方那一栏的“措施见效”看不出来：直接比同一个地区援助前后上报的多少
    const reported = (aided: boolean) => {
      const game = createState(config);
      game.budget = 50;
      game.infectious[poor] = 20000;
      game.reached[poor]! |= 1 | REPORTED;
      if (aided) deploy(game, 'supplies', poor);
      run(game, 10);
      return game.reported[poor]!;
    };
    expect(reported(true)).toBeGreaterThan(reported(false));
    deploy(state, 'supplies', poor);
    expect(outbreak.observe(state, ATTACKER).happening[poor]! & HAS_AID).toBe(HAS_AID);
  });
});

describe('抗原转变', () => {
  it('康复过、接种过的人里有一部分重新变得易感；人数守恒，只有攻方知道', () => {
    const state = createState(testConfig(quiet));
    state.points = 20;
    state.recovered[0] = 1000;
    state.immune[1] = 601;
    const before = [state.susceptible[0]!, state.susceptible[1]!];
    applyCommand(state, ATTACKER, { type: 'skill', skill: 'shift' });
    expect(state.points).toBe(10);
    expect(state.recovered[0]).toBe(500);
    expect(state.susceptible[0]).toBe(before[0]! + 500);
    // 按比例取整：601 的一半是 300
    expect(state.immune[1]).toBe(301);
    expect(state.susceptible[1]).toBe(before[1]! + 300);
    expect(outbreak.observe(state, ATTACKER).news.at(-1)).toMatchObject({
      kind: 'skill',
      subject: 'shift',
      region: -1,
    });
    expect(outbreak.observe(state, DEFENDER).news.some((item) => item.kind === 'skill')).toBe(
      false,
    );
  });
});
