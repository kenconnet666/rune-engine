/**
 * 抉择表：隔一阵子某一方会碰上的、要它拿主意的事（规则见 sim 的 rules/decisions.ts）。
 * 每件事两三个选项，各有得失；第一个是“照旧”的那个——到期没选就按它办。
 * 数值的单位：budget 是预算，points 是变异点，trust 是公众信任（0–1），research 是进行中的研究提前的比例，
 * modifiers 是持续 days 天的修正（发现率加多少、传播和收入的倍数加多少）。
 *
 * 带 crisis 的是“危机”：不靠运气，局面到了那一步才出（规则见 sim 的 rules/crises.ts）；一方同时成立好几件时
 * 表里靠前的先出。冲着某个地区来的危机，选项可以带落在那个地区的效果：unrest 闹事几天、relax 封锁降几档、
 * relief 医疗支援几天、leak 口子漏风几天。
 */
import type { DecisionDef } from '@miwang/sim';

export const DECISIONS: readonly DecisionDef[] = [
  // ───── 守方的危机 ─────
  // 医院挤满了：让当地自己扛，信任掉；建临时病房花钱，那里一个月里救得回来的多；
  // 从别处抽调人手不花钱，但别处的产出少一截
  {
    id: 'hospitalOverload',
    side: 'defender',
    weight: 0,
    days: 5,
    crisis: 'overload',
    options: [
      { id: 'cope', trust: -0.04 },
      { id: 'fieldHospital', budget: -14, relief: 30 },
      { id: 'transfer', relief: 20, modifiers: { income: -0.08 }, days: 20 },
    ],
  },
  // 封得太久：不让步，那里闹起来、措施打折；放松一档，大家松口气；发补贴，花钱买平静
  {
    id: 'lockdownFatigue',
    side: 'defender',
    weight: 0,
    days: 7,
    crisis: 'fatigue',
    options: [
      { id: 'hold', unrest: 25, trust: -0.03 },
      { id: 'ease', relax: 1, trust: 0.02 },
      { id: 'subsidy', budget: -12 },
    ],
  },
  // 疫苗开打了，不少人不肯打：随他们去就慢三成；请人出面要花钱；强制接种快，但伤信任
  {
    id: 'vaccineHesitancy',
    side: 'defender',
    weight: 0,
    days: 7,
    crisis: 'hesitancy',
    options: [
      { id: 'ignore', modifiers: { rollout: -0.3 }, days: 45 },
      { id: 'campaign', budget: -10, trust: 0.04 },
      { id: 'mandate', trust: -0.06, modifiers: { rollout: 0.25 }, days: 45 },
    ],
  },

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

  // ───── 攻方的危机 ─────
  // 守方认出它了（一局一次）：照旧，压力之下多攒一点；收敛一阵更难发现；趁检测还没铺开抢着传
  {
    id: 'identified',
    side: 'attacker',
    weight: 0,
    days: 7,
    crisis: 'identified',
    options: [
      { id: 'steady', points: 3 },
      { id: 'lowProfile', modifiers: { detect: -0.08, spread: -0.05 }, days: 30 },
      { id: 'rush', modifiers: { spread: 0.12, detect: 0.05 }, days: 20 },
    ],
  },
  // 一个地区的口子关得太久，开始有人走小路：花点数顺着出去，那里的口子一个月里拦不住多少
  {
    id: 'smuggling',
    side: 'attacker',
    weight: 0,
    days: 7,
    crisis: 'sealed',
    options: [
      { id: 'wait', points: 2 },
      { id: 'routes', points: -3, leak: 30 },
    ],
  },

  // ───── 各种病原体自己的事：只在那种病原体的局里出 ─────
  // 流感：两株在同一个宿主里相遇，可以重配
  {
    id: 'reassortment',
    side: 'attacker',
    pathogen: 'influenza',
    weight: 4,
    days: 8,
    when: 'spread',
    options: [
      { id: 'pass', points: 2 },
      { id: 'reassort', points: -4, modifiers: { spread: 0.12, detect: 0.03 }, days: 40 },
    ],
  },
  // 麻疹：补种一次，挡住一大片
  {
    id: 'catchUpCampaign',
    side: 'defender',
    pathogen: 'measles',
    weight: 4,
    days: 8,
    when: 'spread',
    options: [
      { id: 'skip' },
      { id: 'campaign', budget: -12, trust: 0.02, modifiers: { spread: -0.1 }, days: 45 },
    ],
  },
  // 霍乱：大水漫过了水厂
  {
    id: 'floodedWorks',
    side: 'attacker',
    pathogen: 'cholera',
    weight: 4,
    days: 8,
    options: [
      { id: 'pass', points: 3 },
      { id: 'seize', modifiers: { spread: 0.25 }, days: 30 },
    ],
  },
  // 登革热：发动居民清积水
  {
    id: 'breedingSites',
    side: 'defender',
    pathogen: 'dengue',
    weight: 4,
    days: 8,
    when: 'spread',
    options: [
      { id: 'skip' },
      { id: 'cleanup', budget: -8, modifiers: { spread: -0.08 }, days: 40 },
    ],
  },
  // 疟疾：发浸过药的蚊帐
  {
    id: 'bedNets',
    side: 'defender',
    pathogen: 'malaria',
    weight: 4,
    days: 8,
    when: 'spread',
    options: [
      { id: 'skip' },
      { id: 'distribute', budget: -10, modifiers: { spread: -0.1 }, days: 60 },
    ],
  },
  // 结核：上门看着病人服药，费人费钱，但见效
  {
    id: 'supervisedTherapy',
    side: 'defender',
    pathogen: 'tuberculosis',
    weight: 4,
    days: 8,
    options: [
      { id: 'skip' },
      { id: 'supervise', budget: -14, modifiers: { spread: -0.15, detect: 0.06 }, days: 90 },
    ],
  },
  // 诺如：一艘邮轮
  {
    id: 'cruiseShip',
    side: 'attacker',
    pathogen: 'norovirus',
    weight: 4,
    days: 8,
    options: [{ id: 'pass' }, { id: 'board', points: -2, modifiers: { spread: 0.2 }, days: 25 }],
  },
  // 埃博拉：强制安全下葬，堵住葬礼上的传播，但违背习俗
  {
    id: 'safeBurials',
    side: 'defender',
    pathogen: 'ebola',
    weight: 4,
    days: 8,
    options: [
      { id: 'custom', trust: 0.02 },
      { id: 'enforce', trust: -0.04, modifiers: { spread: -0.15 }, days: 60 },
    ],
  },
  // 百日咳：给孕妇接种，抗体带给新生儿
  {
    id: 'maternalShots',
    side: 'defender',
    pathogen: 'pertussis',
    weight: 4,
    days: 8,
    options: [{ id: 'skip' }, { id: 'offer', budget: -10, modifiers: { spread: -0.12 }, days: 90 }],
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
