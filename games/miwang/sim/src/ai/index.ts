/**
 * 电脑对手：和玩家一样，只看得到自己这一方能看到的状态，只通过命令行动。
 * 每一步都可以问它一次，它自己决定隔几天动一次手。
 */
import type { Command } from '../commands.ts';
import type { OutbreakConfig } from '../config.ts';
import type { OutbreakView } from '../view.ts';
import { attack } from './attacker.ts';
import { defend } from './defender.ts';
import type { AiLevel } from './shared.ts';

export type { AiLevel };

/** 看了这一方的状态之后要下的命令（可能没有） */
export function decide(view: OutbreakView, config: OutbreakConfig, level: AiLevel): Command[] {
  if (view.outcome) return [];
  return view.attacker ? attack(view, config, level) : defend(view, config, level);
}
