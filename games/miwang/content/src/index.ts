/**
 * 《迷惘》的数据：
 *   world.ts    世界地图上的地区（来自构建脚本的产物）
 *   tables/     性状表、科技表、事件表、病原体档案
 *   config.ts   把它们拼成一局的配置
 *   text.ts     界面上的名字和说明
 */
export { createConfig, type ConfigOptions } from './config.ts';
export { EVENTS } from './tables/events.ts';
export { DEFAULT_PATHOGEN, PATHOGENS } from './tables/pathogens.ts';
export { TECHS } from './tables/techs.ts';
export { TRAITS } from './tables/traits.ts';
export {
  EVENT_TEXT,
  GROUP_TEXT,
  MEASURE_TEXT,
  OUTCOME_TEXT,
  TECH_TEXT,
  TRAIT_TEXT,
  type Label,
} from './text.ts';
export { bounds, populations, regionName, regions, type WorldRegion } from './world.ts';
