/**
 * 主人这头的房间：每来一位客人就有一条和它通话的线（Wire）。
 * 线脚下走哪条路上层不用管——直连通着就走直连，没通（或者断了）就经房间中转，两条路随时互换。
 */
import { ROOM_TOKEN, type Wire } from '@rune-engine/net';
import { createDirect, parseDirectSignal, PUBLIC_STUN, type Direct } from './direct.ts';
import type { RoomClient, RoomStatus } from './room-client.ts';

/** 发送队列里压了这么多字节就算堵了：这时“只要最新一份”的消息先别发 */
export const CONGESTED_BYTES = 512 * 1024;

export interface RoomLinkOptions {
  /** 要不要试直连（不经服务器的房间用不着）。默认试 */
  readonly direct?: boolean;
  readonly iceServers?: RTCIceServer[];
}

/** 主人眼里的一位客人 */
export interface GuestLink {
  readonly peer: string;
  readonly wire: Wire;
  /** 现在消息走哪条路 */
  readonly path: 'relay' | 'direct';
  readonly congested: boolean;
}

export interface HostRoom {
  readonly status: RoomStatus;
  readonly guests: readonly GuestLink[];
  /** 来了一位客人 */
  onjoin: ((guest: GuestLink) => void) | null;
  /** 一位客人走了（它的线作废） */
  onleave: ((peer: string) => void) | null;
  /** status 变了，或者哪位客人换了路 */
  onchange: (() => void) | null;
  close(): void;
}

interface Guest {
  readonly link: GuestLink;
  /** 在房间里（房间的连接断着的时候不算，但直连可能还通着） */
  present: boolean;
  direct?: Direct;
}

export function hostRoom(client: RoomClient, options: RoomLinkOptions = {}): HostRoom {
  const guests = new Map<string, Guest>();
  const useDirect = options.direct ?? true;

  function arrive(peer: string, announced: 'joined' | 'listed') {
    const known = guests.get(peer);
    if (known) {
      known.present = true;
      return;
    }
    const guest: Guest = {
      present: true,
      link: {
        peer,
        wire: {
          onmessage: null,
          send(bytes) {
            if (guest.direct?.open) guest.direct.send(bytes);
            else if (guest.present) client.frame(bytes, peer);
          },
        },
        get path() {
          return guest.direct?.open ? 'direct' : 'relay';
        },
        get congested() {
          const buffered = guest.direct?.open ? guest.direct.buffered : client.buffered;
          return buffered > CONGESTED_BYTES;
        },
      },
    };
    guests.set(peer, guest);
    // 一进房间就看到已经在的客人：我是个新页面，它手里要是还留着跟上一个页面的直连，让它作废重来
    if (announced === 'listed' && useDirect) client.signal({ kind: 'reset' }, peer);
    room.onjoin?.(guest.link);
  }

  /** 既不在房间里、直连也没通着：这位客人算走了 */
  function settle(peer: string) {
    const guest = guests.get(peer);
    if (!guest || guest.present || guest.direct?.open) return;
    guest.direct?.close();
    guests.delete(peer);
    room.onleave?.(peer);
  }

  /** 客人发来 offer：放下旧的那次尝试，应这一次 */
  function answer(guest: Guest, session: string, offer: string) {
    const { peer } = guest.link;
    guest.direct?.close();
    const direct = createDirect({
      session,
      offer,
      iceServers: options.iceServers ?? PUBLIC_STUN,
      signal: (message) => client.signal(message, peer),
      onopen: () => room.onchange?.(),
      onclose() {
        if (guest.direct === direct) guest.direct = undefined;
        room.onchange?.();
        settle(peer);
      },
      onmessage: (bytes) => guest.link.wire.onmessage?.(bytes),
    });
    guest.direct = direct;
  }

  client.onstatus = (status) => {
    // 房间的连接断了：只靠中转的客人这时都联系不上了
    if (status.state !== 'open') {
      for (const guest of guests.values()) guest.present = false;
      for (const peer of [...guests.keys()]) settle(peer);
    }
    room.onchange?.();
  };

  client.onevent = (event) => {
    switch (event.type) {
      case 'welcome':
        if (event.role !== 'host') return;
        for (const guest of guests.values()) guest.present = event.peers.includes(guest.link.peer);
        for (const peer of event.peers) arrive(peer, 'listed');
        for (const peer of [...guests.keys()]) settle(peer);
        break;
      case 'peer-joined':
        if (ROOM_TOKEN.test(event.peer)) arrive(event.peer, 'joined');
        break;
      case 'peer-left': {
        const guest = guests.get(event.peer);
        if (guest) guest.present = false;
        settle(event.peer);
        break;
      }
      case 'signal': {
        const guest = event.from === undefined ? undefined : guests.get(event.from);
        const message = parseDirectSignal(event.data);
        if (!guest || !message || !useDirect) return;
        if (message.kind === 'offer') answer(guest, message.session, message.sdp);
        else guest.direct?.handle(message);
        break;
      }
      default:
        break;
    }
    room.onchange?.();
  };

  client.onframe = (bytes, from) => {
    if (from !== undefined) guests.get(from)?.link.wire.onmessage?.(bytes);
  };

  const room: HostRoom = {
    get status() {
      return client.status;
    },
    get guests() {
      return [...guests.values()].map((guest) => guest.link);
    },
    onjoin: null,
    onleave: null,
    onchange: null,
    close() {
      for (const guest of guests.values()) guest.direct?.close();
      guests.clear();
      client.close();
    },
  };
  return room;
}
