/**
 * 短期任务表：每一方手里同时有一件的小目标（规则和各种判法见 sim 的 rules/tasks.ts）。
 * 目标都写成和局面的大小无关的样子（再多几个地区、翻几倍、保持在线上）：开局和后期都发得出去。
 * 奖励不大——任务是给“接下来干什么”一个方向，不是主要的收入。
 */
import type { TaskDef } from '@miwang/sim';

export const TASKS: readonly TaskDef[] = [
  // ───── 攻方 ─────
  // 开疆：再波及 3 个地区
  {
    id: 'reach',
    side: 'attacker',
    weight: 3,
    days: 30,
    metric: 'regions',
    mode: 'gain',
    target: 3,
    reward: { points: 5 },
  },
  // 倍增：累计感染翻到 3 倍
  {
    id: 'multiply',
    side: 'attacker',
    weight: 3,
    days: 30,
    metric: 'infected',
    mode: 'grow',
    target: 3,
    from: 50,
    reward: { points: 5 },
  },
  // 登堂入室：进入一个高收入地区
  {
    id: 'affluent',
    side: 'attacker',
    weight: 2,
    days: 45,
    metric: 'wealthy',
    mode: 'gain',
    target: 1,
    reward: { points: 6 },
  },
  // 应变：再换到 2 个性状
  {
    id: 'adapt',
    side: 'attacker',
    weight: 2,
    days: 40,
    metric: 'traits',
    mode: 'gain',
    target: 2,
    reward: { points: 4 },
  },
  // 加重：累计死亡翻倍
  {
    id: 'toll',
    side: 'attacker',
    weight: 2,
    days: 40,
    metric: 'deaths',
    mode: 'grow',
    target: 2,
    from: 20,
    reward: { points: 6 },
  },

  // ───── 守方（看的是上报的数）─────
  // 攻关：再完成一项研究
  {
    id: 'labwork',
    side: 'defender',
    weight: 3,
    days: 45,
    metric: 'techs',
    mode: 'gain',
    target: 1,
    reward: { budget: 12 },
  },
  // 守住防线：新上报病例的地区不超过 2 个
  {
    id: 'holdline',
    side: 'defender',
    weight: 3,
    days: 30,
    metric: 'regions',
    mode: 'cap',
    target: 2,
    from: 1,
    reward: { budget: 8, trust: 0.03 },
  },
  // 稳住人心：信任一直不低于六成
  {
    id: 'steady',
    side: 'defender',
    weight: 2,
    days: 30,
    metric: 'trust',
    mode: 'hold',
    target: 0.6,
    from: 0.65,
    reward: { budget: 10 },
  },
  // 压平曲线：上报的现有病例降到现在的七成以下
  {
    id: 'flatten',
    side: 'defender',
    weight: 3,
    days: 30,
    metric: 'cases',
    mode: 'shrink',
    target: 0.7,
    from: 100,
    reward: { budget: 10, trust: 0.04 },
  },
];
