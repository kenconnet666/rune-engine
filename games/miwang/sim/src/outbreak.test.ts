import { replay, type Recording } from '@rune-engine/core';
import { describe, expect, it } from 'vitest';
import {
  ATTACKER,
  DEFENDER,
  MEASURE_BITS,
  outbreak,
  type Command,
  type OutbreakConfig,
  type OutbreakState,
} from './index.ts';
import { testConfig } from './testing/world.ts';

// 开局多给些变异点：这份记录里攻方要在前 120 天里换三个性状
const config = testConfig({ startPoints: 40 });

/** 双方各做了几件事的一局 */
const recording: Recording<OutbreakConfig, Command> = {
  config,
  ticks: 400,
  commands: [
    { tick: 3, player: ATTACKER, command: { type: 'evolve', trait: 'air1' } },
    { tick: 5, player: DEFENDER, command: { type: 'research', tech: 'identify' } },
    { tick: 40, player: ATTACKER, command: { type: 'evolve', trait: 'stealth' } },
    {
      tick: 60,
      player: DEFENDER,
      command: { type: 'measure', region: 0, measure: 'testing', on: true },
    },
    {
      tick: 60,
      player: DEFENDER,
      command: { type: 'measure', region: 1, measure: 'lockdown', on: true },
    },
    { tick: 90, player: DEFENDER, command: { type: 'research', tech: 'vaccine1' } },
    { tick: 120, player: ATTACKER, command: { type: 'evolve', trait: 'fever' } },
    {
      tick: 200,
      player: DEFENDER,
      command: { type: 'measure', region: 1, measure: 'lockdown', on: false },
    },
  ],
};

const people = (state: OutbreakState) => {
  let sum = 0;
  for (let r = 0; r < config.regions.length; r++) {
    sum +=
      state.susceptible[r]! +
      state.exposed[r]! +
      state.infectious[r]! +
      state.recovered[r]! +
      state.immune[r]! +
      state.deaths[r]!;
  }
  return sum;
};

describe('《迷惘》的模拟', () => {
  it('同一份记录重放两遍，状态哈希相同', () => {
    expect(outbreak.hash(replay(outbreak, recording))).toBe(
      outbreak.hash(replay(outbreak, recording)),
    );
  });

  it('哈希在所有机器上都一样（x64、ARM 的 CI 核对同一个数）', () => {
    expect(outbreak.hash(replay(outbreak, recording))).toBe(GOLDEN_OUTBREAK);
  });

  it('人数守恒，感染从起点扩散到别的地区', () => {
    const start = outbreak.create(config);
    const end = replay(outbreak, recording);
    expect(people(end)).toBe(people(start));
    expect(end.reached.filter((bits) => bits !== 0).length).toBeGreaterThan(3);
    expect(end.infectedTotal).toBeGreaterThan(1000);
  });

  it('攻方看到真实感染，守方只看到上报：两边的数字不同', () => {
    const state = replay(outbreak, recording, 150);
    const attacker = outbreak.observe(state, ATTACKER);
    const defender = outbreak.observe(state, DEFENDER);
    expect(attacker.attacker).toBe(true);
    expect(defender.attacker).toBe(false);
    expect(attacker.totals.cases).not.toBe(defender.totals.cases);
    expect(attacker.totals.infected).toBeGreaterThan(defender.totals.infected);
    // 措施是公开的，双方都看得到
    expect(attacker.measures[1]! & MEASURE_BITS.lockdown).not.toBe(0);
    expect(defender.measures[1]! & MEASURE_BITS.lockdown).not.toBe(0);
  });

  it('对手的底牌要满足条件才看得到', () => {
    // 第 5 步开始病原鉴定，要 10 天：做完之前守方不知道对手有什么性状
    const before = outbreak.observe(replay(outbreak, recording, 10), DEFENDER);
    expect(before.pathogen.known).toBe(false);
    expect(before.pathogen.owned).toEqual([]);
    expect(before.pathogen.id).toBeNull();
    expect(before.origin).toBe(-1);
    const after = outbreak.observe(replay(outbreak, recording, 50), DEFENDER);
    expect(after.pathogen.known).toBe(true);
    expect(after.pathogen.id).toBe('test');
    expect(after.pathogen.owned).toEqual(['air1', 'stealth']);
    // 攻方总是知道自己的起源地
    expect(outbreak.observe(replay(outbreak, recording, 10), ATTACKER).origin).toBe(0);
  });

  it('不是自己这一方的、内容不对的命令都不生效，也不会让模拟出错', () => {
    const bad = [
      { type: 'measure', region: 1, measure: 'lockdown', on: true },
      { type: 'research', tech: 'identify' },
    ] as const;
    const wrong: Recording<OutbreakConfig, Command> = {
      config,
      ticks: 10,
      commands: [
        ...bad.map((command) => ({ tick: 2, player: ATTACKER, command })),
        { tick: 2, player: DEFENDER, command: { type: 'evolve', trait: 'air1' } },
        { tick: 2, player: ATTACKER, command: { type: 'evolve', trait: '没有这个性状' } },
        // 前置没满足
        { tick: 2, player: ATTACKER, command: { type: 'evolve', trait: 'air2' } },
        {
          tick: 2,
          player: DEFENDER,
          command: { type: 'measure', region: 99, measure: 'lockdown', on: true },
        },
        {
          tick: 2,
          player: DEFENDER,
          // 来自网络的命令不一定守类型：措施的名字可能是任何字符串
          command: { type: 'measure', region: 1, measure: 'toString', on: true } as never,
        },
      ],
    };
    const state = replay(outbreak, wrong);
    expect(Array.from(state.measures)).toEqual(new Array(config.regions.length).fill(0));
    expect(Array.from(state.traits)).toEqual(new Array(config.traits.length).fill(0));
    expect(Array.from(state.techs)).toEqual(new Array(config.techs.length).fill(0));
  });

  it('死亡越过灾厄线攻方赢，之后状态不再变化', () => {
    // 一种极端致命的病，灾厄线放得很低
    const deadly = testConfig(
      { calamityShare: 0.001 },
      {
        pathogen: {
          id: 'deadly',
          base: { air: 0.6, lethality: 0.5 },
          incubationDays: 2,
          infectiousDays: 5,
          climate: [1, 1, 1],
        },
      },
    );
    const state = outbreak.create(deadly);
    for (let day = 0; day < 400 && !state.outcome; day++) outbreak.step(state, []);
    expect(state.outcome).toMatchObject({ winner: ATTACKER, reason: 'calamity' });
    const frozen = outbreak.hash(state);
    outbreak.step(state, [
      { tick: state.tick, player: ATTACKER, command: { type: 'evolve', trait: 'air1' } },
    ]);
    expect(outbreak.hash(state)).toBe(frozen);
    expect(outbreak.observe(state, DEFENDER).outcome?.reason).toBe('calamity');
  });

  it('传不起来的病自己消失：连续一段时间没有病例，守方赢', () => {
    const weak = testConfig(
      { clearDays: 20 },
      {
        pathogen: {
          id: 'weak',
          base: { air: 0.02 },
          incubationDays: 3,
          infectiousDays: 4,
          climate: [1, 1, 1],
        },
      },
    );
    const state = outbreak.create(weak);
    for (let day = 0; day < 400 && !state.outcome; day++) outbreak.step(state, []);
    expect(state.outcome).toMatchObject({ winner: DEFENDER, reason: 'eradicated' });
  });

  it('守到期限算守方赢', () => {
    const state = outbreak.create(testConfig({ maxDays: 30 }));
    for (let day = 0; day < 60 && !state.outcome; day++) outbreak.step(state, []);
    expect(state.outcome).toMatchObject({ winner: DEFENDER, reason: 'timeout' });
    expect(state.tick).toBe(30);
  });
});

// 跨机器核对用的定值：规则或默认数值改了之后在 x64 上重新算出来填进去
const GOLDEN_OUTBREAK = 1656107644;
