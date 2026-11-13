/**
 * 不经服务器的房间：同一个浏览器里的几个标签页用广播通道（BroadcastChannel）互相找到。
 * 没部署联机服务的时候、开发的时候用它——只能连同一台电脑、同一个浏览器里的页面，
 * 但对上层来说和真的房间是同一个接口，走的是同一套代码。
 *
 * 没有服务端替大家记“谁在”，所以两头自己喊：客人反复敲门直到主人应声，主人进出各喊一声。
 */
import type { RoomSeat } from '@rune-engine/net';
import type { RoomClient, RoomStatus } from './room-client.ts';

type LocalMessage =
  /** 客人敲门、客人走了 */
  | { readonly kind: 'join'; readonly peer: string }
  | { readonly kind: 'leave'; readonly peer: string }
  /** 主人应门（给某位客人）、主人来了、主人走了 */
  | { readonly kind: 'welcome'; readonly peer: string }
  | { readonly kind: 'host-joined' }
  | { readonly kind: 'host-left' }
  /** 纸条和中转的字节：from / to 是客人的标识，主人那头不写 */
  | {
      readonly kind: 'signal';
      readonly from?: string;
      readonly to?: string;
      readonly data: unknown;
    }
  | {
      readonly kind: 'frame';
      readonly from?: string;
      readonly to?: string;
      readonly bytes: Uint8Array;
    };

/** 客人没等到主人应声时，隔多久再敲一次 */
const KNOCK_MS = 500;

export function localRoom(code: string, seat: RoomSeat): RoomClient {
  const channel = new BroadcastChannel(`rune-room:${code}`);
  const post = (message: LocalMessage) => channel.postMessage(message);
  let status: RoomStatus = { state: 'open' };
  let knocking: ReturnType<typeof setInterval> | undefined;

  const client: RoomClient = {
    get status() {
      return status;
    },
    onstatus: null,
    onevent: null,
    onframe: null,
    signal: (data, to) =>
      post({ kind: 'signal', from: seat.role === 'guest' ? seat.peer : undefined, to, data }),
    frame: (bytes, to) =>
      post({ kind: 'frame', from: seat.role === 'guest' ? seat.peer : undefined, to, bytes }),
    buffered: 0,
    close() {
      if (status.state === 'closed') return;
      clearInterval(knocking);
      post(seat.role === 'host' ? { kind: 'host-left' } : { kind: 'leave', peer: seat.peer });
      channel.close();
      status = { state: 'closed', reason: 'left' };
      client.onstatus?.(status);
    },
  };

  if (seat.role === 'host') {
    channel.onmessage = ({ data }: MessageEvent<LocalMessage>) => {
      if (data.kind === 'join') {
        post({ kind: 'welcome', peer: data.peer });
        client.onevent?.({ type: 'peer-joined', peer: data.peer });
      } else if (data.kind === 'leave') {
        client.onevent?.({ type: 'peer-left', peer: data.peer });
      } else if (data.kind === 'signal' && data.from !== undefined) {
        client.onevent?.({ type: 'signal', from: data.from, data: data.data });
      } else if (data.kind === 'frame' && data.from !== undefined) {
        client.onframe?.(data.bytes, data.from);
      }
    };
    // 调用方拿到这个对象之后才接事件：开场白放到下一个微任务
    queueMicrotask(() => {
      client.onevent?.({ type: 'welcome', role: 'host', peers: [] });
      // 已经在等的客人听到这一声会再敲一次门
      post({ kind: 'host-joined' });
    });
    return client;
  }

  const knock = () => {
    clearInterval(knocking);
    post({ kind: 'join', peer: seat.peer });
    knocking = setInterval(() => post({ kind: 'join', peer: seat.peer }), KNOCK_MS);
  };
  channel.onmessage = ({ data }: MessageEvent<LocalMessage>) => {
    if (data.kind === 'welcome' && data.peer === seat.peer) {
      clearInterval(knocking);
      client.onevent?.({ type: 'host-joined' });
    } else if (data.kind === 'host-joined') {
      knock();
    } else if (data.kind === 'host-left') {
      client.onevent?.({ type: 'host-left' });
    } else if (data.kind === 'signal' && data.from === undefined && data.to === seat.peer) {
      client.onevent?.({ type: 'signal', data: data.data });
    } else if (data.kind === 'frame' && data.from === undefined && data.to === seat.peer) {
      client.onframe?.(data.bytes);
    }
  };
  queueMicrotask(() => {
    client.onevent?.({ type: 'welcome', role: 'guest', hostOnline: false });
    knock();
  });
  return client;
}
