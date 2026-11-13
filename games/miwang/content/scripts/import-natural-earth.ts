/**
 * 从 Natural Earth 的国家数据里取出各地区的人口、经济总量、收入分组，写成 data/natural-earth.json
 * （进仓库，构建地图时读它）。
 *
 * 用法：先把下面这个文件下载到本地，再把路径传进来——
 *   node scripts/import-natural-earth.ts <ne_110m_admin_0_countries.geojson 的路径>
 * 来源：https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
 * （Natural Earth，公有领域）。原始文件不进仓库：八百多 KB 里我们只用几个字段。
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
    /** 国内生产总值，百万美元 */
    readonly GDP_MD: number;
    /** 世界银行的收入分组，形如 "3. Upper middle income"：1、2 是高收入，5 是低收入 */
    readonly INCOME_GRP: string;
  };
}

/** 收入分组开头的数字 → 富裕程度（0 低收入 … 3 高收入） */
const WEALTH: Readonly<Record<string, number>> = { '1': 3, '2': 3, '3': 2, '4': 1, '5': 0 };

const path = process.argv[2];
if (!path) throw new Error('要给出 ne_110m_admin_0_countries.geojson 的路径');
const { features } = JSON.parse(readFileSync(path, 'utf8')) as { features: Country[] };

const NO_CODE = '-99';
const keyOf = ({ NAME, ISO_N3, ISO_N3_EH }: Country['properties']) =>
  ISO_N3 !== NO_CODE ? ISO_N3 : ISO_N3_EH !== NO_CODE ? ISO_N3_EH : NAME;

interface Entry {
  name: string;
  population: number;
  year: number;
  gdp: number;
  wealth: number;
}

const regions: Record<string, Entry> = {};
for (const { properties } of features.toSorted((a, b) =>
  a.properties.NAME < b.properties.NAME ? -1 : 1,
)) {
  const { NAME, POP_EST, POP_YEAR, GDP_MD, INCOME_GRP } = properties;
  const key = keyOf(properties);
  const wealth = WEALTH[INCOME_GRP[0] ?? ''];
  if (regions[key]) throw new Error(`${NAME} 和 ${regions[key].name} 记在了同一个编号 ${key} 下面`);
  if (!(POP_EST >= 0) || !(POP_YEAR > 1900) || !(GDP_MD >= 0) || wealth === undefined) {
    throw new Error(
      `${NAME} 的数据不对：POP_EST=${POP_EST} POP_YEAR=${POP_YEAR} GDP_MD=${GDP_MD} INCOME_GRP=${INCOME_GRP}`,
    );
  }
  regions[key] = {
    name: NAME,
    population: Math.round(POP_EST),
    year: POP_YEAR,
    gdp: GDP_MD,
    wealth,
  };
}

const out = join(import.meta.dirname, '..', 'data');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, 'natural-earth.json'),
  `${JSON.stringify(
    {
      source: `Natural Earth ${VERSION}，1:1.1 亿 Admin 0 – Countries，字段 POP_EST、POP_YEAR、GDP_MD、INCOME_GRP（公有领域）`,
      url: `https://github.com/nvkelso/natural-earth-vector/blob/${VERSION}/geojson/ne_110m_admin_0_countries.geojson`,
      fields: {
        population: '人口估计数',
        year: '人口是哪一年的',
        gdp: '国内生产总值，百万美元',
        wealth: '富裕程度：世界银行的收入分组折成 0（低收入）到 3（高收入）',
      },
      regions,
    },
    null,
    2,
  )}\n`,
);
console.log(`Natural Earth：${Object.keys(regions).length} 个地区`);
