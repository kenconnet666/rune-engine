/**
 * 地区网格：把 TopoJSON 里的一组多边形（国家、省）投影到平面、切成三角形，
 * 顺便算出每个地区的面积、中心点和相邻的地区（共享一段边界就算相邻）。
 */
import type { RegionMeshData } from '@rune-engine/render/mesh-format';
import earcut from 'earcut';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import { feature, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { equalEarth, type Projection } from './projection.ts';

export interface RegionInfo {
  /** 数据源里的编号（world-atlas 是 ISO 3166-1 的数字代码）；数据源没给的是 “#” 加它在数据源里的下标 */
  readonly id: string;
  readonly name: string;
  /** 面积，正比于真实面积（按等面积投影量的，和画图用哪种投影无关；整个地球约 13.6） */
  readonly area: number;
  /** 最大的那块陆地的中心：放标签、连航线用 */
  readonly center: readonly [x: number, y: number];
  /** 陆路相邻的地区（下标） */
  readonly neighbors: readonly number[];
}

export interface RegionMesh extends RegionMeshData {
  readonly regions: readonly RegionInfo[];
}

/** 一个环的有向面积与中心（鞋带公式） */
function ringShape(ring: readonly (readonly [number, number])[]) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  return { area: Math.abs(area), center: [cx / (6 * area), cy / (6 * area)] as const };
}

/**
 * 跨过 180° 经线的环（楚科奇、斐济）：相邻两点的经度会从 +179 跳到 -179，直接投影会拉出一条横贯地图的线。
 * 把西半球那几个点加 360°，整个环连在一起画在地图右缘外面一点
 */
function unwrap(ring: readonly Position[]): readonly Position[] {
  // 伸到极点的环（南极洲）本来就沿着地图的下缘从 -180° 走到 +180°，不是跨线
  const polar = ring.some((point) => Math.abs(point[1]!) > 85);
  const crosses =
    !polar &&
    ring.some((point, index) => {
      const next = ring[(index + 1) % ring.length]!;
      return Math.abs(point[0]! - next[0]!) > 180;
    });
  return crosses ? ring.map(([lon, lat]) => [lon! < 0 ? lon! + 360 : lon!, lat!]) : ring;
}

export interface RegionMeshOptions {
  /** 画图用的投影，默认 Equal Earth */
  project?: Projection;
  /** 不要的地区（按 {@link RegionInfo.id}）：没有常住人口的南极洲之类 */
  skip?: (id: string) => boolean;
}

export function buildRegionMesh(
  topology: Topology,
  objectName: string,
  { project = equalEarth, skip = () => false }: RegionMeshOptions = {},
): RegionMesh {
  const collection = topology.objects[objectName] as GeometryCollection<{ name?: string }>;
  if (collection?.type !== 'GeometryCollection') {
    throw new Error(`TopoJSON 里没有名为 ${objectName} 的图层`);
  }
  const all = feature(topology, collection).features;
  const adjacency = neighbors(collection.geometries);
  // 数据源没给编号的地区记成 “#下标”：直接拿下标当编号会和真编号撞上
  // （world-atlas 里索马里兰没有编号，它的下标 166 正好是科科斯群岛的 ISO 代码）
  const ids = all.map((item, index) => (item.id === undefined ? `#${index}` : String(item.id)));
  // 去掉不要的地区之后下标会变：原下标 → 新下标（不要的是 -1），相邻关系里的下标跟着换
  let count = 0;
  const remap = ids.map((id) => (skip(id) ? -1 : count++));

  const vertices: number[] = [];
  const indices: number[] = [];
  const lines: number[] = [];
  const regions: RegionInfo[] = [];
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

  all.forEach((item, source) => {
    const region = remap[source]!;
    if (region < 0) return;
    const geometry = item.geometry as Polygon | MultiPolygon | null;
    const polygons: Position[][][] =
      geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    let area = 0;
    let largest = 0;
    let center: readonly [number, number] = [0, 0];

    for (const polygon of polygons) {
      const flat: number[] = [];
      const holes: number[] = [];
      const base = vertices.length / 3;
      polygon.forEach((ring, ringIndex) => {
        // GeoJSON 的环首尾是同一个点：去掉重复的那个
        const lonLat = unwrap(ring.slice(0, -1));
        const points = lonLat.map(([lon, lat]) => project(lon!, lat!));
        if (points.length < 3) return;
        if (ringIndex > 0) holes.push(flat.length / 2);
        const start = base + flat.length / 2;
        points.forEach(([x, y], index) => {
          flat.push(x, y);
          lines.push(start + index, start + ((index + 1) % points.length));
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
        });
        // 面积按等面积投影量（画图的投影可能把高纬度放大）；中心取画出来的那个形状的
        const size = ringShape(lonLat.map(([lon, lat]) => equalEarth(lon!, lat!))).area;
        if (ringIndex === 0) {
          area += size;
          if (size > largest) {
            largest = size;
            center = ringShape(points).center;
          }
        } else {
          area -= size;
        }
      });
      for (let i = 0; i < flat.length; i += 2) vertices.push(flat[i]!, flat[i + 1]!, region);
      for (const index of earcut(flat, holes, 2)) indices.push(base + index);
    }

    regions.push({
      id: ids[source]!,
      name: item.properties?.name ?? ids[source]!,
      area,
      center,
      neighbors: (adjacency[source] ?? []).flatMap((index) =>
        remap[index]! >= 0 ? [remap[index]!] : [],
      ),
    });
  });

  return {
    regions,
    vertices: Float32Array.from(vertices),
    indices: Uint32Array.from(indices),
    lines: Uint32Array.from(lines),
    bounds,
  };
}
