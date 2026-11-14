/**
 * 危机：不靠运气、局面到了某个地步才冒出来的抉择（抉择表里带 crisis 的那些）。
 *   fatigue    一个地区的封锁（中档以上）连着开了很久：那里的人受不了了
 *   overload   一个上报过的地区医疗被挤兑到了头
 *   sealed     一个有感染的地区口岸、机场或港口连着关了很久：有人开始走私（攻方的机会）
 *   hesitancy  疫苗开打了，信任却不高
 *   identified 守方做完了病原鉴定（攻方的事，一局一次）
 * 多数危机冲着某一个地区来：选项的效果（闹事、放松封锁、医疗支援、口子漏风）落在那个地区。
 * 什么时候出、选了怎么生效在 decisions.ts；这里只管“现在成不成立、冲着哪里”。
 */
import { measureLevel, type CrisisCause, type DefenseStats } from '../config.ts';
import { alive, REPORTED, type OutbreakState } from '../state.ts';
import { strainIn } from './epidemic.ts';
import { vaccineReady } from './research.ts';

/** 封锁、关口子开到这一档才算数（中档） */
const FIRM = 2;
const GATES = ['borders', 'airports', 'ports'] as const;
/** 连着的天数最多记到这么多（数组一格的上限） */
const MAX_DAYS = 65535;

/** 一局只出一次的危机 */
export const crisisOnce = (cause: CrisisCause): boolean => cause === 'identified';

/** 每天记一笔：各地区的封锁、关着的口子各连着多少天了 */
export function trackCrises(state: OutbreakState) {
  if (state.config.rules.crisisGap < 0) return;
  for (let r = 0; r < state.measures.length; r++) {
    const bits = state.measures[r]!;
    const locked = bits !== 0 && measureLevel(bits, 'lockdown') >= FIRM;
    state.lockedDays[r] = locked ? Math.min(MAX_DAYS, state.lockedDays[r]! + 1) : 0;
    // 关着口子、里面又有病人：才有人想方设法往外带
    const sealed =
      bits !== 0 &&
      state.exposed[r]! + state.infectious[r]! > 0 &&
      GATES.some((gate) => measureLevel(bits, gate) >= FIRM);
    state.sealedDays[r] = sealed ? Math.min(MAX_DAYS, state.sealedDays[r]! + 1) : 0;
  }
}

/** 连着的天数到了 atLeast 的地区里最久的那个；没有是 undefined */
function longest(days: Uint16Array, atLeast: number): number | undefined {
  let found: number | undefined;
  let most = atLeast - 1;
  for (let r = 0; r < days.length; r++) {
    if (days[r]! > most) {
      most = days[r]!;
      found = r;
    }
  }
  return found;
}

/**
 * 这种危机现在成立吗：成立的话是冲着哪个地区（-1 是不针对某个地区）；不成立是 undefined
 */
export function crisisRegion(
  state: OutbreakState,
  cause: CrisisCause,
  defense: DefenseStats,
): number | undefined {
  const { rules } = state.config;
  switch (cause) {
    case 'fatigue':
      return longest(state.lockedDays, rules.fatigueDays);
    case 'sealed':
      return longest(state.sealedDays, rules.sealedDays);
    case 'overload': {
      // 守方只知道上报过的地区；挤兑到头的里面挑病人最多的
      let found: number | undefined;
      let most = 0;
      for (let r = 0; r < state.measures.length; r++) {
        if ((state.reached[r]! & REPORTED) === 0) continue;
        const sick = state.infectious[r]!;
        if (sick > most && strainIn(state, sick, alive(state, r)) >= 1) {
          most = sick;
          found = r;
        }
      }
      return found;
    }
    case 'hesitancy':
      return vaccineReady(state, defense) && state.trust < rules.hesitancyTrust ? -1 : undefined;
    case 'identified':
      return defense.identify >= 1 ? -1 : undefined;
  }
}

/** 一件冲着某个地区的危机出了之后：那里的天数从头数（不然到了间隔又是同一个地区） */
export function crisisRaised(state: OutbreakState, cause: CrisisCause, region: number) {
  if (region < 0) return;
  if (cause === 'fatigue') state.lockedDays[region] = 0;
  if (cause === 'sealed') state.sealedDays[region] = 0;
}
