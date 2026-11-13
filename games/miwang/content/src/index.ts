/**
 * 《迷惘》的数据。现在只有世界地图：地区来自构建脚本的产物（generated/world.json）。
 *
 * 注意：人口现在是按面积摊的占位数（总数约 80 亿），航线是面积最大的几个地区两两相连——都只是为了让模拟跑起来。
 * 接真实的人口、航线数据（带出处）是下一步，接上之前不要把这里的数字当真。
 */
import type { OutbreakConfig, RegionConfig } from '@miwang/sim';
import world from '../generated/world.json' with { type: 'json' };

export interface WorldRegion {
  /** ISO 3166-1 的数字代码 */
  readonly id: string;
  /** 英文名（数据源自带）；中文名等接上多语言文案再补 */
  readonly name: string;
  readonly area: number;
  readonly center: readonly number[];
  readonly neighbors: readonly number[];
}

export const regions: readonly WorldRegion[] = world.regions;
export const bounds: readonly number[] = world.bounds;

const WORLD_POPULATION = 8_000_000_000;
/** 有航线的枢纽数：面积最大的这么多个地区两两相连（占位） */
const HUBS = 14;
/** 南极洲（ISO 010）没有常住人口 */
const UNINHABITED = new Set(['010']);

const inhabitedArea = regions.reduce(
  (sum, region) => sum + (UNINHABITED.has(region.id) ? 0 : region.area),
  0,
);

/** 各地区的人口（占位：按面积摊，见文件开头的说明） */
export const populations: readonly number[] = regions.map((region) =>
  UNINHABITED.has(region.id)
    ? 0
    : Math.max(50_000, Math.round((region.area / inhabitedArea) * WORLD_POPULATION)),
);

/** 按种子开一局：起点在有人住的地区里按种子挑一个 */
export function createConfig(seed: number, startDate: string): OutbreakConfig {
  const hubs = regions
    .map((_, index) => ({ index, population: populations[index]! }))
    .sort((a, b) => b.population - a.population)
    .slice(0, HUBS)
    .map((hub) => hub.index);

  const config: RegionConfig[] = regions.map((region, index) => ({
    population: populations[index]!,
    neighbors: region.neighbors,
    flights: hubs.includes(index) ? hubs.filter((hub) => hub !== index) : [],
  }));
  const candidates = config.flatMap((region, index) =>
    region.population > 5_000_000 ? [index] : [],
  );
  return {
    seed,
    startDate,
    regions: config,
    origin: candidates[Math.abs(seed) % candidates.length] ?? 0,
  };
}
