/**
 * 致谢表：这个游戏用到的别人的东西——数据、参考资料、开源软件——各是什么、什么许可、在哪里。
 * 游戏里的“关于”页和 docs/credits.md 都照这张表写（text.test.ts 核对文档没有漏项）。
 * 每一项在游戏里“用来做什么”的说明在 text/ 里（按 id 取）。传染病资料的出处另见 pathogens.ts 的 SOURCES。
 *
 * 加了新的依赖、新的数据源，记得在这里添一行；许可证以那个包自己的 package.json、那份数据自己的说明为准。
 */

export interface Credit {
  readonly id: string;
  readonly name: string;
  /** 许可证（SPDX 的写法；公有领域写 Public domain） */
  readonly license: string;
  readonly url: string;
}

/** 数据：地图、人口、地名 */
const DATA = [
  {
    id: 'naturalEarth',
    name: 'Natural Earth',
    license: 'Public domain',
    url: 'https://www.naturalearthdata.com/',
  },
  {
    id: 'worldAtlas',
    name: 'world-atlas',
    license: 'ISC',
    url: 'https://github.com/topojson/world-atlas',
  },
  {
    id: 'isoCountries',
    name: 'i18n-iso-countries',
    license: 'MIT',
    url: 'https://github.com/michaelwittig/node-i18n-iso-countries',
  },
] as const satisfies readonly Credit[];

/** 参考：不是拿来用的素材，是照着做的依据 */
const REFERENCES = [
  {
    id: 'okabeIto',
    name: 'Okabe & Ito — Color Universal Design',
    license: '—',
    url: 'https://jfly.uni-koeln.de/color/',
  },
] as const satisfies readonly Credit[];

/** 跑在玩家浏览器里的开源软件 */
const RUNTIME = [
  { id: 'vue', name: 'Vue', license: 'MIT', url: 'https://vuejs.org/' },
  {
    id: 'vueTsxPro',
    name: 'vue-tsx-pro',
    license: 'MIT',
    url: 'https://github.com/kenconnet666/vue-tsx-pro',
  },
  { id: 'lucide', name: 'Lucide', license: 'ISC', url: 'https://lucide.dev/' },
  {
    id: 'decimal',
    name: 'decimal.js',
    license: 'MIT',
    url: 'https://github.com/MikeMcl/decimal.js',
  },
  {
    id: 'internationalizedDate',
    name: '@internationalized/date',
    license: 'Apache-2.0',
    url: 'https://github.com/adobe/react-spectrum/tree/main/packages/@internationalized/date',
  },
] as const satisfies readonly Credit[];

/** 只在构建、测试、部署时用的开源软件 */
const TOOLS = [
  {
    id: 'topojson',
    name: 'topojson-client',
    license: 'ISC',
    url: 'https://github.com/topojson/topojson-client',
  },
  { id: 'earcut', name: 'earcut', license: 'ISC', url: 'https://github.com/mapbox/earcut' },
  {
    id: 'typescript',
    name: 'TypeScript',
    license: 'Apache-2.0',
    url: 'https://www.typescriptlang.org/',
  },
  { id: 'vite', name: 'Vite', license: 'MIT', url: 'https://vite.dev/' },
  { id: 'vitest', name: 'Vitest', license: 'MIT', url: 'https://vitest.dev/' },
  { id: 'oxlint', name: 'Oxlint', license: 'MIT', url: 'https://oxc.rs/' },
  { id: 'prettier', name: 'Prettier', license: 'MIT', url: 'https://prettier.io/' },
  {
    id: 'wrangler',
    name: 'Wrangler',
    license: 'MIT OR Apache-2.0',
    url: 'https://github.com/cloudflare/workers-sdk',
  },
] as const satisfies readonly Credit[];

export const CREDITS = {
  data: DATA,
  references: REFERENCES,
  runtime: RUNTIME,
  tools: TOOLS,
} as const;

export type CreditSection = keyof typeof CREDITS;
export type CreditId = (typeof CREDITS)[CreditSection][number]['id'];
