/**
 * 生成世界地图的素材（pnpm --filter @miwang/content build:map）：
 *   generated/world-mesh.bin   地区网格，渲染器直接加载
 *   generated/world.json       各地区的名字、面积、中心、相邻关系，模拟的配置从它来
 * 数据是 world-atlas 的 1:1.1 亿国家边界（Natural Earth，公有领域），中文名来自 i18n-iso-countries（MIT），
 * 人口来自 data/population.json（Natural Earth 的属性表，见 scripts/import-population.ts）。产物不进仓库：开发服务器启动前（客户端的 predev）、
 * 类型检查前（根目录的 typecheck 先跑它，再并行检查各包——客户端的检查要读这里的 world.json）自动生成。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRegionMesh, miller } from '@rune-engine/assets-build';
import { encodeRegionMesh } from '@rune-engine/render/mesh-format';
import countries from 'i18n-iso-countries';
import zh from 'i18n-iso-countries/langs/zh.json' with { type: 'json' };
import type { Topology } from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json' with { type: 'json' };
import census from '../data/population.json' with { type: 'json' };

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

const mesh = buildRegionMesh(atlas as unknown as Topology, 'countries', {
  // 平的矩形地图：经线竖直、纬线水平
  project: miller,
  skip: (id) => id === ANTARCTICA,
});

const populations: Readonly<Record<string, { population: number; year: number }>> = census.regions;
/** 按 ISO 代码找；没有代码的几个地区按英文名找（见 import-population.ts） */
const populationOf = (region: { id: string; name: string }) => {
  const entry = populations[region.id] ?? populations[region.name];
  if (!entry) {
    throw new Error(
      `data/population.json 里没有 ${region.name}（${region.id}）的人口：边界数据换过的话要重新导入`,
    );
  }
  return entry;
};

writeFileSync(join(out, 'world-mesh.bin'), encodeRegionMesh(mesh));
writeFileSync(
  join(out, 'world.json'),
  JSON.stringify({
    bounds: mesh.bounds.map((value) => +value.toFixed(5)),
    regions: mesh.regions.map((region) => ({
      id: region.id,
      name: region.name,
      nameZh: NAMES_ZH[region.name] ?? countries.getName(region.id, 'zh') ?? null,
      population: populationOf(region).population,
      populationYear: populationOf(region).year,
      area: +region.area.toFixed(6),
      center: region.center.map((value) => +value.toFixed(4)),
      neighbors: region.neighbors,
    })),
  }),
);
console.log(
  `世界地图：${mesh.regions.length} 个地区，${mesh.vertices.length / 3} 个顶点，${mesh.indices.length / 3} 个三角形`,
);
