/**
 * 航线与海运：不是真实的航班、航运数据，是用引力模型估出来的——两地之间的往来和对方的“分量”成正比、
 * 随距离衰减。每个地区只留往来最多的几个目的地，权重是“这个地区的出行量里去那里的占多少”。
 *
 * 只在构建地图时跑（Node 里，用了三角函数）；结果写进 world.json，运行时只是查表，不影响模拟的确定性。
 */

export interface Place {
  readonly longitude: number;
  readonly latitude: number;
  readonly population: number;
  /** 国内生产总值，百万美元 */
  readonly gdp: number;
  readonly coastal: boolean;
  /** 没有陆路邻居：进出只能靠飞机和船 */
  readonly island: boolean;
}

export interface Links {
  to: number[];
  weight: number[];
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** 两地的大圆距离（千米，半正矢公式） */
export function distanceKm(a: Place, b: Place): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Model {
  /** 目的地的分量 */
  mass(place: Place): number;
  /** 距离的衰减：分量 ÷ (距离 + offset)^power */
  offset: number;
  power: number;
  /** 每个地区留几个目的地 */
  keep: number;
  /** 这个地区的人有多常走这种路线（0–1）；0 表示这种路线它没有 */
  reach(place: Place): number;
}

function links(places: readonly Place[], model: Model): Links[] {
  return places.map((from, i) => {
    const reach = model.reach(from);
    if (reach <= 0) return { to: [], weight: [] };
    const flows = places
      .map((to, j) => ({
        j,
        flow:
          i === j || model.reach(to) <= 0
            ? 0
            : model.mass(to) / (distanceKm(from, to) + model.offset) ** model.power,
      }))
      .filter((entry) => entry.flow > 0)
      .sort((a, b) => b.flow - a.flow)
      .slice(0, model.keep);
    const total = flows.reduce((sum, entry) => sum + entry.flow, 0);
    return {
      to: flows.map((entry) => entry.j),
      weight: flows.map((entry) => +((entry.flow / total) * reach).toFixed(5)),
    };
  });
}

/** 航线：经济越发达的地方航班越多；富裕的地区人们飞得更多 */
export function airLinks(places: readonly Place[]): Links[] {
  return links(places, {
    mass: (place) => place.gdp ** 0.7 * place.population ** 0.3,
    offset: 800,
    power: 1.5,
    keep: 8,
    reach: (place) => {
      const perCapita = place.population > 0 ? (place.gdp * 1e6) / place.population : 0;
      return Math.min(1, Math.max(0.1, Math.sqrt(perCapita / 40_000)));
    },
  });
}

/** 海运：只在有海岸线的地区之间；岛屿对它的依赖更重 */
export function seaLinks(places: readonly Place[]): Links[] {
  return links(places, {
    mass: (place) => Math.sqrt(place.gdp * place.population),
    offset: 1500,
    power: 1,
    keep: 6,
    reach: (place) => (place.coastal ? (place.island ? 1 : 0.5) : 0),
  });
}
