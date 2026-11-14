/**
 * 短期任务：每一方手里同时有一件“接下来这段时间做到什么”的小目标，做到了有奖励，没做到也不罚。
 * 一件完了（做到、没做到）隔几天给下一件。有哪些任务、奖励多少由任务表定；这里管发任务和判定。
 *
 * 任务看的数是这一方自己看得到的：攻方按真实的，守方按上报的。判定的办法（TaskDef.mode）：
 *   gain    比接到任务时多了 target（一做到就算完成）
 *   grow    涨到接到任务时的 target 倍（一做到就算完成）
 *   cap     到期时比接到任务时多出来的不超过 target（中途超了就算没做到）
 *   hold    到期前一直不低于 target（中途掉下去就算没做到）
 *   shrink  到期时不超过接到任务时的 target 倍
 */
import { clamp, type PlayerId } from '@rune-engine/core';
import type { TaskDef, TaskMetric } from '../config.ts';
import {
  ATTACKER,
  DEFENDER,
  FOR_ATTACKER,
  FOR_DEFENDER,
  report,
  TECH_DONE,
  type OutbreakState,
} from '../state.ts';
import { goalValue } from './outcome.ts';
import { pickWeighted } from './pick.ts';

const playerOf = (task: TaskDef): PlayerId => (task.side === 'attacker' ? ATTACKER : DEFENDER);

/** 任务看的那个数现在是多少（这一方看得到的那个） */
export function taskValue(state: OutbreakState, metric: TaskMetric, attacker: boolean): number {
  switch (metric) {
    case 'techs': {
      let done = 0;
      for (const status of state.techs) if (status === TECH_DONE) done++;
      return done;
    }
    case 'trust':
      return state.trust;
    case 'cases': {
      let total = 0;
      const cases = attacker ? state.infectious : state.visible;
      for (const count of cases) total += count;
      return total;
    }
    default:
      return goalValue(state, metric, attacker) ?? 0;
  }
}

/** 一件任务现在的情况：手里有多少、要到多少（cap、shrink 是不能超过多少）、是不是已经做到或者已经没戏了 */
export function taskProgress(
  state: OutbreakState,
  task: TaskDef,
  start: number,
): { have: number; need: number; done?: boolean; failed?: boolean } {
  const value = taskValue(state, task.metric, task.side === 'attacker');
  switch (task.mode) {
    case 'gain':
      return { have: value - start, need: task.target, done: value - start >= task.target };
    case 'grow': {
      const need = Math.max(1, start) * task.target;
      return { have: value, need, done: value >= need };
    }
    case 'cap':
      return { have: value - start, need: task.target, failed: value - start > task.target };
    case 'hold':
      return { have: value, need: task.target, failed: value < task.target };
    case 'shrink':
      return { have: value, need: start * task.target };
  }
}

/** 这件任务现在发下去有没有意义 */
function eligible(state: OutbreakState, task: TaskDef): boolean {
  const value = taskValue(state, task.metric, task.side === 'attacker');
  if (value < (task.from ?? 0)) return false;
  // 研究都做完了就不再发“完成研究”的任务
  if (task.metric === 'techs') return value + task.target <= state.techs.length;
  return true;
}

function finish(state: OutbreakState, player: PlayerId, task: TaskDef, success: boolean) {
  state.task[player] = -1;
  state.taskNext[player] = state.tick + state.config.rules.taskGap;
  if (success) {
    const { points = 0, budget = 0, trust = 0 } = task.reward;
    state.points += points;
    state.budget += budget;
    state.trust = clamp(state.trust + trust, 0, 1);
    state.tasksDone[player]!++;
  }
  report(
    state,
    'task',
    player === ATTACKER ? FOR_ATTACKER : FOR_DEFENDER,
    -1,
    `${task.id}.${success ? 'done' : 'failed'}`,
  );
}

/** 每天结算之后：手里的任务判一下；没有任务、间隔也过了就发一件新的 */
export function updateTasks(state: OutbreakState) {
  const { rules, tasks } = state.config;
  if (rules.taskGap < 0 || tasks.length === 0) return;
  for (const player of [ATTACKER, DEFENDER]) {
    const task = tasks[state.task[player]!];
    if (task) {
      const { done, failed, have, need } = taskProgress(state, task, state.taskStart[player]!);
      const expired = state.tick + 1 >= state.taskExpires[player]!;
      if (done) finish(state, player, task, true);
      else if (failed) finish(state, player, task, false);
      // 到期才见分晓的：gain、grow 到期还没做到是没做到；cap、hold 撑到了期限是做到；shrink 看到期时的数
      else if (expired)
        finish(state, player, task, task.mode === 'shrink' ? have <= need : done === undefined);
      continue;
    }
    if (state.tick < Math.max(rules.taskAfter, state.taskNext[player]!)) continue;
    const index = pickWeighted(
      state.random,
      tasks.map((candidate, at) =>
        playerOf(candidate) === player && eligible(state, candidate)
          ? candidate.weight / (1 + 2 * state.taskSeen[at]!)
          : 0,
      ),
    );
    const picked = tasks[index];
    if (!picked) continue;
    state.task[player] = index;
    state.taskStart[player] = taskValue(state, picked.metric, picked.side === 'attacker');
    state.taskExpires[player] = state.tick + 1 + picked.days;
    state.taskSeen[index] = Math.min(255, state.taskSeen[index]! + 1);
  }
}
