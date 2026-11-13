import { describe, expect, it } from 'vitest';
import { createPortPair } from './port.ts';
import { portOverWire, throttleLatest, type Wire } from './wire.ts';

/** 一对直接相连的线：一头发的字节下一个微任务到另一头 */
function wirePair(): [Wire, Wire] {
  const make = (peer: () => Wire): Wire => ({
    onmessage: null,
    send: (bytes) => void Promise.resolve().then(() => peer().onmessage?.(bytes)),
  });
  const a: Wire = make(() => b);
  const b: Wire = make(() => a);
  return [a, b];
}

describe('走线的消息通道', () => {
  it('一头发的消息另一头收到；解不出来的丢掉，后面的照常', async () => {
    const [left, right] = wirePair();
    const bad: unknown[] = [];
    const sender = portOverWire<never, { n: number }>(left);
    const receiver = portOverWire<{ n: number }, never>(right, (error) => bad.push(error));
    const got: number[] = [];
    receiver.onmessage = ({ data }) => got.push(data.n);
    sender.postMessage({ n: 1 });
    left.send(new Uint8Array([9, 9]));
    sender.postMessage({ n: 2 });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(got).toEqual([1, 2]);
    expect(bad).toHaveLength(1);
    // 同线程的那种通道照旧能用（两种通道是同一个接口）
    expect(createPortPair()).toHaveLength(2);
  });
});

describe('限流：同一种消息只发最新的', () => {
  it('冷却期里来的几条只留最后一条，到点发出去；不限流的消息立刻发', () => {
    let clock = 0;
    const timers: { at: number; run: () => void }[] = [];
    const sent: string[] = [];
    const send = throttleLatest<{ kind: string; n: number }>(
      (message) => sent.push(`${message.kind}${message.n}`),
      (message) => (message.kind === 'view' ? 'view' : null),
      100,
      () => clock,
      (run, ms) => timers.push({ at: clock + ms, run }),
    );
    send({ kind: 'view', n: 1 });
    send({ kind: 'view', n: 2 });
    send({ kind: 'command', n: 1 });
    send({ kind: 'view', n: 3 });
    expect(sent).toEqual(['view1', 'command1']);
    clock = 100;
    for (const timer of timers.splice(0)) timer.run();
    expect(sent).toEqual(['view1', 'command1', 'view3']);
    // 过了冷却期再来的直接发
    clock = 250;
    send({ kind: 'view', n: 4 });
    expect(sent.at(-1)).toBe('view4');
  });

  it('定时器迟迟不来（页面在后台被降频）也不耽误：冷却期一过，来的消息当场发', () => {
    let clock = 0;
    const timers: (() => void)[] = [];
    const sent: number[] = [];
    const send = throttleLatest<number>(
      (n) => sent.push(n),
      () => 'view',
      100,
      () => clock,
      (run) => timers.push(run),
    );
    send(1);
    clock = 50;
    send(2);
    // 定时器一直没被叫到
    clock = 180;
    send(3);
    expect(sent).toEqual([1, 3]);
    clock = 200;
    send(4);
    // 迟到的定时器终于来了：刚发过一条，压着的这条接着等，不抢发
    for (const run of timers.splice(0)) run();
    expect(sent).toEqual([1, 3]);
    clock = 280;
    for (const run of timers.splice(0)) run();
    expect(sent).toEqual([1, 3, 4]);
  });
});

declare function setTimeout(callback: () => void, ms: number): unknown;
