import type { PlayerId } from '@rune-engine/core';
import { MEASURES, type Measure, type MeasureLevel, type VaccinePolicy } from './config.ts';
import { holdBriefing, sendTeam, setMeasure, setMeasures, setPriority } from './rules/defense.ts';
import { evolve } from './rules/pathogen.ts';
import { startResearch } from './rules/research.ts';
import { ATTACKER, DEFENDER, type OutbreakState } from './state.ts';

/** 玩家（和电脑对手）能做的事 */
export type Command =
  /** 攻方：换一个性状 */
  | { readonly type: 'evolve'; readonly trait: string }
  /** 守方：把一个地区的一项措施设到某一档（0 是关） */
  | {
      readonly type: 'measure';
      readonly region: number;
      readonly measure: Measure;
      readonly level: MeasureLevel;
    }
  /** 守方：一次给好几个地区设同一项措施（按给的先后来，钱不够了后面的不生效） */
  | {
      readonly type: 'measures';
      readonly regions: readonly number[];
      readonly measure: Measure;
      readonly level: MeasureLevel;
    }
  /** 守方：派一支应急队去一个地区（-1 是召回） */
  | { readonly type: 'team'; readonly team: number; readonly region: number }
  /** 守方：疫苗先给谁 */
  | { readonly type: 'priority'; readonly policy: VaccinePolicy }
  /** 守方：开一次发布会 */
  | { readonly type: 'briefing' }
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
      if (player === DEFENDER && MEASURES.includes(command.measure)) {
        setMeasure(state, command.region, command.measure, command.level);
      }
      return;
    case 'measures':
      if (player === DEFENDER && MEASURES.includes(command.measure)) {
        setMeasures(state, command.regions, command.measure, command.level);
      }
      return;
    case 'team':
      if (player === DEFENDER) sendTeam(state, command.team, command.region);
      return;
    case 'priority':
      if (player === DEFENDER) setPriority(state, command.policy);
      return;
    case 'briefing':
      if (player === DEFENDER) holdBriefing(state);
      return;
    case 'research':
      if (player === DEFENDER && typeof command.tech === 'string') {
        startResearch(state, command.tech);
      }
      return;
  }
}
