/**
 * 房间的测试：在本机把这个 Worker 真的起起来（和线上同一个运行环境），再用 WebSocket 连上去走一遍。
 * 测的是部署出去的那份配置，不是单独拎出来的房间逻辑。
 */
import { fileURLToPath } from 'node:url';
import {
  addressFrame,
  portOverWire,
  readAddress,
  ROOM_CLOSE,
  type RoomEvent,
} from '@rune-engine/net';
import { connectRoom, guestRoom, hostRoom, type GuestLink } from '@rune-engine/transport';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';

const server = createTestHarness({
  workers: [{ configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)) }],
});
let rooms = '';

beforeAll(async () => {
  const { url } = await server.listen();
  rooms = `ws://${url.host}/api/rooms/`;
}, 60_000);
afterAll(() => server.close());

type Received = RoomEvent | Uint8Array | 'pong';

/** 连进一个房间。收到的东西按先后排着：next() 取下一件，没有就等 */
function enter(code: string, query: string) {
  const socket = new WebSocket(`${rooms}${code}?${query}`);
  socket.binaryType = 'arraybuffer';
  const queue: Received[] = [];
  const waiting: ((item: Received) => void)[] = [];
  const push = (item: Received) => {
    const take = waiting.shift();
    if (take) take(item);
    else queue.push(item);
  };
  socket.onmessage = ({ data }: MessageEvent<string | ArrayBuffer>) => {
    if (data === 'pong') push('pong');
    else push(typeof data === 'string' ? (JSON.parse(data) as RoomEvent) : new Uint8Array(data));
  };
  return {
    socket,
    next: () =>
      new Promise<Received>((resolve) => {
        const item = queue.shift();
        if (item !== undefined) resolve(item);
        else waiting.push(resolve);
      }),
    /** 等连接打开再发（刚 new 出来的还在握手） */
    async send(data: string | Uint8Array<ArrayBuffer>) {
      if (socket.readyState === WebSocket.CONNECTING) {
        await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
      }
      socket.send(data);
    },
  };
}

const host = (code: string, key = 'hostkey1') => enter(code, `role=host&key=${key}`);
const guest = (code: string, peer = 'guest001') => enter(code, `role=guest&peer=${peer}`);
const bytes = (...values: number[]) => new Uint8Array(values);

describe('房间', () => {
  it('没人开过的房间进不去', async () => {
    expect(await guest('AAAA22').next()).toEqual({ type: 'closing', code: ROOM_CLOSE.missing });
  });

  it('主人开房间，客人进来，两头互相知道；纸条和中转的字节各自送到对面', async () => {
    const owner = host('BBBB22');
    expect(await owner.next()).toEqual({ type: 'welcome', role: 'host', peers: [] });
    const visitor = guest('BBBB22');
    expect(await visitor.next()).toEqual({ type: 'welcome', role: 'guest', hostOnline: true });
    expect(await owner.next()).toEqual({ type: 'peer-joined', peer: 'guest001' });

    // 纸条：客人的到主人（带着是谁写的），主人的指名给客人
    await visitor.send(JSON.stringify({ type: 'signal', data: { kind: 'offer', sdp: 'x' } }));
    expect(await owner.next()).toEqual({
      type: 'signal',
      from: 'guest001',
      data: { kind: 'offer', sdp: 'x' },
    });
    await owner.send(JSON.stringify({ type: 'signal', to: 'guest001', data: { kind: 'answer' } }));
    expect(await visitor.next()).toEqual({ type: 'signal', data: { kind: 'answer' } });

    // 中转：客人发的原样字节，到主人那头前面多了客人的标识；主人发的带标识，到客人那头去掉
    await visitor.send(bytes(1, 2, 3));
    const relayed = (await owner.next()) as Uint8Array;
    expect(readAddress(relayed)).toEqual({ peer: 'guest001', payload: bytes(1, 2, 3) });
    await owner.send(addressFrame('guest001', bytes(9, 8)) as Uint8Array<ArrayBuffer>);
    expect(await visitor.next()).toEqual(bytes(9, 8));

    // 探活的一问一答
    await visitor.send('ping');
    expect(await visitor.next()).toBe('pong');

    // 客人走了，主人知道；主人走了，再来的客人看到主人不在
    visitor.socket.close();
    expect(await owner.next()).toEqual({ type: 'peer-left', peer: 'guest001' });
    owner.socket.close();
    const late = guest('BBBB22', 'guest002');
    expect(await late.next()).toEqual({ type: 'welcome', role: 'guest', hostOnline: false });
    late.socket.close();
  });

  it('房间号已经有主人了，别的主人进不来；同一位主人再进来，旧的连接让位', async () => {
    const owner = host('CCCC22');
    await owner.next();
    const visitor = guest('CCCC22');
    await visitor.next();
    await owner.next();

    expect(await host('CCCC22', 'otherkey').next()).toEqual({
      type: 'closing',
      code: ROOM_CLOSE.taken,
    });

    const again = host('CCCC22');
    expect(await again.next()).toEqual({ type: 'welcome', role: 'host', peers: ['guest001'] });
    expect(await owner.next()).toEqual({ type: 'closing', code: ROOM_CLOSE.replaced });
    // 客人只被告知“主人来了”（好重新商量直连），不会先收到一次“主人走了”
    expect(await visitor.next()).toEqual({ type: 'host-joined' });
    again.socket.close();
    expect(await visitor.next()).toEqual({ type: 'host-left' });
    visitor.socket.close();
  });

  it('只有一个客人的位置：第二位进不来；同一位客人重连不算第二位', async () => {
    const owner = host('DDDD22');
    await owner.next();
    const first = guest('DDDD22');
    await first.next();
    expect(await guest('DDDD22', 'guest002').next()).toEqual({
      type: 'closing',
      code: ROOM_CLOSE.full,
    });

    const back = guest('DDDD22');
    expect(await back.next()).toEqual({ type: 'welcome', role: 'guest', hostOnline: true });
    expect(await first.next()).toEqual({ type: 'closing', code: ROOM_CLOSE.replaced });
    owner.socket.close();
    back.socket.close();
  });

  it('不合约定的东西：身份写错的进不来，乱发的被请出去', async () => {
    expect(await enter('EEEE22', 'role=host&key=!!').next()).toEqual({
      type: 'closing',
      code: ROOM_CLOSE.invalid,
    });
    expect(await enter('EEEE22', 'role=nobody').next()).toEqual({
      type: 'closing',
      code: ROOM_CLOSE.invalid,
    });

    const owner = host('EEEE22');
    await owner.next();
    const visitor = guest('EEEE22');
    await visitor.next();
    await owner.next();
    await visitor.send('not json');
    expect(await visitor.next()).toEqual({ type: 'closing', code: ROOM_CLOSE.invalid });
    expect(await owner.next()).toEqual({ type: 'peer-left', peer: 'guest001' });
    owner.socket.close();
  });

  it('浏览器用的那套连接层经这个房间通话：进不去的说得出原因，进去了消息两头都到', async () => {
    const url = rooms.replace('ws:', 'http:');
    const nobody = connectRoom({ url, code: 'FFFF22', seat: { role: 'guest', peer: 'guest001' } });
    await expect.poll(() => nobody.status).toEqual({ state: 'closed', reason: 'missing' });

    const owner = hostRoom(
      connectRoom({ url, code: 'FFFF22', seat: { role: 'host', key: 'hostkey1' } }),
      { direct: false },
    );
    let link: GuestLink | undefined;
    owner.onjoin = (joined) => (link = joined);
    const visitor = guestRoom(
      connectRoom({ url, code: 'FFFF22', seat: { role: 'guest', peer: 'guest001' } }),
      { direct: false },
    );
    await expect.poll(() => visitor.connected && link !== undefined).toBe(true);

    const down = portOverWire<{ day: number }, { values: Uint16Array }>(visitor.wire);
    const up = portOverWire<{ values: Uint16Array }, { day: number }>(link!.wire);
    const got: unknown[] = [];
    down.onmessage = ({ data }) => got.push(data);
    up.onmessage = ({ data }) => got.push(data);
    up.postMessage({ day: 3 });
    down.postMessage({ values: new Uint16Array([1, 1023]) });
    await expect.poll(() => got.length).toBe(2);
    expect(got).toContainEqual({ day: 3 });
    expect(got).toContainEqual({ values: new Uint16Array([1, 1023]) });

    visitor.close();
    await expect.poll(() => owner.guests.length).toBe(0);
    owner.close();
  });

  it('房间号不对的请求不会碰到任何房间', async () => {
    const response = await server.fetch('/api/rooms/abc');
    expect(response.status).toBe(400);
  });
});
