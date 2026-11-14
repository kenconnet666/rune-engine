/**
 * 主机：一局里唯一持有真实状态的地方。各方连上来发命令，主机按固定步长推进模拟，
 * 再把每一方“能看到的部分”发回去——双方看到的可以不一样。
 *
 * 命令什么时候生效：模拟写了 apply 的，收到就生效、马上把新状态发出去（时间停着也一样）；
 * 没写的，等下一步。两种情况记录里记的都是“在第几步生效”，重放出来是同一局。
 *
 * 主机自己不计时：宿主（Worker 里的定时器、测试）每隔一会儿调一次 advance，告诉它现实里过了多久。
 */
import {
  commandsAt,
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
  /**
   * 怎么开始：
   *   config     新开一局
   *   recording  照着一份记录重算到最后一步，再接着走（读档、热重载）
   *   playback   回放一份记录：从第 from 步（默认 0）开始一步一步照着放，放到头自己停下；
   *              回放时不接受新的命令，调速、暂停照常
   */
  start:
    | { config: Config }
    | { recording: Recording<Config, Command> }
    | { playback: Recording<Config, Command>; from?: number };
  /** 一步对应现实里的多少毫秒（1 倍速时） */
  stepMs: number;
  /** 发给客户端的状态里哪些缓冲区可以直接转移（零拷贝） */
  transfer?: (view: View) => ArrayBuffer[];
  /** 客户端最多能把倍速调到多少，默认 100 */
  maxSpeed?: number;
}

/** 一步之内最多收多少条命令：正常玩一步也就几条，多出来的只可能是有人在灌 */
const MAX_PENDING = 256;

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

/** 主机一开始手里的记录：新开的是空的，读档的是整份，回放的是开头那一段 */
function startRecording<Config, Command>(
  start: HostOptions<Config, unknown, Command, unknown>['start'],
): Recording<Config, Command> {
  if ('config' in start) return { config: start.config, commands: [], ticks: 0 };
  if ('recording' in start) {
    return { ...start.recording, commands: [...start.recording.commands] };
  }
  const ticks = Math.min(Math.max(0, Math.floor(start.from ?? 0)), start.playback.ticks);
  return {
    config: start.playback.config,
    commands: start.playback.commands.filter((entry) => entry.tick < ticks),
    ticks,
  };
}

export function createHost<Config, State, Command, View>(
  options: HostOptions<Config, State, Command, View>,
): Host<Config, Command, View> {
  const { sim } = options;
  /** 回放的那份记录；不是回放时是 null */
  const playback = 'playback' in options.start ? options.start.playback : null;
  const recording: Recording<Config, Command> = startRecording(options.start);
  const state = replay(sim, recording);
  /** 回放时记录里的命令读到了哪里 */
  let cursor = recording.commands.length;
  const clock = createStepClock(options.stepMs);
  const clients = new Set<{
    port: Port<ClientMessage<Command>, HostMessage<View>>;
    player: PlayerId;
  }>();
  /** 这一步收到的命令。模拟能让命令立刻生效时，它们已经作用在状态上了，到 step 时只是记进记录 */
  let pending: Stamped<Command>[] = [];
  const immediate = sim.apply !== undefined && !playback;

  function step() {
    if (playback) {
      // 放到头了：停在最后一步
      if (recording.ticks >= playback.ticks) {
        clock.paused = true;
        return;
      }
      const { list, next } = commandsAt(playback.commands, recording.ticks, cursor);
      cursor = next;
      pending = list;
    }
    recording.commands.push(...pending);
    sim.step(state, immediate ? [] : pending);
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
      port.onmessage = (event) => {
        // 客户端可能在网络另一头，发来的东西不能信：形状不对的不理。
        // 命令的内容主机不认识，由模拟自己核对（sim.step 不能被一条坏命令打断）
        const data: unknown = event.data;
        if (readonly || typeof data !== 'object' || data === null) return;
        const message = data as {
          type?: unknown;
          command?: unknown;
          speed?: unknown;
          paused?: unknown;
        };
        switch (message.type) {
          case 'command':
            // 回放时过去的事已经定了，不接受新的命令
            if (playback || pending.length >= MAX_PENDING) return;
            if (typeof message.command !== 'object' || message.command === null) return;
            {
              const stamped = {
                tick: recording.ticks,
                player,
                command: message.command as Command,
              };
              pending.push(stamped);
              if (immediate) {
                sim.apply?.(state, stamped);
                publish();
              }
            }
            break;
          case 'speed':
            if (typeof message.speed !== 'number') return;
            if (!(message.speed > 0 && message.speed <= (options.maxSpeed ?? 100))) return;
            clock.speed = message.speed;
            publish();
            break;
          case 'pause':
            if (typeof message.paused !== 'boolean') return;
            clock.paused = message.paused;
            publish();
            break;
          default:
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
