/**
 * 客人这头的房间：一条和主人通话的线（Wire）。直连由客人发起——进了房间、主人在，就试；
 * 没通的时候消息经房间中转，通了自动换过去；直连断了退回中转，过一阵再试。
 */
import { roomToken, type Wire } from '@rune-engine/net';
import { createDirect, parseDirectSignal, PUBLIC_STUN, type Direct } from './direct.ts';
import { CONGESTED_BYTES, type RoomLinkOptions } from './host-room.ts';
import type { RoomClient, RoomStatus } from './room-client.ts';

export interface GuestRoom {
  readonly status: RoomStatus;
  /** 现在能不能和主人说上话（直连通着，或者房间连着而且主人在） */
  readonly connected: boolean;
  /** 现在消息走哪条路 */
  readonly path: 'relay' | 'direct';
  readonly congested: boolean;
  readonly wire: Wire;
  /** 上面几样有变化 */
  onchange: (() => void) | null;
  close(): void;
}

/** 直连没打通，第几次重试前等多久：五秒起，翻倍，最多两分钟 */
const retryDelay = (attempt: number) => Math.min(120_000, 5000 * 2 ** attempt);

export function guestRoom(client: RoomClient, options: RoomLinkOptions = {}): GuestRoom {
  const useDirect = options.direct ?? true;
  let hostOnline = false;
  let direct: Direct | undefined;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const wire: Wire = {
    onmessage: null,
    send(bytes) {
      if (direct?.open) direct.send(bytes);
      else if (hostOnline) client.frame(bytes);
    },
  };

  /** 该试直连的时候就试：主人在、手里没有正在试或者通着的 */
  function tryDirect() {
    clearTimeout(retry);
    if (!useDirect || closed || direct || !hostOnline) return;
    const current = createDirect({
      session: roomToken(Math.random),
      iceServers: options.iceServers ?? PUBLIC_STUN,
      signal: (message) => client.signal(message),
      onopen() {
        attempt = 0;
        room.onchange?.();
      },
      onclose() {
        if (direct === current) direct = undefined;
        room.onchange?.();
        retry = setTimeout(tryDirect, retryDelay(attempt++));
      },
      onmessage: (bytes) => wire.onmessage?.(bytes),
    });
    direct = current;
  }

  /** 主人那边换了页面：手里这条作废，重新来 */
  function reset() {
    direct?.close();
    direct = undefined;
    attempt = 0;
    tryDirect();
  }

  client.onstatus = (status) => {
    if (status.state !== 'open') hostOnline = false;
    room.onchange?.();
  };

  client.onevent = (event) => {
    switch (event.type) {
      case 'welcome':
        if (event.role !== 'guest') return;
        hostOnline = event.hostOnline;
        tryDirect();
        break;
      case 'host-joined':
        hostOnline = true;
        tryDirect();
        break;
      case 'host-left':
        hostOnline = false;
        break;
      case 'signal': {
        const message = parseDirectSignal(event.data);
        if (!message || !useDirect) return;
        if (message.kind === 'reset') reset();
        else direct?.handle(message);
        break;
      }
      default:
        break;
    }
    room.onchange?.();
  };

  client.onframe = (bytes) => wire.onmessage?.(bytes);

  const room: GuestRoom = {
    get status() {
      return client.status;
    },
    get connected() {
      return direct?.open === true || (client.status.state === 'open' && hostOnline);
    },
    get path() {
      return direct?.open ? 'direct' : 'relay';
    },
    get congested() {
      return (direct?.open ? direct.buffered : client.buffered) > CONGESTED_BYTES;
    },
    wire,
    onchange: null,
    close() {
      closed = true;
      clearTimeout(retry);
      direct?.close();
      direct = undefined;
      client.close();
    },
  };
  return room;
}
