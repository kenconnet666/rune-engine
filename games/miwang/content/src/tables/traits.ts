/**
 * 攻方的性状表。三组：传播途径、症状、能力。前置是“已有其中任意一个”。
 * 效果值的含义见 sim 的 config.ts（EFFECT_KEYS）；数值是照着玩起来的手感调的，不对应任何一种真实疾病。
 */
import type { TraitDef } from '@miwang/sim';

const route = (id: string, cost: number, requires: string[], effects: TraitDef['effects']) =>
  ({ id, group: 'route', cost, requires, effects }) satisfies TraitDef;
const symptom = (id: string, cost: number, requires: string[], effects: TraitDef['effects']) =>
  ({ id, group: 'symptom', cost, requires, effects }) satisfies TraitDef;
const ability = (id: string, cost: number, requires: string[], effects: TraitDef['effects']) =>
  ({ id, group: 'ability', cost, requires, effects }) satisfies TraitDef;

export const TRAITS: readonly TraitDef[] = [
  // ───── 传播途径 ─────
  route('air1', 8, [], { air: 0.07 }),
  route('air2', 14, ['air1'], { air: 0.09, aviation: 0.3 }),
  route('air3', 22, ['air2'], { air: 0.12, aviation: 0.5 }),
  route('contact1', 7, [], { contact: 0.06 }),
  route('contact2', 13, ['contact1'], { contact: 0.09, maritime: 0.4 }),
  route('water1', 9, [], { water: 0.14 }),
  route('water2', 15, ['water1'], { water: 0.2, maritime: 0.6 }),
  route('vector1', 10, [], { vector: 0.18 }),
  route('vector2', 16, ['vector1'], { vector: 0.24 }),
  route('blood1', 8, [], { blood: 0.05, duration: 3 }),
  route('blood2', 14, ['blood1'], { blood: 0.08, duration: 5 }),
  route('animal1', 12, [], { animal: 1 }),
  route('animal2', 18, ['animal1'], { animal: 1, contact: 0.04 }),

  // ───── 症状 ─────
  // 呼吸道
  symptom('cough', 5, [], { air: 0.03, severity: 0.5 }),
  symptom('sneeze', 8, ['cough'], { air: 0.05, severity: 0.5 }),
  symptom('fever', 6, [], { severity: 1, lethality: 0.002 }),
  symptom('pneumonia', 16, ['cough', 'fever'], { air: 0.02, severity: 2, lethality: 0.012 }),
  symptom('respiratoryFailure', 28, ['pneumonia'], { severity: 3, lethality: 0.04 }),
  // 消化道
  symptom('nausea', 5, [], { water: 0.03, severity: 0.5 }),
  symptom('diarrhea', 9, ['nausea'], { water: 0.08, severity: 1, lethality: 0.004 }),
  symptom('dehydration', 18, ['diarrhea'], { severity: 2, lethality: 0.02 }),
  // 皮肤与血液
  symptom('rash', 6, [], { contact: 0.04, severity: 1 }),
  symptom('lesions', 12, ['rash'], { contact: 0.07, blood: 0.03, severity: 1.5, lethality: 0.004 }),
  symptom('hemorrhage', 26, ['lesions', 'fever'], { blood: 0.05, severity: 3, lethality: 0.05 }),
  // 全身
  symptom('fatigue', 5, [], { severity: 0.5, duration: 1 }),
  symptom('immunosuppression', 20, ['fatigue'], { severity: 1, lethality: 0.02, duration: 3 }),
  symptom('encephalitis', 24, ['fever'], { severity: 3, lethality: 0.035 }),
  symptom('organFailure', 36, ['respiratoryFailure', 'hemorrhage', 'dehydration', 'encephalitis'], {
    severity: 4,
    lethality: 0.09,
  }),

  // ───── 能力 ─────
  ability('cold1', 8, [], { cold: 0.5 }),
  ability('cold2', 14, ['cold1'], { cold: 0.5 }),
  ability('heat1', 8, [], { heat: 0.5 }),
  ability('heat2', 14, ['heat1'], { heat: 0.5 }),
  ability('resistance1', 12, [], { resistance: 0.35 }),
  ability('resistance2', 20, ['resistance1'], { resistance: 0.4 }),
  ability('drift1', 14, [], { drift: 1 }),
  ability('drift2', 22, ['drift1'], { drift: 1.5 }),
  ability('latency', 9, [], { incubation: 3, presymptomatic: 0.15 }),
  ability('presymptomatic', 15, ['latency'], { presymptomatic: 0.4 }),
  ability('stealth1', 8, [], { stealth: 1 }),
  ability('stealth2', 14, ['stealth1'], { stealth: 1.5 }),
  ability('carrier', 22, ['stealth2'], { stealth: 2, severity: -1 }),
];
