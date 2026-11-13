/**
 * 从 Natural Earth 的国家数据里取出各地区的人口，写成 data/population.json（进仓库，构建地图时读它）。
 *
 * 用法：先把下面这个文件下载到本地，再把路径传进来——
 *   node scripts/import-population.ts <ne_110m_admin_0_countries.geojson 的路径>
 * 来源：https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
 * （Natural Earth，公有领域）。原始文件不进仓库：八百多 KB 里我们只用两个字段。
 *
 * 每个地区记在它的 ISO 3166-1 数字代码下面（和 world-atlas 的地区编号是同一套）。Natural Earth 里
 * 法国、挪威的 ISO_N3 是 -99，要用 ISO_N3_EH；科索沃、北塞浦路斯、索马里兰两个字段都是 -99，记在英文名下面
 * （world-atlas 的边界也是从 Natural Earth 来的，这几个的名字一样）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = 'v5.1.2';

interface Country {
  readonly properties: {
    readonly NAME: string;
    readonly ISO_N3: string;
    readonly ISO_N3_EH: string;
    readonly POP_EST: number;
    readonly POP_YEAR: number;
  };
}

const path = process.argv[2];
if (!path) throw new Error('要给出 ne_110m_admin_0_countries.geojson 的路径');
const { features } = JSON.parse(readFileSync(path, 'utf8')) as { features: Country[] };

const NO_CODE = '-99';
const keyOf = ({ NAME, ISO_N3, ISO_N3_EH }: Country['properties']) =>
  ISO_N3 !== NO_CODE ? ISO_N3 : ISO_N3_EH !== NO_CODE ? ISO_N3_EH : NAME;

const regions: Record<string, { name: string; population: number; year: number }> = {};
for (const { properties } of features.toSorted((a, b) =>
  a.properties.NAME < b.properties.NAME ? -1 : 1,
)) {
  const { NAME, POP_EST, POP_YEAR } = properties;
  const key = keyOf(properties);
  if (regions[key]) throw new Error(`${NAME} 和 ${regions[key].name} 记在了同一个编号 ${key} 下面`);
  if (!(POP_EST >= 0) || !(POP_YEAR > 1900)) {
    throw new Error(`${NAME} 的人口数据不对：POP_EST=${POP_EST} POP_YEAR=${POP_YEAR}`);
  }
  regions[key] = { name: NAME, population: Math.round(POP_EST), year: POP_YEAR };
}

const out = join(import.meta.dirname, '..', 'data');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, 'population.json'),
  `${JSON.stringify(
    {
      source: `Natural Earth ${VERSION}，1:1.1 亿 Admin 0 – Countries，字段 POP_EST、POP_YEAR（公有领域）`,
      url: `https://github.com/nvkelso/natural-earth-vector/blob/${VERSION}/geojson/ne_110m_admin_0_countries.geojson`,
      regions,
    },
    null,
    2,
  )}\n`,
);
console.log(`人口：${Object.keys(regions).length} 个地区`);
