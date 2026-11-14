/** 开一局：把世界、病原体档案、各张表和规则数值拼成模拟要的配置；打的是某一章的话，再按那一章改 */
import { DEFAULT_RULES, type OutbreakConfig, type PathogenProfile } from '@miwang/sim';
import type { ChapterDef } from './tables/chapters.ts';
import { DECISIONS } from './tables/decisions.ts';
import { EVENTS } from './tables/events.ts';
import { DEFAULT_PATHOGEN, PATHOGENS } from './tables/pathogens.ts';
import { SKILLS } from './tables/skills.ts';
import { TASKS } from './tables/tasks.ts';
import { TECHS } from './tables/techs.ts';
import { TRAITS } from './tables/traits.ts';
import { regions } from './world.ts';

/** 起源地要有这么多人：太小的地方疫情起不来 */
const ORIGIN_POPULATION = 5_000_000;

const totalGdp = regions.reduce((sum, region) => sum + region.gdp, 0);

export interface ConfigOptions {
  /** 病原体档案；不指定的话，章节用它自己定的那一种，普通对局用默认的 */
  readonly pathogen?: PathogenProfile;
  /** 指定起源地（下标）；不指定就按种子在人口够多（并且符合章节条件）的地区里挑一个 */
  readonly origin?: number;
  /** 打的是哪一章；普通对局不写 */
  readonly chapter?: ChapterDef;
}

export function createConfig(
  seed: number,
  startDate: string,
  options: ConfigOptions = {},
): OutbreakConfig {
  const { chapter } = options;
  const candidates = regions.flatMap((region, index) =>
    region.population >= ORIGIN_POPULATION && (chapter?.origin(region) ?? true) ? [index] : [],
  );
  const chapterPathogen = PATHOGENS.find((pathogen) => pathogen.id === chapter?.pathogen);
  return {
    seed,
    startDate,
    origin: options.origin ?? candidates[Math.abs(seed) % candidates.length] ?? 0,
    regions: regions.map((region) => ({
      population: region.population,
      climate: region.climate,
      wealth: region.wealth,
      density: region.density,
      economy: region.gdp / totalGdp,
      south: region.south,
      neighbors: region.neighbors,
      air: region.air,
      sea: region.sea,
    })),
    pathogen: options.pathogen ?? chapterPathogen ?? DEFAULT_PATHOGEN,
    traits: TRAITS,
    techs: TECHS,
    events: EVENTS,
    skills: SKILLS,
    decisions: DECISIONS,
    tasks: TASKS,
    rules: chapter ? { ...DEFAULT_RULES, ...chapter.rules } : DEFAULT_RULES,
    // 普通对局的配置里没有这一项（不是 undefined）：存档里的配置要和重新生成的逐字相同
    ...(chapter && { scenario: { id: chapter.id, goals: chapter.goals, days: chapter.days } }),
  };
}
