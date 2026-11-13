import type { DefenseKey, EffectKey, Measure, Outcome, TraitGroup } from '@miwang/sim';
import type { ChapterId } from '../tables/chapters.ts';

/** 一样东西在界面上叫什么、一句话说明是什么 */
export interface Label {
  readonly name: string;
  readonly detail: string;
}

/** 一种病原体在百科和开局设置里的介绍 */
export interface PathogenText {
  readonly name: string;
  /** 是什么：病毒、细菌、寄生虫…… */
  readonly kind: string;
  /** 一两句话：它是怎么回事 */
  readonly summary: string;
  /** 几条来自公开资料的事实（出处见 tables/pathogens.ts 的 SOURCES） */
  readonly facts: readonly string[];
  /** 在游戏里它打起来是什么样 */
  readonly play: string;
}

/** 一章讲给玩家的话 */
export interface ChapterText {
  /** 章名：诗里的那个词 */
  readonly name: string;
  /** 诗里的那一句 */
  readonly line: string;
  /** 这一章讲的是什么事（两三个字） */
  readonly theme: string;
  /** 开场白：这一章是怎么回事 */
  readonly intro: string;
  /** 扮演攻方、守方各要做什么 */
  readonly attacker: string;
  readonly defender: string;
  /** 这一章学什么 */
  readonly lessons: readonly string[];
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
  readonly pathogens: Readonly<Record<string, PathogenText>>;
  readonly outcomes: Readonly<Record<Outcome['reason'], string>>;
  readonly chapters: Readonly<Record<ChapterId, ChapterText>>;
  /** 性状的各项效果、科技的各项效果叫什么（详情里列“这样东西改变了什么”用） */
  readonly effects: Readonly<Record<EffectKey, string>>;
  readonly defense: Readonly<Record<DefenseKey, string>>;
}
