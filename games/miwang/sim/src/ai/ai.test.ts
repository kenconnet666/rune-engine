import { describe, expect, it } from 'vitest';
import type { Command } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, DEFENDER, TECH_IDLE } from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { decide, type AiLevel } from './index.ts';

/** 两个电脑对手对打，返回最后的状态 */
function play(attackerLevel: AiLevel, defenderLevel: AiLevel, days: number) {
  const config = testConfig();
  const state = outbreak.create(config);
  for (let day = 0; day < days && !state.outcome; day++) {
    const commands: { tick: number; player: number; command: Command }[] = [];
    for (const [player, level] of [
      [ATTACKER, attackerLevel],
      [DEFENDER, defenderLevel],
    ] as const) {
      for (const command of decide(outbreak.observe(state, player), config, level)) {
        commands.push({ tick: state.tick, player, command });
      }
    }
    outbreak.step(state, commands);
  }
  return state;
}

describe('电脑对手', () => {
  it('攻方会换性状，守方会做研究、开措施', () => {
    const state = play(1, 1, 200);
    expect(state.traits.some((owned) => owned === 1)).toBe(true);
    expect(state.techs.some((status) => status !== TECH_IDLE)).toBe(true);
    expect(state.reportedDeaths.length).toBe(state.measures.length);
  });

  it('三档难度都能把一局打完，不出错', () => {
    for (const level of [0, 1, 2] as const) {
      const state = play(level, level, 1500);
      expect(state.outcome).not.toBeNull();
    }
  });

  it('只下自己这一方的命令，而且只在没分出胜负时下', () => {
    const config = testConfig();
    const state = outbreak.create(config);
    state.points = 100;
    const attack = decide(outbreak.observe(state, ATTACKER), config, 2);
    expect(attack.every((command) => command.type === 'evolve')).toBe(true);
    const defend = decide(outbreak.observe(state, DEFENDER), config, 2);
    expect(defend.every((command) => command.type !== 'evolve')).toBe(true);
    state.outcome = { winner: ATTACKER, reason: 'calamity', tick: 0 };
    expect(decide(outbreak.observe(state, ATTACKER), config, 2)).toEqual([]);
  });
});
