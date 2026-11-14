/**
 * 病原体档案：一种病原体开局时的底子。除了“新发病原体”（各项居中，没有原型），其余九个各以一种常见传染病为原型。
 *
 * **档案里的数是游戏里的取值，不是这种病的真实参数。** 它们照着原型的“性格”定——靠什么传、发病快慢、
 * 重不重、哪里多发——但为了一局能在一两年里打完、两边都有得打，幅度都压过：比如麻疹真实的传染力是流感的十倍，
 * 在这里只高出两三成（算上出疹前的传染）。数是用 scripts/balance.ts 让电脑对打调出来的：
 * 同难度下各个档案的攻方胜率大致在四成到六成半之间（2026-11-14 重新调过）。每个档案上面的注释是定这些数时参照的事实，出处见 SOURCES；百科里给玩家看的文字在 text/ 里。
 * 事实都对照原文核过（2026-11-13），调研的全文在 docs/research/infectious-diseases.md。
 */
import type { PathogenProfile } from '@miwang/sim';

export interface Source {
  readonly title: string;
  readonly url: string;
}

const who = (title: string, slug: string): Source => ({
  title: `WHO fact sheet: ${title}`,
  url: `https://www.who.int/news-room/fact-sheets/detail/${slug}`,
});

export const PATHOGENS: readonly PathogenProfile[] = [
  {
    id: 'novel',
    // 一个发病者一天传给 0.26 个人、病程 7 天：没有任何措施时一个人平均传给不到两个人
    base: { air: 0.2, contact: 0.06, severity: 1, lethality: 0.004 },
    incubationDays: 4,
    infectiousDays: 7,
    climate: [0.85, 1, 0.9],
  },
  {
    // 飞沫传播；潜伏期约 2 天（1–4 天）；温带冬季流行、热带全年都有；免疫会消退，疫苗要每年打（WHO）
    id: 'influenza',
    base: {
      air: 0.2,
      contact: 0.04,
      severity: 1.5,
      lethality: 0.002,
      drift: 1,
      presymptomatic: 0.15,
    },
    incubationDays: 2,
    infectiousDays: 6,
    climate: [0.8, 1, 1],
    // 变得快是它的本事：能力便宜
    costScale: { ability: 0.8 },
  },
  {
    // 空气传播，病毒在空气里能活两小时；暴露后 7–14 天发病；出疹前 4 天到出疹后 4 天有传染性；
    // 一个病例最多能传给 18 个人（WHO）——已知传染力最强的病之一
    id: 'measles',
    base: { air: 0.17, severity: 2.5, lethality: 0.002, presymptomatic: 0.25 },
    incubationDays: 10,
    infectiousDays: 8,
    climate: [1, 1, 1],
    // 传播已经到顶了，再往上加很贵
    costScale: { route: 1.4 },
  },
  {
    // 吃下被污染的水和食物；12 小时到 5 天发病；多数感染者没有症状但照样排菌 1–10 天；
    // 不治可以在几小时内致命，治疗中心里病死率应当低于 1%（WHO）——所以它的致死性高，但医疗一到位就压得很低
    id: 'cholera',
    base: { water: 0.52, contact: 0.03, severity: 2.5, lethality: 0.06, stealth: 1.5 },
    incubationDays: 2,
    infectiousDays: 5,
    climate: [1, 0.8, 0.5],
  },
  {
    // 伊蚊传播；感染后 4–10 天发病，持续 2–7 天；多数人症状很轻或没有，没有症状的人也能让蚊子带毒；
    // 热带、亚热带的城市里多（WHO）
    id: 'dengue',
    base: { vector: 0.27, severity: 1.5, lethality: 0.004, stealth: 1.5, presymptomatic: 0.15 },
    incubationDays: 6,
    infectiousDays: 5,
    climate: [1, 0.7, 0.2],
  },
  {
    // 按蚊传播，不会人传人，输血和针头也能传；被叮后 10–15 天发病；
    // 不治的恶性疟 24 小时内就能发展成重症；病例和死亡的 95% 在非洲（WHO）
    id: 'malaria',
    base: { vector: 0.19, blood: 0.01, severity: 2, lethality: 0.008, resistance: 0.2 },
    incubationDays: 12,
    infectiousDays: 14,
    climate: [1, 0.5, 0.1],
  },
  {
    // 空气传播；感染的人里只有 5–10% 最终发病，没发病的不传染；治疗要每天服药 4–6 个月（WHO）——
    // 一种慢病：传得慢、拖得久、难发现。游戏里把它的潜伏和病程都拉得很长
    id: 'tuberculosis',
    base: { air: 0.06, severity: 1, lethality: 0.1, stealth: 2, resistance: 0.3 },
    incubationDays: 20,
    infectiousDays: 60,
    climate: [1, 1, 1],
    // 慢性病不靠急症状取胜：症状贵，能力便宜
    costScale: { symptom: 1.3, ability: 0.85 },
    // 一个病人要传两个月：性状给的传播强度按三成算，不然换一个“飞沫传播”就顶别的病换一整条线
    routeScale: 0.3,
  },
  {
    // 接触病人、污染的食物和水、污染的表面；12–48 小时发病，1–3 天好转，好了之后还能传两周以上；
    // 型别很多，一辈子可以得很多次（CDC）
    id: 'norovirus',
    base: { contact: 0.2, water: 0.18, severity: 1.5, lethality: 0.0012, drift: 1 },
    incubationDays: 1,
    infectiousDays: 5,
    climate: [0.9, 1, 1],
  },
  {
    // 接触病人或死者的血液、体液，葬礼也会传；果蝠是自然宿主；潜伏期 2–21 天，出现症状之前不传染；
    // 病死率平均约 50%，历次暴发在 25–90% 之间（WHO）——致命，但病人走不远、很难不被发现
    id: 'ebola',
    base: { blood: 0.16, contact: 0.08, animal: 1, severity: 6, lethality: 0.5 },
    incubationDays: 9,
    infectiousDays: 9,
    climate: [1, 0.8, 0.6],
    // 已经够致命了：再加症状贵，学会隐蔽也贵
    costScale: { symptom: 1.3, ability: 1.2 },
  },
  {
    // 飞沫传播，只在人之间传；通常 5–10 天发病，最长 21 天；得过之后的免疫能管 4–20 年，不是终身（CDC）
    id: 'pertussis',
    base: { air: 0.11, severity: 1.5, lethality: 0.003, stealth: 1, drift: 0.5 },
    incubationDays: 8,
    infectiousDays: 18,
    climate: [1, 1, 1],
    // 病程两周半：性状给的传播强度按四成算
    routeScale: 0.4,
  },
];

export const DEFAULT_PATHOGEN = PATHOGENS[0]!;

/** 各个档案参照的资料；“新发病原体”没有原型，所以没有 */
export const SOURCES: Readonly<Record<string, readonly Source[]>> = {
  influenza: [who('Influenza (seasonal)', 'influenza-(seasonal)')],
  measles: [who('Measles', 'measles')],
  cholera: [who('Cholera', 'cholera')],
  dengue: [who('Dengue', 'dengue-and-severe-dengue')],
  malaria: [who('Malaria', 'malaria')],
  tuberculosis: [who('Tuberculosis', 'tuberculosis')],
  norovirus: [
    { title: 'CDC: About Norovirus', url: 'https://www.cdc.gov/norovirus/about/index.html' },
  ],
  ebola: [who('Ebola disease', 'ebola-virus-disease')],
  pertussis: [
    {
      title: 'CDC: Clinical Overview of Pertussis',
      url: 'https://www.cdc.gov/pertussis/hcp/clinical-overview/index.html',
    },
  ],
};
