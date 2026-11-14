/**
 * 攻方的技能：花变异点、有冷却的主动操作。有哪些技能、各自多贵由技能表定，规则认识的种类见 config 的 SkillKind。
 * 用了技能只有攻方自己知道——守方看到的只是后果。
 */
import type { SkillDef } from '../config.ts';
import { FOR_ATTACKER, REACHED, report, type OutbreakState } from '../state.ts';
import { expose } from './epidemic.ts';
import { addModifiers } from './modifiers.ts';

/** 这个技能现在能不能对这个地区用（不看点数和冷却）：外溢要没到过的地区，激增要到过的，蛰伏不挑 */
export function skillFits(state: OutbreakState, skill: SkillDef, region: number): boolean {
  if (skill.kind === 'veil') return true;
  if (!Number.isInteger(region) || region < 0 || region >= state.reached.length) return false;
  const reached = (state.reached[region]! & REACHED) !== 0;
  return skill.kind === 'spillover' ? !reached && state.susceptible[region]! > 0 : reached;
}

/** 用一个技能；点数不够、还在冷却、地区不对都不生效 */
export function useSkill(state: OutbreakState, id: string, region: number) {
  const index = state.config.skills.findIndex((skill) => skill.id === id);
  const skill = state.config.skills[index];
  if (!skill || state.tick < state.skillReadyAt[index]! || state.points < skill.cost) return;
  if (!skillFits(state, skill, region)) return;
  state.points -= skill.cost;
  state.skillReadyAt[index] = state.tick + skill.cooldown;

  const days = skill.days ?? 0;
  switch (skill.kind) {
    case 'spillover':
      // 自己落的脚不算“波及新地区”的战果：不给变异点
      expose(state, region, skill.amount ?? 1, { infections: 0, deaths: 0, newRegions: 0 });
      break;
    case 'surge':
      state.surgeUntil[region] = state.tick + days;
      break;
    case 'veil':
      addModifiers(state, skill.modifiers, days, FOR_ATTACKER);
      break;
  }
  report(state, 'skill', FOR_ATTACKER, skill.kind === 'veil' ? -1 : region, id);
}
