/**
 * 主机：一局里唯一持有真实状态的地方。各方连上来发命令，主机按固定步长推进模拟，
 * 再把每一方“能看到的部分”发回去——双方看到的可以不一样。
 *
 * 主机自己不计时：宿主（Worker 里的定时器、测试）每隔一会儿调一次 advance，告诉它现实里过了多久。
 */
import {
  createStepClock,
  replay,
  type PlayerId,
  type Recording,
  type Simulation,
  type Stamped,
} from '@rune-engine/core';
import type { Port } from './port.ts';
import type { ClientMessage, HostMessage } from './protocol.ts';

export interface HostOptions<Config, State, Command, View> {
  sim: Simulation<Config, State, Command, View>;
  /** 新开一局的配置；或者一份记录，主机照着它重算到最后一步再接着走（读档、热重载） */
  start: { config: Config } | { recording: Recording<Config, Command> };
  /** 一步对应现实里的多少毫秒（1 倍速时） */
  stepMs: number;
  /** 发给客户端的状态里哪些缓冲区可以直接转移（零拷贝） */
  transfer?: (view: View) => ArrayBuffer[];
}

export interface Host<Config, Command, View> {
  /** 接上一方：player 决定它发的命令算谁的、看到的是谁的视角；返回断开的函数 */
  connect(
    port: Port<ClientMessage<Command>, HostMessage<View>>,
    player: PlayerId,
    options?: { readonly?: boolean },
  ): () => void;
  /** 现实里过了 elapsedMs：按时钟推进若干步，有推进就把新状态发给各方 */
  advance(elapsedMs: number): void;
  /** 不管时钟，直接推进 count 步（测试、快进用） */
  stepBy(count: number): void;
  /** 立刻把当前状态发给各方（刚连上、暂停时改了倍速） */
  publish(): void;
  readonly tick: number;
  readonly hash: number;
  /** 到目前为止的完整记录 */
  readonly recording: Recording<Config, Command>;
}

export function createHost<Config, State, Command, View>(
  options: HostOptions<Config, State, Command, View>,
): Host<Config, Command, View> {
  const { sim } = options;
  const recording: Recording<Config, Command> =
    'recording' in options.start
      ? { ...options.start.recording, commands: [...options.start.recording.commands] }
      : { config: options.start.config, commands: [], ticks: 0 };
  const state = replay(sim, recording);
  const clock = createStepClock(options.stepMs);
  const clients = new Set<{
    port: Port<ClientMessage<Command>, HostMessage<View>>;
    player: PlayerId;
  }>();
  /** 还没生效的命令：都在下一步生效 */
  let pending: Stamped<Command>[] = [];

  function step() {
    recording.commands.push(...pending);
    sim.step(state, pending);
    pending = [];
    recording.ticks++;
  }

  function publish() {
    const hash = sim.hash(state);
    for (const { port, player } of clients) {
      const view = sim.observe(state, player);
      port.postMessage(
        {
          type: 'view',
          tick: recording.ticks,
          hash,
          speed: clock.speed,
          paused: clock.paused,
          view,
        },
        options.transfer?.(view),
      );
    }
  }

  return {
    connect(port, player, { readonly = false } = {}) {
      const client = { port, player };
      clients.add(client);
      port.onmessage = ({ data }) => {
        if (readonly) return;
        switch (data.type) {
          case 'command':
            pending.push({ tick: recording.ticks, player, command: data.command });
            break;
          case 'speed':
            clock.speed = data.speed;
            publish();
            break;
          case 'pause':
            clock.paused = data.paused;
            publish();
            break;
        }
      };
      publish();
      return () => {
        clients.delete(client);
        port.onmessage = null;
      };
    },
    advance(elapsedMs) {
      const steps = clock.advance(elapsedMs);
      for (let i = 0; i < steps; i++) step();
      if (steps > 0) publish();
    },
    stepBy(count) {
      for (let i = 0; i < count; i++) step();
      publish();
    },
    publish,
    get tick() {
      return recording.ticks;
    },
    get hash() {
      return sim.hash(state);
    },
    get recording() {
      return recording;
    },
  };
}
