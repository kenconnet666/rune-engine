import type { DefenseKey, EffectKey, Measure, Outcome, TraitGroup } from '@miwang/sim';

/** 一样东西在界面上叫什么、一句话说明是什么 */
export interface Label {
  readonly name: string;
  readonly detail: string;
}

/** 内容的文案：每种语言一份，形状相同。性状、科技、事件按各张表里的 id 取（text.test.ts 核对没有漏的） */
export interface ContentText {
  /** 气候（热带、温带、寒带）、富裕程度（0–3）、密度（0–2）的叫法，下标就是取值 */
  readonly climates: readonly [string, string, string];
  readonly wealth: readonly [string, string, string, string];
  readonly density: readonly [string, string, string];
  readonly groups: Readonly<Record<TraitGroup, string>>;
  readonly traits: Readonly<Record<string, Label>>;
  readonly techs: Readonly<Record<string, Label>>;
  readonly measures: Readonly<Record<Measure, Label>>;
  readonly events: Readonly<Record<string, Label>>;
  readonly outcomes: Readonly<Record<Outcome['reason'], string>>;
  /** 性状的各项效果、科技的各项效果叫什么（详情里列“这样东西改变了什么”用） */
  readonly effects: Readonly<Record<EffectKey, string>>;
  readonly defense: Readonly<Record<DefenseKey, string>>;
}
