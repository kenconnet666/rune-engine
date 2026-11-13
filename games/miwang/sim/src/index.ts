/**
 * 《迷惘》的规则（设计见 docs/design.md）。只依赖引擎的模拟内核：浏览器、Worker、Node 里算出逐位相同的结果。
 *
 *   config.ts    一局的配置：世界、病原体档案、性状表、科技表、事件表、规则里的数值
 *   state.ts     一局的状态
 *   commands.ts  玩家能做的事
 *   view.ts      各方能看到的部分
 *   outbreak.ts  一天里各条规则的先后顺序
 *   rules/       规则，一条一个文件
 *   ai/          电脑对手
 */
export { decide, type AiLevel } from './ai/index.ts';
export type { Command } from './commands.ts';
export {
  COLD,
  DEFENSE_KEYS,
  EFFECT_KEYS,
  MEASURE_BITS,
  MEASURES,
  ROUTES,
  TEMPERATE,
  TROPICAL,
  type Climate,
  type DefenseEffects,
  type DefenseKey,
  type DefenseStats,
  type EffectKey,
  type Effects,
  type EventDef,
  type EventKind,
  type Links,
  type Measure,
  type OutbreakConfig,
  type PathogenProfile,
  type PathogenStats,
  type RegionConfig,
  type Route,
  type Rules,
  type TechDef,
  type TraitDef,
  type TraitGroup,
} from './config.ts';
export { DEFAULT_RULES } from './defaults.ts';
export { outbreak } from './outbreak.ts';
export { setupCost, upkeepOf } from './rules/defense.ts';
export type { History } from './rules/history.ts';
export {
  ATTACKER,
  DEFENDER,
  type NewsItem,
  type NewsKind,
  type Outcome,
  type OutbreakState,
} from './state.ts';
export { HAS_DISASTER, HAS_GATHERING, type Offer, type OutbreakView } from './view.ts';
