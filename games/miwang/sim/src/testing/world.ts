/**
 * 测试用的小世界：8 个地区排成一条链，气候、贫富、密度各不相同，两头有航线，沿海的几个有海运。
 * 性状、科技、事件各有几样，够把每条规则都走到。和 content 里真正的数据无关——那边调数值不会动到这里的测试。
 */
import {
  COLD,
  TEMPERATE,
  TROPICAL,
  type CalendarDef,
  type Climate,
  type DecisionDef,
  type DeploymentDef,
  type EventDef,
  type OutbreakConfig,
  type RegionConfig,
  type Rules,
  type SkillDef,
  type SynergyDef,
  type TaskDef,
  type TechDef,
  type TraitDef,
} from '../config.ts';
import { DEFAULT_RULES } from '../defaults.ts';

const CLIMATES: readonly Climate[] = [
  TROPICAL,
  TROPICAL,
  TEMPERATE,
  TEMPERATE,
  TEMPERATE,
  COLD,
  TEMPERATE,
  TROPICAL,
];

const COUNT = CLIMATES.length;

export const TEST_REGIONS: readonly RegionConfig[] = CLIMATES.map((climate, index) => ({
  population: 3_000_000 + index * 900_000,
  climate,
  wealth: index % 4,
  density: index % 3,
  economy: 1 / COUNT,
  south: index >= 6,
  neighbors: [index - 1, index + 1].filter((n) => n >= 0 && n < COUNT),
  // 两头互通航班；0、3、7 号是港口，互相有船
  air:
    index === 0
      ? { to: [COUNT - 1], weight: [0.6] }
      : index === COUNT - 1
        ? { to: [0], weight: [0.6] }
        : { to: [], weight: [] },
  sea: [0, 3, 7].includes(index)
    ? { to: [0, 3, 7].filter((port) => port !== index), weight: [0.3, 0.3] }
    : { to: [], weight: [] },
}));

export const TEST_TRAITS: readonly TraitDef[] = [
  { id: 'air1', group: 'route', cost: 6, requires: [], effects: { air: 0.08 } },
  {
    id: 'air2',
    group: 'route',
    cost: 10,
    requires: ['air1'],
    effects: { air: 0.1, aviation: 0.5 },
  },
  { id: 'water1', group: 'route', cost: 6, requires: [], effects: { water: 0.2 } },
  {
    id: 'fever',
    group: 'symptom',
    cost: 5,
    requires: [],
    effects: { severity: 1, lethality: 0.01 },
  },
  {
    id: 'failure',
    group: 'symptom',
    cost: 12,
    // 两条路任意一条走通就行
    requires: ['fever', 'water1'],
    effects: { severity: 3, lethality: 0.1 },
  },
  { id: 'stealth', group: 'ability', cost: 6, requires: [], effects: { stealth: 2 } },
  { id: 'drift', group: 'ability', cost: 8, requires: [], effects: { drift: 2 } },
];

/** 协同：飞沫的头一级加上发热，飞沫再强一点。测试配置默认不带（synergies 是空的），要测的自己传进去 */
export const TEST_SYNERGIES: readonly SynergyDef[] = [
  { id: 'feverCough', requires: ['air1', 'fever'], effects: { air: 0.05 } },
];

export const TEST_TECHS: readonly TechDef[] = [
  { id: 'identify', cost: 10, days: 10, requires: [], effects: { identify: 1 } },
  { id: 'tracing', cost: 10, days: 10, requires: [], effects: { isolation: 0.4 } },
  { id: 'origin', cost: 10, days: 10, requires: ['identify', 'tracing'], effects: { trace: 1 } },
  { id: 'vaccine1', cost: 10, days: 20, requires: ['identify'], effects: { vaccine: 1 } },
  { id: 'vaccine2', cost: 10, days: 20, requires: ['vaccine1'], effects: { vaccine: 1 } },
  { id: 'vaccine3', cost: 10, days: 20, requires: ['vaccine2'], effects: { vaccine: 1 } },
];

export const TEST_EVENTS: readonly EventDef[] = [
  { id: 'festival', kind: 'gathering', weight: 2, days: 10 },
  { id: 'flood', kind: 'disaster', weight: 1, days: 20 },
  { id: 'rumor', kind: 'rumor', weight: 1, amount: 0.05 },
  { id: 'breakthrough', kind: 'breakthrough', weight: 1, amount: 0.25 },
  { id: 'funding', kind: 'funding', weight: 1, amount: 10 },
  { id: 'mutation', kind: 'mutation', weight: 1, amount: 3 },
];

export const TEST_SKILLS: readonly SkillDef[] = [
  { id: 'spillover', kind: 'spillover', cost: 8, cooldown: 30, amount: 20 },
  { id: 'surge', kind: 'surge', cost: 5, cooldown: 20, days: 10 },
  {
    id: 'veil',
    kind: 'veil',
    cost: 6,
    cooldown: 40,
    days: 15,
    modifiers: { detect: -0.2, spread: -0.1 },
  },
  { id: 'shift', kind: 'shift', cost: 10, cooldown: 60, amount: 0.5 },
];

/** 日程：测试配置默认不带（calendar 是空的）；要测的自己传进去。日子是按开局那天（11 月 13 日，第 316 天）排的 */
export const TEST_CALENDAR: readonly CalendarDef[] = [
  { id: 'rush', kind: 'travel', day: 326, days: 10, notice: 5, amount: 1 },
  { id: 'wet', kind: 'rains', day: 320, days: 20, notice: 3, amount: 0.5 },
  { id: 'cup', kind: 'games', day: 330, days: 8, notice: 10, amount: 0.5 },
];

export const TEST_DEPLOYMENTS: readonly DeploymentDef[] = [
  { id: 'ward', kind: 'relief', cost: 8, cooldown: 20, days: 30 },
  { id: 'supplies', kind: 'aid', cost: 6, cooldown: 20, days: 60 },
];

export const TEST_DECISIONS: readonly DecisionDef[] = [
  {
    id: 'aid',
    side: 'defender',
    weight: 1,
    days: 5,
    options: [{ id: 'decline' }, { id: 'accept', budget: 25, trust: -0.03 }],
  },
  {
    id: 'overtime',
    side: 'defender',
    weight: 1,
    days: 5,
    when: 'research',
    options: [{ id: 'steady' }, { id: 'push', budget: -5, research: 0.5 }],
  },
  {
    id: 'variant',
    side: 'attacker',
    weight: 1,
    days: 5,
    options: [
      { id: 'bank', points: 3 },
      { id: 'adapt', points: -2, modifiers: { spread: 0.2 }, days: 10 },
    ],
  },
  // 危机（默认不出：测试配置里 crisisGap 是负数）
  {
    id: 'weary',
    side: 'defender',
    weight: 0,
    days: 5,
    crisis: 'fatigue',
    options: [
      { id: 'hold', unrest: 20, trust: -0.04 },
      { id: 'ease', relax: 1, trust: 0.02 },
    ],
  },
  {
    id: 'swamped',
    side: 'defender',
    weight: 0,
    days: 5,
    crisis: 'overload',
    options: [{ id: 'cope' }, { id: 'ward', budget: -8, relief: 30 }],
  },
  {
    id: 'smuggle',
    side: 'attacker',
    weight: 0,
    days: 5,
    crisis: 'sealed',
    options: [{ id: 'wait' }, { id: 'routes', points: -2, leak: 30 }],
  },
  {
    id: 'reluctant',
    side: 'defender',
    weight: 0,
    days: 5,
    crisis: 'hesitancy',
    options: [
      { id: 'ignore', modifiers: { rollout: -0.3 }, days: 30 },
      { id: 'mandate', trust: -0.05, modifiers: { rollout: 0.25 }, days: 30 },
    ],
  },
  {
    id: 'named',
    side: 'attacker',
    weight: 0,
    days: 5,
    crisis: 'identified',
    options: [
      { id: 'steady', points: 2 },
      { id: 'hide', modifiers: { detect: -0.05 }, days: 20 },
    ],
  },
];

export const TEST_TASKS: readonly TaskDef[] = [
  {
    id: 'reach',
    side: 'attacker',
    weight: 1,
    days: 20,
    metric: 'regions',
    mode: 'gain',
    target: 1,
    reward: { points: 5 },
  },
  {
    id: 'steady',
    side: 'defender',
    weight: 1,
    days: 10,
    metric: 'trust',
    mode: 'hold',
    target: 0.5,
    from: 0.55,
    reward: { budget: 10 },
  },
  {
    id: 'labwork',
    side: 'defender',
    weight: 1,
    days: 15,
    metric: 'techs',
    mode: 'gain',
    target: 1,
    reward: { budget: 12, trust: 0.02 },
  },
];

/**
 * 建一份测试配置；rules 里写要改的项，其余用默认值。
 * 抉择、危机和短期任务默认不出（decisionChance 是 0、crisisGap 和 taskGap 是负数）：它们会动预算、信任、变异点这些数，
 * 别的规则的测试不想被搅进来；要测它们的自己打开。同样，默认一例就认得出这种病（recognize 都是 1）、
 * 开局十二个病例（之后源头不再送）、六个变异点、每天不白给点数：这里的测试核对的是各条规则本身，不跟着正式的数值变。
 */
export function testConfig(
  rules: Partial<Rules> = {},
  overrides: Partial<OutbreakConfig> = {},
): OutbreakConfig {
  return {
    seed: 20261113,
    startDate: '2026-11-13',
    origin: 0,
    regions: TEST_REGIONS,
    pathogen: {
      id: 'test',
      base: { air: 0.24, contact: 0.08, severity: 1, lethality: 0.01 },
      incubationDays: 4,
      infectiousDays: 7,
      climate: [0.9, 1, 0.8],
    },
    traits: TEST_TRAITS,
    synergies: [],
    techs: TEST_TECHS,
    events: TEST_EVENTS,
    calendar: [],
    skills: TEST_SKILLS,
    deployments: TEST_DEPLOYMENTS,
    decisions: TEST_DECISIONS,
    tasks: TEST_TASKS,
    rules: {
      ...DEFAULT_RULES,
      decisionChance: 0,
      crisisGap: -1,
      taskGap: -1,
      recognizeFirst: 1,
      recognizeLater: 1,
      seedCases: 12,
      seedDays: 0,
      startPoints: 6,
      pointsPerDay: 0,
      startBudget: 20,
      decisionGap: 0,
      ...rules,
    },
    ...overrides,
  };
}
