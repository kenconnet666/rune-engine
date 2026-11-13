import { describe, expect, it } from 'vitest';
import { ATTACKER, COSTS, decide, DEFENDER, outbreak, type OutbreakConfig } from './index.ts';

const config: OutbreakConfig = {
  seed: 5,
  startDate: '2026-11-13',
  origin: 0,
  regions: Array.from({ length: 6 }, (_, index) => ({
    population: 3_000_000,
    neighbors: [index - 1, index + 1].filter((n) => n >= 0 && n < 6),
    flights: [],
  })),
};

/** 让电脑控制 player 这一方，推进 days 天，返回最后的状态 */
function play(player: number, days: number) {
  const state = outbreak.create(config);
  for (let day = 0; day < days; day++) {
    const command = day % 3 === 0 ? decide(outbreak.observe(state, player)) : null;
    outbreak.step(state, command ? [{ tick: day, player, command }] : []);
  }
  return state;
}

describe('电脑对手', () => {
  it('资源不够时不出手', () => {
    const state = outbreak.create(config);
    expect(outbreak.observe(state, ATTACKER).resource).toBeLessThan(COSTS.evolve);
    expect(decide(outbreak.observe(state, ATTACKER))).toBeNull();
  });

  it('攻方攒够点数就强化：传播堆到 3 级为止，之后轮到隐蔽和症状', () => {
    const early = play(ATTACKER, 60);
    expect(early.traits.transmission).toBeGreaterThan(0);
    expect(early.traits.stealth + early.traits.severity).toBe(0);
    const late = play(ATTACKER, 200);
    expect(late.traits.transmission).toBe(3);
    expect(late.traits.stealth).toBeGreaterThan(0);
  });

  it('守方会封锁上报最重的地区', () => {
    const state = play(DEFENDER, 200);
    expect(state.measures.some((bits) => bits !== 0) || state.budget < 10).toBe(true);
  });
});
