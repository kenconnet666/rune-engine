/**
 * 《迷惘》的规则（设计见 docs/design.md）。只依赖引擎的模拟内核：浏览器、Worker、Node 里算出逐位相同的结果。
 *
 *   config.ts    一局的配置：世界、病原体档案、性状表、科技表、事件表、规则里的数值
 *   state.ts     一局的状态
 *   commands.ts  玩家能做的事
 *   view.ts      各方能看到的部分
 *   outbreak.ts  一天里各条规则的先后顺序
 *   rules/       规则，一条一个文件（传播、出行、防控、研究、事件、技能、抉择、胜负……）
 *   ai/          电脑对手
 */
export {
  aiStyle,
  ATTACK_STYLES,
  decide,
  DEFEND_STYLES,
  type AiLevel,
  type AiStyle,
  type AttackStyle,
  type DefendStyle,
} from './ai/index.ts';
export type { Command } from './commands.ts';
export {
  COLD,
  DEFENSE_KEYS,
  EFFECT_KEYS,
  LEVELS,
  MAX_LEVEL,
  measureLevel,
  MEASURES,
  measuresOf,
  MODIFIER_KEYS,
  ROUTES,
  TEMPERATE,
  TROPICAL,
  VACCINE_POLICIES,
  withMeasure,
  type CalendarDef,
  type CalendarKind,
  type Climate,
  type DecisionDef,
  type DecisionOption,
  type DefenseEffects,
  type DefenseKey,
  type DefenseStats,
  type EffectKey,
  type Effects,
  type EventDef,
  type EventKind,
  type Goal,
  type GoalMetric,
  type Links,
  type Measure,
  type MeasureLevel,
  type ModifierKey,
  type Modifiers,
  type OutbreakConfig,
  type PathogenProfile,
  type PathogenStats,
  type RegionConfig,
  type Route,
  type Rules,
  type Scenario,
  type SkillDef,
  type SkillKind,
  type SynergyDef,
  type TaskDef,
  type TaskMetric,
  type TechDef,
  type TraitDef,
  type TraitGroup,
  type VaccinePolicy,
} from './config.ts';
export { DEFAULT_RULES } from './defaults.ts';
export type { CalendarEntry } from './rules/calendar.ts';
export { outbreak } from './outbreak.ts';
export { setupCost, upkeepOf } from './rules/defense.ts';
export type { History } from './rules/history.ts';
export type { Grade, Review, ReviewPart } from './rules/review.ts';
export {
  ATTACKER,
  DEFENDER,
  type Hop,
  type NewsItem,
  type NewsKind,
  type Outcome,
  type OutbreakState,
} from './state.ts';
export {
  HAS_DISASTER,
  HAS_GATHERING,
  HAS_LEAK,
  HAS_RELIEF,
  HAS_SURGE,
  HAS_UNREST,
  type Offer,
  type OutbreakView,
} from './view.ts';
