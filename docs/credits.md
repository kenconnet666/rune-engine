# 数据来源与致谢

《迷惘》和 rune-engine 用到的别人的东西。游戏里的“关于与致谢”页列的是同一份（来自
`games/miwang/content/src/tables/credits.ts`；测试会核对这份文档没有漏项）。

这个项目自己是 MIT 协议（见 [LICENSE](../LICENSE)），是个人学习与娱乐项目，不用于商业发行。

## 数据

| 名字                                                                           | 许可          | 用来做什么                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Natural Earth](https://www.naturalearthdata.com/)                             | Public domain | 国家和地区的边界、人口、国内生产总值、收入分组（v5.1.2，1:1.1 亿）。取了哪些字段记在 `games/miwang/content/data/natural-earth.json` |
| [world-atlas](https://github.com/topojson/world-atlas)                         | ISC           | 把 Natural Earth 的边界整理成 TopoJSON 的那一份，地图的形状从它来                                                                   |
| [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) | MIT           | 国家和地区的中文名                                                                                                                  |

没有用的数据：真实的航线、航运数据。游戏里的航线和海运是按人口、经济、距离的引力模型估出来的
（OpenFlights 之类的数据带“相同方式共享”的条款，没有用）。

地图上的边界只是为了有一张能玩的世界地图，不代表对任何边界或地位的立场。

## 参考

| 名字                                                                     | 许可 | 用来做什么                                                   |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| [Okabe & Ito — Color Universal Design](https://jfly.uni-koeln.de/color/) | —    | 色觉友好配色里的橙、朱红、天蓝取自这组为色觉障碍者设计的颜色 |

### 传染病资料的出处

百科里关于各种传染病的事实来自下面这些公开页面，写进游戏之前逐条对照过原文（调研的全文在
[research/infectious-diseases.md](research/infectious-diseases.md)）。游戏里的数值是照着原型的“性格”定的游戏取值，
不是这些疾病的真实参数；这个游戏不是流行病学的模型，也不是医学建议。

- WHO fact sheet: Influenza (seasonal) — <https://www.who.int/news-room/fact-sheets/detail/influenza-(seasonal)>
- WHO fact sheet: Measles — <https://www.who.int/news-room/fact-sheets/detail/measles>
- WHO fact sheet: Cholera — <https://www.who.int/news-room/fact-sheets/detail/cholera>
- WHO fact sheet: Dengue — <https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue>
- WHO fact sheet: Malaria — <https://www.who.int/news-room/fact-sheets/detail/malaria>
- WHO fact sheet: Tuberculosis — <https://www.who.int/news-room/fact-sheets/detail/tuberculosis>
- CDC: About Norovirus — <https://www.cdc.gov/norovirus/about/index.html>
- WHO fact sheet: Ebola disease — <https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease>
- CDC: Clinical Overview of Pertussis — <https://www.cdc.gov/pertussis/hcp/clinical-overview/index.html>

## 用到的开源软件

跑在玩家浏览器里的：

| 名字                                                                                                          | 许可       | 用来做什么                                                     |
| ------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| [Vue](https://vuejs.org/)                                                                                     | MIT        | 界面的运行时                                                   |
| [vue-tsx-pro](https://github.com/kenconnet666/vue-tsx-pro)                                                    | MIT        | TSX 编译器和样式引擎；组件的写法和基础的手感也参考了它的组件库 |
| [Lucide](https://lucide.dev/)                                                                                 | ISC        | 界面上的图标（另有几个是这个项目自己画的）                     |
| [decimal.js](https://github.com/MikeMcl/decimal.js)                                                           | MIT        | 精确的十进制数，引擎内核原生支持                               |
| [@internationalized/date](https://github.com/adobe/react-spectrum/tree/main/packages/@internationalized/date) | Apache-2.0 | 不碰系统时区的日历日期                                         |

只在构建、测试、部署时用的：

| 名字                                                           | 许可              | 用来做什么                             |
| -------------------------------------------------------------- | ----------------- | -------------------------------------- |
| [topojson-client](https://github.com/topojson/topojson-client) | ISC               | 构建地图时解出各地区的多边形和相邻关系 |
| [earcut](https://github.com/mapbox/earcut)                     | ISC               | 构建地图时把多边形切成三角形           |
| [TypeScript](https://www.typescriptlang.org/)                  | Apache-2.0        | 写这个项目用的语言                     |
| [Vite](https://vite.dev/)                                      | MIT               | 开发服务器和打包                       |
| [Vitest](https://vitest.dev/)                                  | MIT               | 测试                                   |
| [Oxlint](https://oxc.rs/)                                      | MIT               | 代码检查                               |
| [Prettier](https://prettier.io/)                               | MIT               | 代码格式                               |
| [Wrangler](https://github.com/cloudflare/workers-sdk)          | MIT OR Apache-2.0 | 在本机模拟 Cloudflare、部署服务端      |

各个包确切的版本在 `pnpm-workspace.yaml` 的 catalog 里；许可证以各自的 `package.json` 为准。

## 这个项目自己做的

规则、数值、界面、地图的画法、五章的文字都是为这个项目写的。声音全部是运行时现场合成的，没有用任何录音素材。
字体用的是玩家系统自带的，没有打包任何字体文件。lucide 里没有的几个图标（蚊子、口罩、肺、停飞）是自己画的，
在 `packages/ui/src/icons.ts`。
