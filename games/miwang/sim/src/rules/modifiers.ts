/**
 * 临时的全局修正：在一段时间里改一个数（发现率、传播、守方的收入）。
 * 攻方的“蛰伏”和双方做的抉择都是往这里加一条；到期自己消失。同一个数的几条叠加。
 */
import { MODIFIER_KEYS, type ModifierKey, type Modifiers } from '../config.ts';
import type { OutbreakState } from '../state.ts';

/** 某个数现在一共被改了多少（没有修正时是 0） */
export function modifier(state: OutbreakState, key: ModifierKey): number {
  let total = 0;
  for (const item of state.modifiers) {
    if (item.key === key && item.until > state.tick) total += item.amount;
  }
  return total;
}

/** 加几条修正，从今天起持续 days 天；audience 是谁看得到它（FOR_ATTACKER、FOR_DEFENDER 按位） */
export function addModifiers(
  state: OutbreakState,
  modifiers: Modifiers | undefined,
  days: number,
  audience: number,
) {
  if (!modifiers || days <= 0) return;
  for (const key of MODIFIER_KEYS) {
    const amount = modifiers[key];
    if (amount) state.modifiers.push({ key, amount, until: state.tick + days, audience });
  }
}

/** 到期的修正丢掉 */
export function expireModifiers(state: OutbreakState) {
  if (state.modifiers.some((item) => item.until <= state.tick)) {
    state.modifiers = state.modifiers.filter((item) => item.until > state.tick);
  }
}
