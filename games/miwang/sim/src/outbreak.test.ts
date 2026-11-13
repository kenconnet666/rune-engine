import { replay, type Recording } from '@rune-engine/core';
import { describe, expect, it } from 'vitest';
import { ATTACKER, DEFENDER, outbreak, type Command, type OutbreakConfig } from './index.ts';

/** 一条 12 个地区连成的链，两头有一条航线 */
const config: OutbreakConfig = {
  seed: 20261113,
  startDate: '2026-11-13',
  origin: 0,
  regions: Array.from({ length: 12 }, (_, index) => ({
    population: 2_000_000 + index * 350_000,
    neighbors: [index - 1, index + 1].filter((n) => n >= 0 && n < 12),
    flights: index === 0 ? [11] : index === 11 ? [0] : [],
  })),
};

const recording: Recording<OutbreakConfig, Command> = {
  config,
  ticks: 400,
  commands: [
    { tick: 60, player: ATTACKER, command: { type: 'evolve', trait: 'transmission' } },
    {
      tick: 90,
      player: DEFENDER,
      command: { type: 'measure', region: 3, measure: 'lockdown', on: true },
    },
    {
      tick: 90,
      player: DEFENDER,
      command: { type: 'measure', region: 0, measure: 'testing', on: true },
    },
    { tick: 150, player: ATTACKER, command: { type: 'evolve', trait: 'stealth' } },
  ],
};

const people = (state: ReturnType<typeof outbreak.create>) => {
  let sum = 0;
  for (let r = 0; r < config.regions.length; r++) {
    sum +=
      state.susceptible[r]! +
      state.exposed[r]! +
      state.infectious[r]! +
      state.removed[r]! +
      state.deaths[r]!;
  }
  return sum;
};

describe('《迷惘》的传播模型', () => {
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
    expect(end.removed.filter((value) => value > 0).length).toBeGreaterThan(3);
  });

  it('攻方看到真实感染，守方只看到上报：两边的数字不同', () => {
    const state = replay(outbreak, recording, 120);
    const attacker = outbreak.observe(state, ATTACKER);
    const defender = outbreak.observe(state, DEFENDER);
    expect(attacker.attacker).toBe(true);
    expect(defender.attacker).toBe(false);
    expect(attacker.totals.cases).not.toBe(defender.totals.cases);
    // 守方封锁了 3 号地区，双方都看得到
    expect(attacker.measures[3]).toBe(1);
    expect(defender.measures[3]).toBe(1);
  });

  it('不是自己这一方的命令不生效', () => {
    const wrong: Recording<OutbreakConfig, Command> = {
      ...recording,
      commands: [
        {
          tick: 5,
          player: ATTACKER,
          command: { type: 'measure', region: 1, measure: 'lockdown', on: true },
        },
        { tick: 5, player: DEFENDER, command: { type: 'evolve', trait: 'severity' } },
      ],
      ticks: 10,
    };
    const state = replay(outbreak, wrong);
    expect(state.measures[1]).toBe(0);
    expect(state.traits.severity).toBe(0);
  });
});

// 跨机器核对用的定值：第一次在 x64 上算出来填进去
const GOLDEN_OUTBREAK = 19360215;
