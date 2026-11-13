/** 开一局：把世界、病原体档案、各张表和规则数值拼成模拟要的配置 */
import { DEFAULT_RULES, type OutbreakConfig, type PathogenProfile } from '@miwang/sim';
import { EVENTS } from './tables/events.ts';
import { DEFAULT_PATHOGEN } from './tables/pathogens.ts';
import { TECHS } from './tables/techs.ts';
import { TRAITS } from './tables/traits.ts';
import { regions } from './world.ts';

/** 起源地要有这么多人：太小的地方疫情起不来 */
const ORIGIN_POPULATION = 5_000_000;

const totalGdp = regions.reduce((sum, region) => sum + region.gdp, 0);

export interface ConfigOptions {
  readonly pathogen?: PathogenProfile;
  /** 指定起源地（下标）；不指定就按种子在人口够多的地区里挑一个 */
  readonly origin?: number;
}

export function createConfig(
  seed: number,
  startDate: string,
  options: ConfigOptions = {},
): OutbreakConfig {
  const candidates = regions.flatMap((region, index) =>
    region.population >= ORIGIN_POPULATION ? [index] : [],
  );
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
    pathogen: options.pathogen ?? DEFAULT_PATHOGEN,
    traits: TRAITS,
    techs: TECHS,
    events: EVENTS,
    rules: DEFAULT_RULES,
  };
}
