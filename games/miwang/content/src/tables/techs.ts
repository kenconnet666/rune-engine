/**
 * 守方的科技表。前置是“全部做完”。效果值的含义见 sim 的 config.ts（DEFENSE_KEYS）。
 * 疫苗是三步连着的研究，三步都做完才开始接种。
 */
import type { TechDef } from '@miwang/sim';

const tech = (
  id: string,
  cost: number,
  days: number,
  requires: string[],
  effects: TechDef['effects'],
) => ({ id, cost, days, requires, effects }) satisfies TechDef;

export const TECHS: readonly TechDef[] = [
  // 认识对手
  tech('identify', 15, 20, [], { identify: 1, detection: 0.03 }),
  tech('rapidTest', 25, 30, ['identify'], { detection: 0.12 }),
  tech('tracing', 20, 25, [], { isolation: 0.4 }),
  tech('origin', 30, 45, ['identify', 'tracing'], { trace: 1, trust: 0.03 }),
  // 救治
  tech('treatment1', 25, 30, ['identify'], { treatment: 0.15 }),
  tech('treatment2', 60, 80, ['treatment1'], { treatment: 0.3 }),
  // 社会
  tech('communication', 15, 15, [], { trust: 0.1 }),
  tech('aid', 45, 40, [], { aid: 0.6 }),
  // 疫苗
  tech('vaccine1', 40, 60, ['identify'], { vaccine: 1 }),
  tech('vaccine2', 60, 90, ['vaccine1'], { vaccine: 1 }),
  tech('vaccine3', 80, 60, ['vaccine2'], { vaccine: 1 }),
  tech('logistics', 40, 30, ['vaccine2'], { rollout: 0.6 }),
];
