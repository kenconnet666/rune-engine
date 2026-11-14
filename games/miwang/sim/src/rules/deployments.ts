/**
 * 守方的部署：在一个地区放下的东西，花预算、有冷却、管一阵子。和攻方的技能是一对。
 *   relief 野战医院：那里救得回来的人多（和危机里“建临时病房”是同一件事）
 *   aid    援助物资：那里的检测、医疗、接种按中等收入地区算（只对低于中等的地区有用）
 * 有哪些部署、各自多贵由部署表定。放在哪里是公开的：双方都看得到。
 */
import type { DeploymentDef } from '../config.ts';
import { FOR_BOTH, report, REPORTED, type OutbreakState } from '../state.ts';

/** 这种部署现在能不能放在这个地区（不看预算和冷却）：要是上报过的地区；援助只给低于中等收入的 */
export function deploymentFits(state: OutbreakState, def: DeploymentDef, region: number): boolean {
  if (!Number.isInteger(region) || region < 0 || region >= state.reached.length) return false;
  if ((state.reached[region]! & REPORTED) === 0) return false;
  return def.kind === 'aid' ? state.config.regions[region]!.wealth < 2 : true;
}

/** 放下一样东西；预算不够、还在冷却、地区不对都不生效 */
export function deploy(state: OutbreakState, id: string, region: number) {
  const index = state.config.deployments.findIndex((def) => def.id === id);
  const def = state.config.deployments[index];
  if (!def || state.tick < state.deployReadyAt[index]! || state.budget < def.cost) return;
  if (!deploymentFits(state, def, region)) return;
  state.budget -= def.cost;
  state.deployReadyAt[index] = state.tick + def.cooldown;
  const until = def.kind === 'relief' ? state.reliefUntil : state.aidUntil;
  // 那里已经有一份、还没到期：接着算，不白白盖掉
  until[region] = Math.max(until[region]!, state.tick) + def.days;
  report(state, 'deploy', FOR_BOTH, region, id);
}
