/**
 * 抉择表：隔一阵子某一方会碰上的、要它拿主意的事（规则见 sim 的 rules/decisions.ts）。
 * 每件事两个选项，各有得失；第一个是“照旧”的那个——到期没选就按它办。
 * 数值的单位：budget 是预算，points 是变异点，trust 是公众信任（0–1），research 是进行中的研究提前的比例，
 * modifiers 是持续 days 天的修正（发现率加多少、传播和收入的倍数加多少）。
 */
import type { DecisionDef } from '@miwang/sim';

export const DECISIONS: readonly DecisionDef[] = [
  // ───── 守方 ─────
  // 带条件的援助：钱马上到，公众不喜欢“外人说了算”
  {
    id: 'aidOffer',
    side: 'defender',
    weight: 3,
    days: 10,
    options: [{ id: 'decline' }, { id: 'accept', budget: 25, trust: -0.04 }],
  },
  // 开通咨询热线：花一点钱，公众安心一点（开局就可能碰上）
  {
    id: 'hotline',
    side: 'defender',
    weight: 2,
    days: 10,
    options: [{ id: 'skip' }, { id: 'open', budget: -5, trust: 0.03 }],
  },
  // 搞一次应对演练：花钱，之后一个月发现得多一点
  {
    id: 'drill',
    side: 'defender',
    weight: 2,
    days: 10,
    options: [{ id: 'skip' }, { id: 'run', budget: -6, modifiers: { detect: 0.04 }, days: 30 }],
  },
  // 公布全部数据：换来信任，市场慌一阵
  {
    id: 'dataRelease',
    side: 'defender',
    weight: 3,
    days: 8,
    when: 'spread',
    options: [
      { id: 'summary', trust: -0.03 },
      { id: 'full', trust: 0.06, modifiers: { income: -0.12 }, days: 30 },
    ],
  },
  // 试验里的不良反应：硬推伤信任，停下来复核要时间
  {
    id: 'trialReaction',
    side: 'defender',
    weight: 3,
    days: 7,
    when: 'research',
    options: [
      { id: 'proceed', trust: -0.06 },
      { id: 'pause', research: -0.25, trust: 0.03 },
    ],
  },
  // 实验室连轴转：花钱买时间
  {
    id: 'overtime',
    side: 'defender',
    weight: 3,
    days: 7,
    when: 'research',
    options: [{ id: 'steady' }, { id: 'push', budget: -10, research: 0.2 }],
  },
  // 长假：照常放假大家高兴、传播高一阵；劝阻出行相反
  {
    id: 'holiday',
    side: 'defender',
    weight: 2,
    days: 8,
    when: 'spread',
    options: [
      { id: 'allow', trust: 0.02, modifiers: { spread: 0.12 }, days: 21 },
      { id: 'cancel', trust: -0.05, modifiers: { spread: -0.06 }, days: 21 },
    ],
  },
  // 一批试剂不准：接着用就一直漏检，召回要花钱、中间有个短缺口
  {
    id: 'testKits',
    side: 'defender',
    weight: 2,
    days: 6,
    when: 'spread',
    options: [
      { id: 'keep', modifiers: { detect: -0.1 }, days: 30 },
      { id: 'recall', budget: -8, modifiers: { detect: -0.03 }, days: 10 },
    ],
  },

  // ───── 攻方 ─────
  // 传播的瓶颈：攒点数，还是押在一个更会传人的分支上
  {
    id: 'bottleneck',
    side: 'attacker',
    weight: 3,
    days: 10,
    options: [
      { id: 'bank', points: 4 },
      { id: 'adapt', points: -5, modifiers: { spread: 0.15 }, days: 30 },
    ],
  },
  // 新的宿主：攒点数，还是花点数换一段时间的传播（开局就可能碰上）
  {
    id: 'hostJump',
    side: 'attacker',
    weight: 2,
    days: 10,
    options: [
      { id: 'ignore', points: 2 },
      { id: 'explore', points: -3, modifiers: { spread: 0.1 }, days: 40 },
    ],
  },
  // 轻症的人照常上班：往这个方向偏，传得多一点、也更不显眼，要搭上一点积累
  {
    id: 'mildCases',
    side: 'attacker',
    weight: 2,
    days: 10,
    options: [
      { id: 'asIs' },
      { id: 'lean', points: -2, modifiers: { detect: -0.05, spread: 0.05 }, days: 20 },
    ],
  },
  // 动物里的落脚处：借机多变异，还是藏起来
  {
    id: 'reservoir',
    side: 'attacker',
    weight: 2,
    days: 10,
    when: 'spread',
    options: [
      { id: 'harvest', points: 7 },
      { id: 'hide', modifiers: { detect: -0.08 }, days: 45 },
    ],
  },
  // 超级传播：趁势而上传得快，也引来注意
  {
    id: 'superspreader',
    side: 'attacker',
    weight: 3,
    days: 6,
    when: 'spread',
    options: [
      { id: 'quiet', points: 2 },
      { id: 'seize', modifiers: { spread: 0.25, detect: 0.06 }, days: 12 },
    ],
  },
  // 两个变异株争上风：温和的不显眼，凶的让人害怕
  {
    id: 'variant',
    side: 'attacker',
    weight: 2,
    days: 10,
    when: 'spread',
    options: [
      { id: 'mild', modifiers: { detect: -0.06 }, days: 30 },
      { id: 'fierce', trust: -0.04, modifiers: { spread: 0.08 }, days: 30 },
    ],
  },
];
