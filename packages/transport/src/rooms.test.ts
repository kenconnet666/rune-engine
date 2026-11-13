/**
 * 两头的房间逻辑，脚下用不经服务器的那种房间（Node 里也有广播通道）。
 * 走的是中转这条路；直连要真的浏览器，在两个页面的冒烟测试里测（scripts/browser）。
 */
import { portOverWire } from '@rune-engine/net';
import { afterEach, describe, expect, it } from 'vitest';
import { guestRoom, type GuestRoom } from './guest-room.ts';
import { hostRoom, type GuestLink, type HostRoom } from './host-room.ts';
import { localRoom } from './local-room.ts';

const open: (HostRoom | GuestRoom)[] = [];
afterEach(() => {
  for (const room of open.splice(0)) room.close();
});

const host = (code: string) => {
  const room = hostRoom(localRoom(code, { role: 'host', key: 'hostkey1' }), { direct: false });
  open.push(room);
  return room;
};
const guest = (code: string, peer = 'guest001') => {
  const room = guestRoom(localRoom(code, { role: 'guest', peer }), { direct: false });
  open.push(room);
  return room;
};

/** 等到条件成立（两头隔着广播通道，消息要过一会儿才到） */
async function until(condition: () => boolean, what: string) {
  for (let waited = 0; !condition(); waited += 10) {
    if (waited > 3000) throw new Error(`没等到：${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('房间的两头', () => {
  it('客人先到也行：主人一来两头就接上，消息各自送到对面', async () => {
    const visitor = guest('T1');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(visitor.connected).toBe(false);

    const owner = host('T1');
    let link: GuestLink | undefined;
    owner.onjoin = (joined) => (link = joined);
    await until(() => link !== undefined && visitor.connected, '两头接上');
    expect(owner.guests.map((it) => it.peer)).toEqual(['guest001']);
    expect(link?.path).toBe('relay');

    const down = portOverWire<{ n: number }, { values: Float32Array }>(visitor.wire);
    const up = portOverWire<{ values: Float32Array }, { n: number }>(link!.wire);
    const got: unknown[] = [];
    down.onmessage = ({ data }) => got.push(data);
    up.onmessage = ({ data }) => got.push(data);
    up.postMessage({ n: 7 });
    down.postMessage({ values: new Float32Array([0.5, 2]) });
    await until(() => got.length === 2, '两条消息');
    expect(got).toContainEqual({ n: 7 });
    expect(got).toContainEqual({ values: new Float32Array([0.5, 2]) });
  });

  it('客人走了主人知道；主人走了客人知道，主人换个页面回来又接上', async () => {
    const owner = host('T2');
    const left: string[] = [];
    owner.onleave = (peer) => left.push(peer);
    const first = guest('T2');
    await until(() => first.connected, '第一位客人接上');
    first.close();
    await until(() => left.length === 1, '主人得知客人走了');
    expect(owner.guests).toEqual([]);

    const second = guest('T2', 'guest002');
    await until(() => second.connected, '第二位客人接上');
    owner.close();
    await until(() => !second.connected, '客人得知主人走了');

    const back = host('T2');
    await until(() => second.connected && back.guests.length === 1, '主人回来后重新接上');
  });
});
