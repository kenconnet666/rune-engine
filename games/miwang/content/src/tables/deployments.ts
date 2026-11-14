/**
 * 守方的部署表：在一个地区放下的东西（规则见 sim 的 rules/deployments.ts）。
 * cost 是预算，cooldown 是放过之后要等几天才能再放，days 是管多少天。
 */
import type { DeploymentDef } from '@miwang/sim';

export const DEPLOYMENTS: readonly DeploymentDef[] = [
  // 野战医院：放在医疗被挤兑的地方，一个半月里救得回来的人多
  { id: 'fieldHospital', kind: 'relief', cost: 10, cooldown: 30, days: 45 },
  // 援助物资：给低于中等收入的地区，三个月里那里的检测、医疗、接种按中等收入算
  { id: 'aidPackage', kind: 'aid', cost: 8, cooldown: 30, days: 90 },
];
