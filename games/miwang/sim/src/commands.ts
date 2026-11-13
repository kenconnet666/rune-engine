import type { PlayerId } from '@rune-engine/core';
import { MEASURE_BITS, type Measure } from './config.ts';
import { setMeasure } from './rules/defense.ts';
import { evolve } from './rules/pathogen.ts';
import { startResearch } from './rules/research.ts';
import { ATTACKER, DEFENDER, type OutbreakState } from './state.ts';

/** 玩家（和电脑对手）能做的事 */
export type Command =
  /** 攻方：换一个性状 */
  | { readonly type: 'evolve'; readonly trait: string }
  /** 守方：开或关一个地区的一项措施 */
  | {
      readonly type: 'measure';
      readonly region: number;
      readonly measure: Measure;
      readonly on: boolean;
    }
  /** 守方：开始一项研究 */
  | { readonly type: 'research'; readonly tech: string };

/**
 * 执行一条命令。命令来自网络另一头，不能信：不是自己这一方的、内容不对的、条件不满足的都悄悄不生效
 * （不抛异常——主机不能被一条坏命令打断）。
 */
export function applyCommand(state: OutbreakState, player: PlayerId, command: Command) {
  if (state.outcome) return;
  switch (command.type) {
    case 'evolve':
      if (player === ATTACKER && typeof command.trait === 'string') evolve(state, command.trait);
      return;
    case 'measure':
      if (player === DEFENDER && Object.hasOwn(MEASURE_BITS, command.measure)) {
        setMeasure(state, command.region, command.measure, command.on === true);
      }
      return;
    case 'research':
      if (player === DEFENDER && typeof command.tech === 'string') {
        startResearch(state, command.tech);
      }
      return;
  }
}
