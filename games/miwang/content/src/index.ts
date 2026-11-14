/**
 * 《迷惘》的数据：
 *   world.ts    世界地图上的地区（来自构建脚本的产物）
 *   tables/     性状表、科技表、事件表、技能表、抉择表、短期任务表、病原体档案、五章的剧本、致谢表
 *   config.ts   把它们拼成一局的配置
 *   text/       各张表里的东西在界面上的名字和说明，每种语言一份
 */
export { createConfig, type ConfigOptions } from './config.ts';
export { CALENDAR } from './tables/calendar.ts';
export { CHAPTER_IDS, CHAPTERS, type ChapterDef, type ChapterId } from './tables/chapters.ts';
export { CONDITIONS, drawConditions, type ConditionDef } from './tables/conditions.ts';
export { CREDITS, type Credit, type CreditId, type CreditSection } from './tables/credits.ts';
export { DECISIONS } from './tables/decisions.ts';
export { EVENTS } from './tables/events.ts';
export { DEFAULT_PATHOGEN, PATHOGENS, SOURCES, type Source } from './tables/pathogens.ts';
export { SKILLS } from './tables/skills.ts';
export { SYNERGIES } from './tables/synergies.ts';
export { TASKS } from './tables/tasks.ts';
export { TECHS } from './tables/techs.ts';
export { TRAITS } from './tables/traits.ts';
export {
  CONTENT_TEXT,
  type ChapterText,
  type ContentText,
  type DecisionText,
  type Label,
  type Locale,
  type PathogenText,
} from './text/index.ts';
export { bounds, regionName, regions, type WorldRegion } from './world.ts';
