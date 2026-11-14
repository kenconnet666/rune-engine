/**
 * 电脑对手：和玩家一样，只看得到自己这一方能看到的状态，只通过命令行动。
 * 每一步都可以问它一次，它自己决定隔几天动一次手。
 */
import type { Command } from '../commands.ts';
import type { OutbreakConfig } from '../config.ts';
import type { OutbreakView } from '../view.ts';
import { attack } from './attacker.ts';
import { choose } from './decisions.ts';
import { defend } from './defender.ts';
import {
  aiStyle,
  ATTACK_STYLES,
  DEFEND_STYLES,
  type AiLevel,
  type AiStyle,
  type AttackStyle,
  type DefendStyle,
} from './shared.ts';

export { aiStyle, ATTACK_STYLES, DEFEND_STYLES };
export type { AiLevel, AiStyle, AttackStyle, DefendStyle };

/**
 * 看了这一方的状态之后要下的命令（可能没有）。
 * 性格不传就按这一局的种子定（见 aiStyle）；传了的要是这一方的性格，不然当成 steady。
 */
export function decide(
  view: OutbreakView,
  config: OutbreakConfig,
  level: AiLevel,
  style: AiStyle = aiStyle(config.seed, view.attacker),
): Command[] {
  if (view.outcome) return [];
  const attackStyle = ATTACK_STYLES.find((candidate) => candidate === style) ?? 'steady';
  const defendStyle = DEFEND_STYLES.find((candidate) => candidate === style) ?? 'steady';
  return [
    ...choose(view, config, level),
    ...(view.attacker
      ? attack(view, config, level, attackStyle)
      : defend(view, config, level, defendStyle)),
  ];
}
