/**
 * 章节里的教学提示：打到某个时候，给玩家讲一句眼下用得上的话（“变异点够了，打开进化”）。
 * 每句话有它出现的条件（看的是这一方自己看得到的状态）、属于哪几章、讲给哪一方听；
 * 一局里每句只出现一次，一次只给一句，玩家点“知道了”才给下一句。话本身在界面的文案里（text/）。
 * 普通对局没有提示。
 */
import type { ChapterId } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { shallowRef, watchEffect, type ShallowRef } from 'vue';

export const HINT_IDS = [
  'goal',
  'time',
  'map',
  'latency',
  'spread',
  'countered',
  'firstReport',
  'budget',
  'points',
  'tradeoff',
  'research',
  'identified',
  'terrain',
  'borders',
  'trust',
  'defended',
  'economy',
  'routes',
  'vaccine',
  'calamity',
  'levels',
  'team',
  'skills',
  'decision',
  'task',
] as const;
export type HintId = (typeof HINT_IDS)[number];

interface HintDef {
  readonly id: HintId;
  /** 哪几章会讲；'all' 是每一章 */
  readonly chapters: readonly ChapterId[] | 'all';
  readonly side: 'attacker' | 'defender' | 'both';
  /** 什么时候该讲了 */
  readonly when: (view: OutbreakView) => boolean;
}

const anyMeasure = (view: OutbreakView) => view.measures.some((bits) => bits !== 0);
/** 头两章只学最基本的；应急队、分档、技能、抉择、短期任务从第三章起才讲 */
const LATER: readonly ChapterId[] = ['wilds', 'hills', 'sky'];

/** 排在前面的先讲 */
const HINTS: readonly HintDef[] = [
  // ───── 每一章开头：目标在哪里看 ─────
  { id: 'goal', chapters: 'all', side: 'both', when: () => true },

  // ───── 迷惘：地图、时间、潜伏与发现 ─────
  { id: 'time', chapters: ['bewilderment'], side: 'both', when: () => true },
  { id: 'map', chapters: ['bewilderment'], side: 'both', when: (view) => view.tick >= 2 },
  {
    id: 'latency',
    chapters: ['bewilderment'],
    side: 'attacker',
    when: (view) => view.tick >= 8,
  },
  {
    id: 'spread',
    chapters: ['bewilderment', 'wilds'],
    side: 'attacker',
    when: (view) => view.totals.regions >= 2,
  },
  { id: 'countered', chapters: ['bewilderment'], side: 'attacker', when: anyMeasure },
  {
    id: 'firstReport',
    chapters: ['bewilderment'],
    side: 'defender',
    when: (view) => view.totals.regions >= 1,
  },
  {
    id: 'budget',
    chapters: 'all',
    side: 'defender',
    when: (view) => view.tick > 10 && view.resource < 5,
  },

  // ───── 邪念：变异点与性状；病原鉴定 ─────
  {
    id: 'points',
    chapters: ['bewilderment', 'malice'],
    side: 'attacker',
    when: (view) => view.pathogen.offers.some((offer) => offer.cost <= view.resource),
  },
  {
    id: 'tradeoff',
    chapters: ['malice'],
    side: 'attacker',
    when: (view) => view.pathogen.owned.length >= 2,
  },
  {
    id: 'research',
    chapters: ['malice'],
    side: 'defender',
    when: (view) => view.defense.offers.length > 0,
  },
  {
    id: 'identified',
    chapters: ['malice'],
    side: 'defender',
    when: (view) => view.pathogen.known,
  },

  // ───── 旷野：地区的条件、陆路、口岸 ─────
  { id: 'terrain', chapters: ['wilds'], side: 'both', when: (view) => view.tick >= 3 },
  {
    id: 'borders',
    chapters: ['wilds'],
    side: 'defender',
    when: (view) => view.totals.regions >= 2,
  },
  {
    id: 'trust',
    chapters: ['wilds', 'hills', 'sky'],
    side: 'defender',
    when: (view) => view.defense.trust < 0.7,
  },

  // ───── 山丘：富裕地区的防线、封锁的代价 ─────
  { id: 'defended', chapters: ['hills'], side: 'attacker', when: (view) => view.tick >= 3 },
  {
    id: 'economy',
    chapters: ['hills', 'sky'],
    side: 'defender',
    when: (view) => view.defense.economyLost > 20,
  },

  // ───── 长空：航线与海运、疫苗、灾厄线 ─────
  { id: 'routes', chapters: ['sky'], side: 'both', when: (view) => view.tick >= 3 },
  {
    id: 'vaccine',
    chapters: ['sky'],
    side: 'defender',
    when: (view) => view.defense.done.includes('identify'),
  },
  { id: 'calamity', chapters: ['sky'], side: 'both', when: (view) => view.calamity > 0.3 },

  // ───── 后三章里用得上的操作：碰上了再讲 ─────
  {
    id: 'team',
    chapters: LATER,
    side: 'defender',
    when: (view) => view.totals.regions >= 1 && view.defense.teams.every((team) => team.region < 0),
  },
  {
    id: 'levels',
    chapters: LATER,
    side: 'defender',
    when: (view) => view.defense.upkeep > view.defense.income * 0.8,
  },
  {
    id: 'skills',
    chapters: LATER,
    side: 'attacker',
    when: (view) =>
      view.pathogen.skills.some((skill) => skill.readyIn === 0 && skill.cost <= view.resource),
  },
  { id: 'decision', chapters: LATER, side: 'both', when: (view) => view.decision !== null },
  { id: 'task', chapters: LATER, side: 'both', when: (view) => view.task !== null },
];

export interface Hints {
  /** 现在该给玩家看的那一句；没有是 null */
  readonly current: ShallowRef<HintId | null>;
  /** 玩家看过了眼下这一句（写成函数类型的属性：可以直接当回调传） */
  readonly dismiss: () => void;
}

/** 盯着这一方的状态，到了该讲的时候把那一句放到 current 里。要在组件的 setup 里调（它用了 watchEffect） */
export function watchHints(view: () => OutbreakView | null): Hints {
  const current = shallowRef<HintId | null>(null);
  let seen = new Set<HintId>();
  /** 上次看到的是第几天：倒回去了说明换了一局 */
  let lastTick = -1;
  /** 这一局刚接上时是不是已经打了一阵（读档、刷新页面） */
  let resumed = false;

  function update() {
    const now = view();
    const chapter = now?.scenario?.id as ChapterId | undefined;
    if (!now || !chapter || now.outcome) {
      current.value = null;
      return;
    }
    if (now.tick < lastTick || lastTick < 0) {
      seen = new Set();
      resumed = now.tick > 1;
    }
    lastTick = now.tick;
    const due = HINTS.filter(
      (hint) =>
        !seen.has(hint.id) &&
        (hint.chapters === 'all' || hint.chapters.includes(chapter)) &&
        (hint.side === 'both' || (hint.side === 'attacker') === now.attacker) &&
        hint.when(now),
    );
    // 接着一局打：之前就该讲过的不再一句句翻出来
    if (resumed) {
      for (const hint of due) seen.add(hint.id);
      resumed = false;
      current.value = null;
      return;
    }
    // 眼下这一句还没点掉就不换
    if (current.value && !seen.has(current.value)) return;
    current.value = due[0]?.id ?? null;
  }
  watchEffect(update);

  return {
    current,
    dismiss() {
      if (current.value) seen.add(current.value);
      update();
    },
  };
}
