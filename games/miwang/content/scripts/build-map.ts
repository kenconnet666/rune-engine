/**
 * 生成世界地图的素材（pnpm --filter @miwang/content build:map）：
 *   generated/world-mesh.bin   地区网格，渲染器直接加载
 *   generated/world.json       各地区的名字、人口、气候、路线……模拟的配置从它来
 *
 * 数据来源：
 *   边界      world-atlas 的 1:1.1 亿国家边界（Natural Earth，公有领域）
 *   中文名    i18n-iso-countries（MIT）
 *   人口、经济、收入分组   data/natural-earth.json（Natural Earth 的属性表，见 import-natural-earth.ts）
 *   气候、密度   这里按纬度、按人口 ÷ 面积分出来的
 *   航线、海运   引力模型估的（见 routes.ts），不是真实数据
 *
 * 产物不进仓库：开发服务器启动前（客户端的 predev）、类型检查前（根目录的 typecheck 先跑它，
 * 再并行检查各包——客户端的检查要读这里的 world.json）自动生成。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRegionMesh, miller } from '@rune-engine/assets-build';
import { encodeRegionMesh } from '@rune-engine/render/mesh-format';
import countries from 'i18n-iso-countries';
import zh from 'i18n-iso-countries/langs/zh.json' with { type: 'json' };
import type { Topology } from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json' with { type: 'json' };
import naturalEarth from '../data/natural-earth.json' with { type: 'json' };
import { airLinks, seaLinks, type Place } from './routes.ts';

const out = join(import.meta.dirname, '..', 'generated');
mkdirSync(out, { recursive: true });

countries.registerLocale(zh);

/** 南极洲（ISO 010）没有常住人口，不进地图：图面留给有人住的地方 */
const ANTARCTICA = '010';

/** 按 ISO 代码查不到、或者查到的名字不是平常的叫法的地区，按数据源里的英文名给中文名 */
const NAMES_ZH: Readonly<Record<string, string>> = {
  Kosovo: '科索沃',
  'N. Cyprus': '北塞浦路斯',
  Somaliland: '索马里兰',
  'W. Sahara': '西撒哈拉',
};

/** 网格里的面积是单位球上的（整个地球是 4π）：换成平方千米 */
const KM2_PER_AREA = 510_100_000 / (4 * Math.PI);
/** 气候按中心的纬度分：回归线以内是热带，这条线以外算寒带 */
const TROPIC = 23.5;
const COLD_ABOVE = 55;
/** 人口密度（人 / 平方千米）的两条线：以下是稀疏，以上是稠密 */
const SPARSE_BELOW = 25;
const DENSE_ABOVE = 150;

const mesh = buildRegionMesh(atlas as unknown as Topology, 'countries', {
  // 平的矩形地图：经线竖直、纬线水平
  project: miller,
  skip: (id) => id === ANTARCTICA,
});

interface Census {
  readonly population: number;
  readonly year: number;
  readonly gdp: number;
  readonly wealth: number;
}
const census: Readonly<Record<string, Census>> = naturalEarth.regions;
/** 按 ISO 代码找；没有代码的几个地区按英文名找（见 import-natural-earth.ts） */
const censusOf = (region: { id: string; name: string }) => {
  const entry = census[region.id] ?? census[region.name];
  if (!entry) {
    throw new Error(
      `data/natural-earth.json 里没有 ${region.name}（${region.id}）：边界数据换过的话要重新导入`,
    );
  }
  return entry;
};

const places: Place[] = mesh.regions.map((region) => ({
  longitude: region.lonLat[0],
  latitude: region.lonLat[1],
  population: censusOf(region).population,
  gdp: censusOf(region).gdp,
  coastal: region.coastal,
  island: region.neighbors.length === 0,
}));
const air = airLinks(places);
const sea = seaLinks(places);

writeFileSync(join(out, 'world-mesh.bin'), encodeRegionMesh(mesh));
writeFileSync(
  join(out, 'world.json'),
  JSON.stringify({
    bounds: mesh.bounds.map((value) => +value.toFixed(5)),
    regions: mesh.regions.map((region, index) => {
      const { population, year, gdp, wealth } = censusOf(region);
      const latitude = region.lonLat[1];
      const density = population / (region.area * KM2_PER_AREA);
      return {
        id: region.id,
        name: region.name,
        nameZh: NAMES_ZH[region.name] ?? countries.getName(region.id, 'zh') ?? null,
        population,
        populationYear: year,
        gdp,
        wealth,
        // 0 热带、1 温带、2 寒带
        climate: Math.abs(latitude) < TROPIC ? 0 : Math.abs(latitude) < COLD_ABOVE ? 1 : 2,
        // 0 稀疏、1 一般、2 稠密
        density: density < SPARSE_BELOW ? 0 : density < DENSE_ABOVE ? 1 : 2,
        south: latitude < 0,
        coastal: region.coastal,
        lonLat: region.lonLat.map((value) => +value.toFixed(2)),
        area: +region.area.toFixed(6),
        center: region.center.map((value) => +value.toFixed(4)),
        neighbors: region.neighbors,
        air: air[index],
        sea: sea[index],
      };
    }),
  }),
);
console.log(
  `世界地图：${mesh.regions.length} 个地区，${mesh.vertices.length / 3} 个顶点，${mesh.indices.length / 3} 个三角形`,
);
