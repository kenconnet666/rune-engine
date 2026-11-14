/**
 * 电脑对手怎么对待抉择：简单档不管（到期按第一个选项办）；普通和困难档按自己这一方现在的处境
 * 给每个选项估个价，挑最高的。估价的单位是“相当于多少预算（或变异点）”，只求大致合理。
 */
import type { Command } from '../commands.ts';
import type { DecisionOption, OutbreakConfig } from '../config.ts';
import type { OutbreakView } from '../view.ts';
import type { AiLevel } from './shared.ts';

/** 守方：信任低的时候信任最值钱，钱紧的时候钱最值钱 */
function forDefender(option: DecisionOption, view: OutbreakView): number {
  const budget = option.budget ?? 0;
  // 付不起的选项不考虑
  if (view.resource + budget < 0) return -Infinity;
  const days = option.days ?? 0;
  const { detect = 0, spread = 0, income = 0, rollout = 0 } = option.modifiers ?? {};
  return (
    // 冲着一个地区的事：闹事是坏事，医疗支援是好事，放松封锁要丢一档管控
    -(option.unrest ?? 0) * 0.6 +
    (option.relief ?? 0) * 0.5 -
    (option.relax ?? 0) * 6 +
    rollout * days * 1.5 +
    budget * (view.resource < 30 ? 2 : 1) +
    (option.trust ?? 0) * (view.defense.trust < 0.5 ? 300 : 120) +
    (option.research ?? 0) * 40 * view.defense.active.length +
    detect * days * 4 -
    spread * days * 6 +
    income * days * view.defense.income
  );
}

/** 攻方：传得开、藏得住最值钱；守方的信任掉了也是好事 */
function forAttacker(option: DecisionOption, view: OutbreakView): number {
  const points = option.points ?? 0;
  if (view.resource + points < 0) return -Infinity;
  const days = option.days ?? 0;
  const { detect = 0, spread = 0 } = option.modifiers ?? {};
  // 口子漏风：关着的地方又能往外带了
  return (
    points +
    (option.leak ?? 0) * 0.2 +
    spread * days * 3 -
    detect * days * 3 -
    (option.trust ?? 0) * 100
  );
}

export function choose(view: OutbreakView, config: OutbreakConfig, level: AiLevel): Command[] {
  if (!view.decision || level === 0) return [];
  const decision = config.decisions.find((candidate) => candidate.id === view.decision?.id);
  if (!decision) return [];
  const value = view.attacker ? forAttacker : forDefender;
  let best = decision.options[0];
  for (const option of decision.options) {
    if (best && value(option, view) > value(best, view)) best = option;
  }
  return best ? [{ type: 'decide', decision: decision.id, option: best.id }] : [];
}
