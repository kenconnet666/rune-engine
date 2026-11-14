/** 把性状、科技、抉择的选项、临时修正的数值写成人看的一行行“改变了什么、改了多少” */
import type { ContentText } from '@miwang/content';
import {
  DEFENSE_KEYS,
  EFFECT_KEYS,
  MODIFIER_KEYS,
  ROUTES,
  type DecisionOption,
  type DefenseEffects,
  type DefenseKey,
  type EffectKey,
  type Effects,
  type ModifierKey,
  type Modifiers,
} from '@miwang/sim';
import type { ClientText } from '../text/zh.ts';

export interface EffectLine {
  readonly name: string;
  readonly amount: string;
}

const signed = (value: number, text: string) => `${value < 0 ? '−' : '+'}${text}`;
/** 最多一位小数，整数不带小数点 */
const short = (value: number) => String(Math.round(Math.abs(value) * 10) / 10);
const percent = (value: number) => `${short(value * 100)}%`;

/** 取值是比例的那几项 */
const SHARES: ReadonlySet<EffectKey> = new Set([
  'lethality',
  'cold',
  'heat',
  'resistance',
  'presymptomatic',
  'aviation',
  'maritime',
]);
const DAYS: ReadonlySet<EffectKey> = new Set(['incubation', 'duration']);
const ROUTE_KEYS: ReadonlySet<EffectKey> = new Set(ROUTES);

export function traitEffects(effects: Effects, content: ContentText, ui: ClientText): EffectLine[] {
  return EFFECT_KEYS.flatMap((key) => {
    const value = effects[key];
    if (!value) return [];
    const amount = SHARES.has(key)
      ? percent(value)
      : DAYS.has(key)
        ? ui.workbench.days(Math.abs(value))
        : // 传播途径的强度是“一个病人一天传给几个人”的零头：乘一百当成点数来看
          ROUTE_KEYS.has(key)
          ? short(value * 100)
          : short(value);
    return [{ name: content.effects[key], amount: signed(value, amount) }];
  });
}

/** 做完就有、不分多少的那几项 */
const FLAGS: ReadonlySet<DefenseKey> = new Set(['identify', 'trace']);

export function techEffects(
  effects: DefenseEffects,
  content: ContentText,
  ui: ClientText,
): EffectLine[] {
  return DEFENSE_KEYS.flatMap((key) => {
    const value = effects[key];
    if (!value) return [];
    const amount = FLAGS.has(key)
      ? ui.workbench.yes
      : key === 'vaccine'
        ? signed(value, short(value))
        : signed(value, percent(value));
    return [{ name: content.defense[key], amount }];
  });
}

/** 一条临时修正改了多少：+15%、−8% */
export const modifierAmount = (amount: number) => signed(amount, percent(amount));

/** 几条临时修正各改了什么（技能“蛰伏”、抉择的选项） */
export function modifierEffects(modifiers: Modifiers | undefined, ui: ClientText): EffectLine[] {
  return MODIFIER_KEYS.flatMap((key: ModifierKey) => {
    const amount = modifiers?.[key];
    return amount ? [{ name: ui.effects[key], amount: modifierAmount(amount) }] : [];
  });
}

/** 抉择的一个选项的得失：立刻生效的几样，加上持续一阵子的修正（后面带着天数） */
export function optionEffects(option: DecisionOption, ui: ClientText): EffectLine[] {
  const lines: EffectLine[] = [];
  const { points, budget, trust, research } = option;
  if (points) lines.push({ name: ui.effects.points, amount: signed(points, short(points)) });
  if (budget) lines.push({ name: ui.effects.budget, amount: signed(budget, short(budget)) });
  if (trust) lines.push({ name: ui.effects.trust, amount: signed(trust, percent(trust)) });
  if (research) {
    const share = percent(research);
    lines.push({
      name: ui.effects.research,
      amount: research > 0 ? ui.effects.faster(share) : ui.effects.slower(share),
    });
  }
  for (const line of modifierEffects(option.modifiers, ui)) {
    lines.push({ name: line.name, amount: ui.effects.lasting(line.amount, option.days ?? 0) });
  }
  // 落在那个地区的效果（危机的选项）
  const { unrest, relief, leak, relax } = option;
  if (unrest) lines.push({ name: ui.effects.unrest, amount: ui.effects.forDays(unrest) });
  if (relief) lines.push({ name: ui.effects.relief, amount: ui.effects.forDays(relief) });
  if (leak) lines.push({ name: ui.effects.leak, amount: ui.effects.forDays(leak) });
  if (relax) lines.push({ name: ui.effects.relax, amount: ui.effects.levels(relax) });
  return lines;
}
