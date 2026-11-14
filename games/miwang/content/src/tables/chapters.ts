/**
 * 五章：诗的五句各是一个剧本——限定了条件和目标的一局，也是教学的顺序（设计见 docs/design.md 的“章节”）。
 *
 * 每章都可以扮演任意一方：攻方要在期限内做到这一章的目标，守方要拦到期限。一章定的是——
 *   用哪种病原体、从什么样的地方起源、规则的数值改哪几项（比如第三章关掉航线和海运，只剩陆路）、
 *   目标和期限（模拟按它们分胜负，见 sim 的 Scenario）。
 * 章节的名字、讲给玩家的话在 text/ 里；什么时候给哪句提示在客户端（提示看的是界面上的状态）。
 *
 * 目标的数是用 scripts/balance.ts 让电脑对打定的（CHAPTER=<id>）：同难度对打攻方大约赢一半，
 * 电脑放水（简单）时玩家这一方明显占优——章节是用来学的，不是用来卡人的。
 * 起源地不写死在某个国家：按种子在符合这一章条件的地区里挑，和普通对局一样。
 */
import type { Goal, Rules } from '@miwang/sim';
import type { WorldRegion } from '../world.ts';

export interface ChapterDef {
  readonly id: ChapterId;
  /** 病原体档案的 id */
  readonly pathogen: string;
  /** 什么样的地区可以当这一章的起源地（另外还要人口够多） */
  readonly origin: (region: WorldRegion) => boolean;
  /** 这一章对规则数值的改动 */
  readonly rules: Partial<Rules>;
  /** 攻方要在期限内全做到的事；一件都不列就是按普通对局的灾厄线分胜负 */
  readonly goals: readonly Goal[];
  /** 期限（天） */
  readonly days: number;
}

export const CHAPTER_IDS = ['bewilderment', 'malice', 'wilds', 'hills', 'sky'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

/** 只走陆路：航线和海运不带病 */
const LAND_ONLY = { airRate: 0, seaRate: 0 } as const;
/**
 * 头两章是学基本操作的：不出要拿主意的事、不发短期任务，也没有应急队——
 * 免得分心；而且疫情还只有一两个地区的时候，一支应急队驻上去就能把它按住，攻方学不到东西
 */
const CALM = { ...LAND_ONLY, decisionChance: 0, crisisGap: -1, taskGap: -1, teams: 0 } as const;

export const CHAPTERS: readonly ChapterDef[] = [
  // 不盈一握之迷惘——起源：几个病例，在被拦住之前扎下根。只有陆路，地图上看得清它怎么一点点漫开
  {
    id: 'bewilderment',
    pathogen: 'novel',
    origin: (region) => region.neighbors.length >= 3,
    rules: CALM,
    goals: [{ metric: 'infected', target: 1_300 }],
    days: 150,
  },
  // 由此孕育出邪念——变异：攒变异点、换性状，让它成为更难对付的东西
  {
    id: 'malice',
    pathogen: 'novel',
    origin: (region) => region.neighbors.length >= 3,
    rules: CALM,
    goals: [
      { metric: 'traits', target: 4 },
      { metric: 'infected', target: 3_000 },
    ],
    days: 240,
  },
  // 爬过旷野——陆路扩散：从一个邻国很多的地方出发，一个地区接一个地区地走
  {
    id: 'wilds',
    pathogen: 'influenza',
    origin: (region) => region.neighbors.length >= 5,
    rules: LAND_ONLY,
    goals: [{ metric: 'regions', target: 12 }],
    days: 300,
  },
  // 翻越山丘——越过防线：从穷的地方起源，闯进医疗和监测都强的富裕地区
  {
    id: 'hills',
    pathogen: 'novel',
    origin: (region) => region.wealth <= 1 && region.neighbors.length >= 3,
    rules: {},
    goals: [{ metric: 'wealthy', target: 28 }],
    days: 200,
  },
  // 播撒灾厄于长空——航线与海运、全球的终局：完整的一局，按灾厄线分胜负
  {
    id: 'sky',
    pathogen: 'influenza',
    origin: () => true,
    rules: {},
    goals: [],
    days: 1460,
  },
];
