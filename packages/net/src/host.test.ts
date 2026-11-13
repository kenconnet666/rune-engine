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
});
