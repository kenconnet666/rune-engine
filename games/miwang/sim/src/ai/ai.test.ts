import { describe, expect, it } from 'vitest';
import type { Command } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { measureLevel } from '../config.ts';
import { ATTACKER, DEFENDER, REPORTED, TECH_IDLE } from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { aiStyle, ATTACK_STYLES, decide, DEFEND_STYLES, type AiLevel } from './index.ts';

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

  it('性格：每局按种子定一种，各种都轮得到；同一个种子总是同一种', () => {
    const attackers = new Set<string>();
    const defenders = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      attackers.add(aiStyle(seed, true));
      defenders.add(aiStyle(seed, false));
      expect(aiStyle(seed, true)).toBe(aiStyle(seed, true));
    }
    expect([...attackers].sort()).toEqual([...ATTACK_STYLES].sort());
    expect([...defenders].sort()).toEqual([...DEFEND_STYLES].sort());
  });

  it('性格：同样的局面，谨慎的守方已经封了，惜经济的还没有', () => {
    const config = testConfig();
    const state = outbreak.create(config);
    state.budget = 500;
    // 起源地上报了一批病例：到了普通档谨慎的线，没到惜经济的线
    state.reached[0]! |= REPORTED;
    state.visible[0] = 40;
    const locked = (style: 'cautious' | 'frugal') =>
      decide(outbreak.observe(state, DEFENDER), config, 1, style).some(
        (command) => command.type === 'measure' && command.measure === 'lockdown',
      );
    expect(locked('cautious')).toBe(true);
    expect(locked('frugal')).toBe(false);
    expect(measureLevel(state.measures[0]!, 'lockdown')).toBe(0);
  });

  it('性格：凶猛的攻方比潜伏的更早往致命走', () => {
    const config = testConfig();
    const firstLethal = (style: 'lethal' | 'lurker') => {
      const state = outbreak.create(config);
      for (let day = 0; day < 400 && !state.outcome; day++) {
        const commands = decide(outbreak.observe(state, ATTACKER), config, 2, style);
        const lethal = commands.some(
          (command) =>
            command.type === 'evolve' &&
            (config.traits.find((trait) => trait.id === command.trait)?.effects.lethality ?? 0) > 0,
        );
        if (lethal) return day;
        outbreak.step(
          state,
          commands.map((command) => ({ tick: state.tick, player: ATTACKER, command })),
        );
      }
      return Infinity;
    };
    expect(firstLethal('lethal')).toBeLessThan(firstLethal('lurker'));
  });
});
