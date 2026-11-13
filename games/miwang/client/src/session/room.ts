/**
 * 联机：两位玩家各在自己的浏览器里，主机在主人（开房间的人）那边。
 * 这个文件管的是“两个页面怎么接上”——
 *   主人这头：开房间；客人进来就把它接到主机上（主机在 Worker 里，网络连接在主线程，这里是中间那座桥），
 *             告诉它扮演哪一方；
 *   客人这头：进房间、打招呼、等主人安排位置；之后它就是主机的一个普通客户端，只是隔着网络。
 * 脚下的连接（房间、直连、中转）在 transport 包里。对局怎么打不归这里管（见 host.ts、guest.ts）。
 *
 * 没有服务端的时候（见 service.ts），房间退化成同一个浏览器里的标签页互连，其余完全一样。
 */
import type { PlayerId } from '@rune-engine/core';
import {
  portOverWire,
  ROOM_CODE,
  ROOM_TOKEN,
  roomCode,
  roomToken,
  throttleLatest,
  type Port,
  type RoomSeat,
} from '@rune-engine/net';
import { jsonStore } from '@rune-engine/runtime';
import {
  connectRoom,
  guestRoom,
  hostRoom,
  localRoom,
  type GuestLink,
  type RoomCloseReason,
} from '@rune-engine/transport';
import type { GuestDown, GuestUp } from '../messages.ts';
import { API_URL, secureRandom } from '../service.ts';
import type { FromHost, ToHost } from './core.ts';

/** 有没有联机服务：没有的话房间只在同一个浏览器的标签页之间通 */
export const ONLINE = API_URL !== undefined;
/**
 * 试不试直连。地址里带 ?relay 就不试，消息一直经房间中转——排查“直连是不是有问题”时用，
 * 测试也靠它单独测中转这条路（两头只要有一头带了就走中转）。
 */
const DIRECT = ONLINE && !new URLSearchParams(location.search).has('relay');

/** 经网络发状态最多多快发一份（毫秒）：快进时主机一秒出几十份，对面只要跟得上看就行 */
const VIEW_INTERVAL_MS = 120;

const enterRoom = (code: string, seat: RoomSeat) =>
  API_URL ? connectRoom({ url: `${API_URL}/rooms`, code, seat }) : localRoom(code, seat);

/** 界面上要看的房间状态 */
export interface RoomInfo {
  readonly code: string;
  /** 只在同一个浏览器的标签页之间通（没配联机服务） */
  readonly local: boolean;
  /**
   * connecting  正在连房间，或者正在和对面接上
   * waiting     房间连上了，对面还没来（客人这头：主人不在）
   * joined      两头接上了
   * away        接上过，现在断了（房间还在，对面回来会自动接上）
   * closed      进不去，或者被请出来了（reason 是原因）；不会再连
   */
  readonly state: 'connecting' | 'waiting' | 'joined' | 'away' | 'closed';
  readonly reason?: RoomCloseReason;
  /** 消息现在走哪条路：直连，还是经房间中转 */
  readonly path: 'relay' | 'direct';
}

// ───── 记在标签页里的身份：刷新页面之后还是同一个房间、同一位客人 ─────

export interface HostedRoom {
  readonly code: string;
  /** 只有主人知道：凭它才能再以主人的身份进这个房间 */
  readonly key: string;
}

export const hostedRoom = jsonStore<HostedRoom>('miwang:room', 'tab');
export const newRoom = (): HostedRoom => ({
  code: roomCode(secureRandom),
  key: roomToken(secureRandom),
});

function guestId(): string {
  const store = jsonStore<string>('miwang:guest', 'tab');
  const kept = store.load();
  if (typeof kept === 'string' && ROOM_TOKEN.test(kept)) return kept;
  const id = roomToken(secureRandom);
  store.save(id);
  return id;
}

/** 别人照着打开就能加入的地址 */
export function inviteUrl(code: string): string {
  const url = new URL(location.href);
  const relay = url.searchParams.has('relay');
  url.search = `?join=${code}${relay ? '&relay' : ''}`;
  url.hash = '';
  return url.href;
}

/** 手输的房间号整理成规范的样子；不是房间号的返回 null */
export function normalizeCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}

/** 地址里要加入的房间号（?join=…）；没有或者写得不对是 null */
export const joiningCode = () =>
  normalizeCode(new URLSearchParams(location.search).get('join') ?? '');

// ───── 主人这头 ─────

export interface HostRoomOptions extends HostedRoom {
  /** 客人该扮演哪一方 */
  seat(): PlayerId;
  /** 在主机上给客人接一个位置：返回的 port 另一头是主机 */
  attach(player: PlayerId): MessagePort;
  /** 客人走了：把主机上它的位置撤掉 */
  detach(): void;
  /** 客人来了、走了 */
  onguest(present: boolean): void;
  onchange(info: RoomInfo): void;
}

export interface OpenRoom {
  /** 重新安排客人的位置：主人换了边、换了一局（主机重起之后旧的连接都没了） */
  reseat(): void;
  close(): void;
}

export function openHostRoom(options: HostRoomOptions): OpenRoom {
  const room = hostRoom(enterRoom(options.code, { role: 'host', key: options.key }), {
    direct: DIRECT,
  });
  /** 那位客人：它的线、包成消息通道的线、主机上它那个位置的 port */
  let guest: { link: GuestLink; net: Port<GuestUp, GuestDown>; port?: MessagePort } | undefined;
  let hadGuest = false;

  function report() {
    const base = { code: options.code, local: !ONLINE, path: guest?.link.path ?? 'relay' };
    const { status } = room;
    if (guest) options.onchange({ ...base, state: 'joined' });
    else if (status.state === 'closed') {
      options.onchange({ ...base, state: 'closed', reason: status.reason });
    } else if (status.state === 'connecting') options.onchange({ ...base, state: 'connecting' });
    else options.onchange({ ...base, state: hadGuest ? 'away' : 'waiting' });
  }

  /** 给客人安排（或者重新安排）位置：告诉它扮演哪一方，把主机发给这个位置的状态转给它 */
  function seat() {
    const current = guest;
    if (!current) return;
    current.port?.close();
    const player = options.seat();
    const port = options.attach(player);
    current.port = port;
    current.net.postMessage({ type: 'seat', player });
    const send = throttleLatest<FromHost>(
      (message) => {
        // 位置换过了：上一个位置还压着没发的那份是另一方的视角，不能发出去
        if (guest === current && current.port === port) current.net.postMessage(message);
      },
      () => 'view',
      VIEW_INTERVAL_MS,
      () => performance.now(),
      (run, ms) => setTimeout(run, ms),
    );
    port.onmessage = ({ data }: MessageEvent<FromHost>) => {
      // 线路堵着的时候这一份就不发了：反正马上有更新的
      if (!current.link.congested) send(data);
    };
  }

  room.onjoin = (link) => {
    const net = portOverWire<GuestUp, GuestDown>(link.wire);
    if (guest) {
      // 两个人的游戏，位置已经有人了
      net.onmessage = () => net.postMessage({ type: 'full' });
      net.postMessage({ type: 'full' });
      return;
    }
    const joined = { link, net };
    guest = joined;
    hadGuest = true;
    net.onmessage = ({ data }: { data: unknown }) => {
      // 对面发来的：是不是合规的命令由主机核对，这里只分出“打招呼”
      if (guest !== joined || typeof data !== 'object' || data === null) return;
      if ((data as GuestUp).type === 'hello') seat();
      else guest.port?.postMessage(data);
    };
    options.onguest(true);
    seat();
    report();
  };

  room.onleave = (peer) => {
    if (guest?.link.peer !== peer) return;
    guest.port?.close();
    guest = undefined;
    options.detach();
    options.onguest(false);
    report();
  };

  room.onchange = report;
  report();

  return {
    reseat: seat,
    close() {
      room.onchange = null;
      room.onleave = null;
      room.close();
      if (!guest) return;
      guest.port?.close();
      guest = undefined;
      options.detach();
    },
  };
}

// ───── 客人这头 ─────

export interface GuestRoomOptions {
  readonly code: string;
  /** 主人安排了位置：扮演这一方 */
  onseat(player: PlayerId): void;
  onchange(info: RoomInfo): void;
}

export interface JoinedRoom {
  /** 通到主机的消息通道：和单机时连本机主机的那条一样用 */
  readonly port: Port<FromHost, ToHost>;
  close(): void;
}

export function joinGuestRoom(options: GuestRoomOptions): JoinedRoom {
  const room = guestRoom(enterRoom(options.code, { role: 'guest', peer: guestId() }), {
    direct: DIRECT,
  });
  const net = portOverWire<GuestDown, GuestUp>(room.wire);
  /** 主人给安排了位置（连接断过之后要重新打招呼） */
  let seated = false;
  let everSeated = false;
  let full = false;

  const port: Port<FromHost, ToHost> = {
    onmessage: null,
    postMessage: (message) => net.postMessage(message),
  };

  function report() {
    const base = { code: options.code, local: !ONLINE, path: room.path };
    const { status } = room;
    if (full) options.onchange({ ...base, state: 'closed', reason: 'full' });
    else if (status.state === 'closed') {
      options.onchange({ ...base, state: 'closed', reason: status.reason });
    } else if (seated && room.connected) options.onchange({ ...base, state: 'joined' });
    else if (everSeated) options.onchange({ ...base, state: 'away' });
    else if (status.state === 'open' && !room.connected) {
      options.onchange({ ...base, state: 'waiting' });
    } else options.onchange({ ...base, state: 'connecting' });
  }

  /** 能说上话、还没有位置：打招呼。消息可能丢在半路（两条路正在换），所以隔一会儿再说一次 */
  const greet = () => {
    if (room.connected && !seated && !full) net.postMessage({ type: 'hello' });
  };
  const greeting = setInterval(greet, 1000);

  net.onmessage = ({ data }: { data: unknown }) => {
    if (typeof data !== 'object' || data === null) return;
    const message = data as GuestDown;
    if (message.type === 'seat') {
      seated = everSeated = true;
      options.onseat(message.player);
      report();
    } else if (message.type === 'full') {
      full = true;
      clearInterval(greeting);
      room.close();
      report();
    } else if (message.type === 'view') {
      port.onmessage?.({ data: message });
    }
  };

  room.onchange = () => {
    if (!room.connected) seated = false;
    greet();
    report();
  };
  report();

  return {
    port,
    close() {
      clearInterval(greeting);
      room.onchange = null;
      room.close();
    },
  };
}
