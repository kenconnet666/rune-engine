/**
 * 世界地图上的地区：来自构建脚本的产物 generated/world.json（各项数据的出处见 scripts/build-map.ts）。
 * 注意航线和海运是引力模型估出来的，不是真实的航班、航运数据。
 */
import type { Climate, Links } from '@miwang/sim';
import world from '../generated/world.json' with { type: 'json' };
import type { Locale } from './text/index.ts';

export interface WorldRegion {
  /** ISO 3166-1 的数字代码；数据源没给代码的几个地区是 “#” 加它在数据源里的下标 */
  readonly id: string;
  /** 英文名（数据源自带） */
  readonly name: string;
  /** 中文名；查不到的是 null（现在没有这样的地区，以后换数据源可能会有） */
  readonly nameZh: string | null;
  /** 人口的估计数，和它是哪一年的 */
  readonly population: number;
  readonly populationYear: number;
  /** 国内生产总值，百万美元 */
  readonly gdp: number;
  /** 富裕程度：0 低收入 … 3 高收入 */
  readonly wealth: number;
  readonly climate: Climate;
  /** 人口密度：0 稀疏、1 一般、2 稠密 */
  readonly density: number;
  readonly south: boolean;
  readonly coastal: boolean;
  /** 中心的经纬度（度） */
  readonly lonLat: readonly number[];
  /** 面积，正比于真实面积（整个地球是 4π ≈ 12.57） */
  readonly area: number;
  /** 中心在地图上的位置 */
  readonly center: readonly number[];
  /** 陆路相邻的地区（下标） */
  readonly neighbors: readonly number[];
  readonly air: Links;
  readonly sea: Links;
}

export const regions = world.regions as readonly WorldRegion[];
export const bounds: readonly number[] = world.bounds;

/** 地区的名字：中文没有的用英文名顶上 */
export const regionName = (index: number, locale: Locale): string => {
  const region = regions[index];
  if (!region) return '';
  return locale === 'zh' ? (region.nameZh ?? region.name) : region.name;
};
