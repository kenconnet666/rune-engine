/**
 * 攻方的技能：花变异点、有冷却的主动操作。有哪些技能、各自多贵由技能表定，规则认识的种类见 config 的 SkillKind。
 * 用了技能只有攻方自己知道——守方看到的只是后果。
 */
import { clamp } from '@rune-engine/core';
import type { SkillDef } from '../config.ts';
import { FOR_ATTACKER, REACHED, report, type OutbreakState } from '../state.ts';
import { expose } from './epidemic.ts';
import { addModifiers } from './modifiers.ts';

/** 不对着某个地区用的技能（蛰伏、抗原转变） */
export const skillIsGlobal = (skill: SkillDef): boolean =>
  skill.kind === 'veil' || skill.kind === 'shift';

/** 这个技能现在能不能对这个地区用（不看点数和冷却）：外溢要没到过的地区，激增要到过的，不对着地区的不挑 */
export function skillFits(state: OutbreakState, skill: SkillDef, region: number): boolean {
  if (skillIsGlobal(skill)) return true;
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
    case 'shift': {
      // 换了一副面孔：得过、打过疫苗的人里有一部分又认不出它了（按比例取整，不掷随机数）
      const share = clamp(skill.amount ?? 0, 0, 1);
      for (let r = 0; r < state.recovered.length; r++) {
        const again = Math.floor(state.recovered[r]! * share);
        const lapsed = Math.floor(state.immune[r]! * share);
        state.recovered[r]! -= again;
        state.immune[r]! -= lapsed;
        state.susceptible[r]! += again + lapsed;
      }
      break;
    }
  }
  report(state, 'skill', FOR_ATTACKER, skillIsGlobal(skill) ? -1 : region, id);
}
