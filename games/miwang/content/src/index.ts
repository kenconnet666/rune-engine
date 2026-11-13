/**
 * 《迷惘》的数据。现在只有世界地图：地区来自构建脚本的产物（generated/world.json）。
 *
 * 注意：人口现在是按面积摊的占位数（总数约 80 亿），航线是面积最大的几个地区两两相连——都只是为了让模拟跑起来。
 * 接真实的人口、航线数据（带出处）是下一步，接上之前不要把这里的数字当真。
 */
import type { OutbreakConfig, RegionConfig } from '@miwang/sim';
import world from '../generated/world.json' with { type: 'json' };

export interface WorldRegion {
  /** ISO 3166-1 的数字代码；数据源没给代码的几个地区是 “#” 加它在数据源里的下标 */
  readonly id: string;
  /** 英文名（数据源自带） */
  readonly name: string;
  /** 中文名；查不到的是 null（现在没有这样的地区，以后换数据源可能会有） */
  readonly nameZh: string | null;
  readonly area: number;
  readonly center: readonly number[];
  readonly neighbors: readonly number[];
}

export const regions: readonly WorldRegion[] = world.regions;
export const bounds: readonly number[] = world.bounds;

const WORLD_POPULATION = 8_000_000_000;
/** 有航线的枢纽数：面积最大的这么多个地区两两相连（占位） */
const HUBS = 14;

/** 地区的名字：有中文名用中文名，没有的用英文名 */
export const regionName = (index: number): string =>
  regions[index]?.nameZh ?? regions[index]?.name ?? '';

const totalArea = regions.reduce((sum, region) => sum + region.area, 0);

/** 各地区的人口（占位：按面积摊，见文件开头的说明） */
export const populations: readonly number[] = regions.map((region) =>
  Math.max(50_000, Math.round((region.area / totalArea) * WORLD_POPULATION)),
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
