/**
 * 测试用的小世界：8 个地区排成一条链，气候、贫富、密度各不相同，两头有航线，沿海的几个有海运。
 * 性状、科技、事件各有几样，够把每条规则都走到。和 content 里真正的数据无关——那边调数值不会动到这里的测试。
 */
import {
  COLD,
  TEMPERATE,
  TROPICAL,
  type Climate,
  type DecisionDef,
  type EventDef,
  type OutbreakConfig,
  type RegionConfig,
  type Rules,
  type SkillDef,
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
];

/**
 * 建一份测试配置；rules 里写要改的项，其余用默认值。
 * 抉择默认不出（decisionChance 是 0）：它会动预算、信任这些数，别的规则的测试不想被它搅进来；要测它的自己打开。
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
    techs: TEST_TECHS,
    events: TEST_EVENTS,
    skills: TEST_SKILLS,
    decisions: TEST_DECISIONS,
    rules: { ...DEFAULT_RULES, decisionChance: 0, ...rules },
    ...overrides,
  };
}
