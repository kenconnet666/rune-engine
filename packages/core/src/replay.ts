import type { Simulation, Stamped } from './simulation.ts';

/** 一局的完整记录：配置加上所有命令。存档、回放、热重载、联机核对都只需要它 */
export interface Recording<Config, Command> {
  config: Config;
  /** 按生效的那一步从小到大排 */
  commands: Stamped<Command>[];
  /** 已经推进了多少步 */
  ticks: number;
}

/** 第 tick 步生效的命令（记录里的命令是按步数排好的） */
export function commandsAt<Command>(
  commands: readonly Stamped<Command>[],
  tick: number,
  from = 0,
): { list: Stamped<Command>[]; next: number } {
  const list: Stamped<Command>[] = [];
  let index = from;
  while (index < commands.length && commands[index]!.tick <= tick) {
    if (commands[index]!.tick === tick) list.push(commands[index]!);
    index++;
  }
  return { list, next: index };
}

/** 照着记录重新算一遍，得到第 ticks 步的状态（默认算到记录的最后） */
export function replay<Config, State, Command, View>(
  sim: Simulation<Config, State, Command, View>,
  recording: Recording<Config, Command>,
  ticks: number = recording.ticks,
): State {
  const state = sim.create(recording.config);
  let cursor = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const { list, next } = commandsAt(recording.commands, tick, cursor);
    cursor = next;
    sim.step(state, list);
  }
  return state;
}
