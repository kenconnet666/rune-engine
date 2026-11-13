/**
 * 《迷惘》的数据：
 *   world.ts    世界地图上的地区（来自构建脚本的产物）
 *   tables/     性状表、科技表、事件表、病原体档案
 *   config.ts   把它们拼成一局的配置
 *   text/       各张表里的东西在界面上的名字和说明，每种语言一份
 */
export { createConfig, type ConfigOptions } from './config.ts';
export { EVENTS } from './tables/events.ts';
export { DEFAULT_PATHOGEN, PATHOGENS } from './tables/pathogens.ts';
export { TECHS } from './tables/techs.ts';
export { TRAITS } from './tables/traits.ts';
export { CONTENT_TEXT, type ContentText, type Label, type Locale } from './text/index.ts';
export { bounds, populations, regionName, regions, type WorldRegion } from './world.ts';
