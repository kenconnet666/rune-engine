/** 攻方的技能表：种类的含义见 sim 的 config.ts（SkillKind）。cost 是变异点，cooldown、days 是天 */
import type { SkillDef } from '@miwang/sim';

export const SKILLS: readonly SkillDef[] = [
  // 外溢：跳过口岸，直接在一个新地区落脚。贵、冷却长——它绕开的是守方最花钱的那道防线
  { id: 'spillover', kind: 'spillover', cost: 14, cooldown: 60, amount: 30 },
  // 激增：把一个地区再推一把
  { id: 'surge', kind: 'surge', cost: 8, cooldown: 30, days: 14 },
  // 蛰伏：躲一阵。上报少了，守方的注意力和预算会挪开
  {
    id: 'dormancy',
    kind: 'veil',
    cost: 10,
    cooldown: 75,
    days: 30,
    modifiers: { detect: -0.15, spread: -0.12 },
  },
];
