/** 世界条件：怎么抽、怎么套到规则上、什么样的局有 */
import { DEFAULT_RULES } from '@miwang/sim';
import { describe, expect, it } from 'vitest';
import { createConfig } from '../config.ts';
import { CHAPTERS } from './chapters.ts';
import { applyConditions, CONDITIONS, drawConditions } from './conditions.ts';

const byId = (id: string) => CONDITIONS.find((condition) => condition.id === id)!;

describe('世界条件', () => {
  it('每个种子抽两条：一条对攻方有利，一条对守方有利，说的不是同一件事；各条都轮得到', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const [first, second] = drawConditions(seed).map(byId);
      expect(first!.favours).toBe('attacker');
      expect(second!.favours).toBe('defender');
      expect(first!.axis).not.toBe(second!.axis);
      expect(drawConditions(seed)).toEqual([first!.id, second!.id]);
      seen.add(first!.id).add(second!.id);
    }
    expect([...seen].sort()).toEqual(CONDITIONS.map((condition) => condition.id).sort());
  });

  it('每一条都真的改了规则，而且只改它该改的那一头', () => {
    for (const condition of CONDITIONS) {
      const changed = condition.rules(DEFAULT_RULES);
      expect(Object.keys(changed).length, condition.id).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(changed)) {
        expect(value, `${condition.id}.${key}`).not.toEqual(
          DEFAULT_RULES[key as keyof typeof DEFAULT_RULES],
        );
      }
    }
    expect(applyConditions(DEFAULT_RULES, ['busySkies', '没有这一条']).airRate).toBeCloseTo(
      DEFAULT_RULES.airRate * 1.35,
    );
  });

  it('普通对局带着抽到的条件，规则跟着变；写了空的就没有；章节没有', () => {
    const config = createConfig(12345, '2026-01-01');
    expect(config.conditions).toEqual(drawConditions(12345));
    expect(config.rules).toEqual(applyConditions(DEFAULT_RULES, config.conditions!));
    const plain = createConfig(12345, '2026-01-01', { conditions: [] });
    expect(plain.conditions).toEqual([]);
    expect(plain.rules).toEqual(DEFAULT_RULES);
    const chapter = createConfig(12345, '2026-01-01', { chapter: CHAPTERS[2]! });
    expect('conditions' in chapter).toBe(false);
  });
});
