/** 把性状、科技的效果值写成人看的一行行“改变了什么、改了多少” */
import type { ContentText } from '@miwang/content';
import {
  DEFENSE_KEYS,
  EFFECT_KEYS,
  ROUTES,
  type DefenseEffects,
  type DefenseKey,
  type EffectKey,
  type Effects,
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
