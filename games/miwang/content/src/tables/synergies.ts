/**
 * 协同表：几个性状凑齐了，再额外得到一点效果（规则见 sim 的 rules/pathogen.ts）。
 * 让“换哪几个”不只是各算各的：症状和传播途径、两种能力，搭对了比单个加起来强。
 * 效果的单位和性状表一样；幅度大致相当于白得一个便宜的性状——值得顺路凑，不值得为它绕远。
 */
import type { SynergyDef } from '@miwang/sim';

export const SYNERGIES: readonly SynergyDef[] = [
  // 咳嗽、喷嚏把飞沫送得更远
  { id: 'aerosolCloud', requires: ['cough', 'sneeze', 'air2'], effects: { air: 0.05 } },
  // 腹泻的病人污染水源
  { id: 'fouledWater', requires: ['diarrhea', 'water2'], effects: { water: 0.1 } },
  // 出血的病人，接触就会传
  {
    id: 'bleedingContact',
    requires: ['hemorrhage', 'contact2'],
    effects: { contact: 0.06, blood: 0.03 },
  },
  // 动物和蚊子之间来回：两头都更稳
  { id: 'wildCycle', requires: ['animal1', 'vector2'], effects: { vector: 0.08, animal: 1 } },
  // 发病前就传人，又不显眼：更难发现
  { id: 'silentChain', requires: ['presymptomatic', 'stealth2'], effects: { stealth: 1.5 } },
  // 耐寒又耐热：哪里都待得住，病程也长一点
  {
    id: 'allWeather',
    requires: ['cold2', 'heat2'],
    effects: { duration: 2, air: 0.02, contact: 0.02 },
  },
  // 耐药再加上变得快：药和疫苗都追不上
  {
    id: 'movingTarget',
    requires: ['resistance2', 'drift1'],
    effects: { resistance: 0.2, drift: 0.5 },
  },
  // 免疫被压垮之后，器官一个接一个出问题
  { id: 'collapse', requires: ['immunosuppression', 'organFailure'], effects: { lethality: 0.04 } },
];
