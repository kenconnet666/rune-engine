import { fnv1a, hashNumbers, type Simulation } from '@rune-engine/core';
import { describe, expect, it } from 'vitest';
import { connectSession, createHost, createPortPair } from './index.ts';
import type { ClientMessage, HostMessage } from './protocol.ts';

/** 测试用的小模拟：一个计数器，命令给它加数；0 号一方看得到真实值，别的一方只看得到奇偶 */
interface State {
  tick: number;
  total: number;
  log: Float64Array;
}
type Command = { add: number };
type View = { tick: number; value: number };

const counter: Simulation<{ start: number }, State, Command, View> = {
  create: ({ start }) => ({ tick: 0, total: start, log: new Float64Array(64) }),
  step(state, commands) {
    for (const { command } of commands) state.total += command.add;
    state.log[state.tick % 64] = state.total;
    state.tick++;
  },
  hash: (state) => fnv1a(state.log, hashNumbers([state.tick, state.total])),
  observe: (state, player) => ({
    tick: state.tick,
    value: player === 0 ? state.total : state.total % 2,
  }),
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
declare function setTimeout(callback: () => void, ms: number): unknown;

function join(
  host: ReturnType<typeof createHost<{ start: number }, State, Command, View>>,
  player: number,
) {
  const [hostSide, clientSide] = createPortPair<ClientMessage<Command>, HostMessage<View>>();
  host.connect(hostSide, player);
  const views: View[] = [];
  const hashes: number[] = [];
  const session = connectSession<Command, View>(clientSide, {
    view(message) {
      views.push(message.view);
      hashes.push(message.hash);
    },
  });
  return { session, views, hashes };
}

describe('主机与会话', () => {
  it('命令在下一步生效，各方收到各自能看到的部分', async () => {
    const host = createHost({ sim: counter, start: { config: { start: 10 } }, stepMs: 100 });
    const first = join(host, 0);
    const second = join(host, 1);
    await settle();
    first.session.send({ add: 5 });
    await settle();
    host.advance(100);
    await settle();
    expect(first.views.at(-1)).toEqual({ tick: 1, value: 15 });
    expect(second.views.at(-1)).toEqual({ tick: 1, value: 1 });
    expect(first.hashes.at(-1)).toBe(second.hashes.at(-1));
  });

  it('暂停时不推进，倍速时多走几步', async () => {
    const host = createHost({ sim: counter, start: { config: { start: 0 } }, stepMs: 100 });
    const client = join(host, 0);
    client.session.setPaused(true);
    await settle();
    host.advance(1000);
    expect(host.tick).toBe(0);
    client.session.setPaused(false);
    client.session.setSpeed(3);
    await settle();
    host.advance(100);
    expect(host.tick).toBe(3);
  });

  it('拿着记录另起一个主机，算出同一个状态（读档、热重载）', async () => {
    const host = createHost({ sim: counter, start: { config: { start: 1 } }, stepMs: 100 });
    const client = join(host, 0);
    for (let i = 0; i < 20; i++) {
      if (i % 3 === 0) client.session.send({ add: i });
      await settle();
      host.advance(100);
    }
    const copy = createHost({
      sim: counter,
      start: { recording: JSON.parse(JSON.stringify(host.recording)) as typeof host.recording },
      stepMs: 100,
    });
    expect(copy.tick).toBe(host.tick);
    expect(copy.hash).toBe(host.hash);
  });

  it('回放：照着记录一步一步放，放到头自己停；回放时不接受新的命令', async () => {
    // 先打一局：第 2 步、第 5 步各加一次数
    const original = createHost({ sim: counter, start: { config: { start: 0 } }, stepMs: 100 });
    const player = join(original, 0);
    await settle();
    original.stepBy(2);
    player.session.send({ add: 3 });
    await settle();
    original.stepBy(3);
    player.session.send({ add: 4 });
    await settle();
    original.stepBy(3);
    const recorded = original.recording;
    expect(recorded.ticks).toBe(8);

    const host = createHost({ sim: counter, start: { playback: recorded }, stepMs: 100 });
    const viewer = join(host, 0);
    await settle();
    expect(viewer.views.at(-1)).toEqual({ tick: 0, value: 0 });
    // 回放到第 3 步：第一条命令已经生效
    host.stepBy(3);
    await settle();
    expect(viewer.views.at(-1)).toEqual({ tick: 3, value: 3 });
    // 这时发命令没有用
    viewer.session.send({ add: 100 });
    await settle();
    // 多走几步也只到记录的末尾，状态和原来那一局一模一样
    host.stepBy(20);
    await settle();
    expect(host.tick).toBe(8);
    expect(viewer.views.at(-1)).toEqual({ tick: 8, value: 7 });
    expect(host.hash).toBe(original.hash);
  });

  it('回放可以从中间的某一步开始（跳到那一天）', async () => {
    const original = createHost({ sim: counter, start: { config: { start: 1 } }, stepMs: 100 });
    const player = join(original, 0);
    await settle();
    player.session.send({ add: 2 });
    await settle();
    original.stepBy(6);

    const host = createHost({
      sim: counter,
      start: { playback: original.recording, from: 4 },
      stepMs: 100,
    });
    const viewer = join(host, 0);
    await settle();
    expect(viewer.views.at(-1)).toEqual({ tick: 4, value: 3 });
    host.stepBy(10);
    expect(host.tick).toBe(6);
    expect(host.hash).toBe(original.hash);
  });
});

describe('主机不信客户端发来的东西', () => {
  it('形状不对的消息不理：倍速不是正常的数、暂停不是真假、命令不是对象，都不生效也不出错', async () => {
    const host = createHost({ sim: counter, start: { config: { start: 0 } }, stepMs: 100 });
    const [hostSide, clientSide] = createPortPair<ClientMessage<Command>, HostMessage<View>>();
    host.connect(hostSide, 0);
    const seen: HostMessage<View>[] = [];
    clientSide.onmessage = ({ data }) => seen.push(data);
    const send = (message: unknown) => clientSide.postMessage(message as ClientMessage<Command>);
    for (const bad of [
      null,
      'speed',
      { type: 'speed', speed: Number.NaN },
      { type: 'speed', speed: -3 },
      { type: 'speed', speed: 1e9 },
      { type: 'speed', speed: '2' },
      { type: 'pause', paused: 'yes' },
      { type: 'command', command: null },
      { type: 'command' },
      { type: 'nonsense' },
    ]) {
      send(bad);
    }
    await settle();
    host.advance(100);
    await settle();
    expect(host.tick).toBe(1);
    expect(seen.at(-1)).toMatchObject({ speed: 1, paused: false, view: { tick: 1, value: 0 } });
    expect(host.recording.commands).toEqual([]);

    // 正常的照常生效
    send({ type: 'speed', speed: 3 });
    send({ type: 'pause', paused: true });
    await settle();
    expect(seen.at(-1)).toMatchObject({ speed: 3, paused: true });
  });

  it('一步之内的命令有上限：灌进来的多出来的丢掉', async () => {
    const host = createHost({ sim: counter, start: { config: { start: 0 } }, stepMs: 100 });
    const { session } = join(host, 0);
    for (let i = 0; i < 1000; i++) session.send({ add: 1 });
    await settle();
    host.advance(100);
    expect(host.recording.commands).toHaveLength(256);
  });
});
