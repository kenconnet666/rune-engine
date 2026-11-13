/**
 * 房间在客户端这头的样子，和连到服务端房间的那种实现（WebSocket）。
 * 约定见 net 包的 room.ts；另一种不经服务器的实现见 local-room.ts。
 */
import {
  addressFrame,
  readAddress,
  ROOM_CLOSE,
  type RoomEvent,
  type RoomRequest,
  type RoomSeat,
} from '@rune-engine/net';

/** 为什么进不去、被请出来 */
export type RoomCloseReason =
  /** 这个房间号已经有别的主人了 */
  | 'taken'
  /** 客人满了 */
  | 'full'
  /** 没有这个房间 */
  | 'missing'
  /** 同一个身份在别处又进来了 */
  | 'replaced'
  /** 发的东西不合约定（两头的版本对不上时会这样） */
  | 'invalid'
  /** 自己关的 */
  | 'left';

export type RoomStatus =
  /** 正在连，或者断了正在重连 */
  | { readonly state: 'connecting' }
  | { readonly state: 'open' }
  /** 不会再连了 */
  | { readonly state: 'closed'; readonly reason: RoomCloseReason };

/** 房间里发生的事（“要关了”那一句由实现自己消化，变成 status） */
export type RoomNotice = Exclude<RoomEvent, { type: 'closing' }>;

export interface RoomClient {
  readonly status: RoomStatus;
  onstatus: ((status: RoomStatus) => void) | null;
  onevent: ((event: RoomNotice) => void) | null;
  /** 对面经房间中转来的一段字节；主人收到的带着是哪位客人发的 */
  onframe: ((bytes: Uint8Array, from?: string) => void) | null;
  /** 递纸条；主人要写给谁 */
  signal(data: unknown, to?: string): void;
  /** 经房间中转一段字节；主人要写给谁 */
  frame(bytes: Uint8Array, to?: string): void;
  /** 中转的发送队列里还压着多少字节 */
  readonly buffered: number;
  close(): void;
}

const REASONS: Record<number, RoomCloseReason> = {
  [ROOM_CLOSE.taken]: 'taken',
  [ROOM_CLOSE.full]: 'full',
  [ROOM_CLOSE.missing]: 'missing',
  [ROOM_CLOSE.replaced]: 'replaced',
  [ROOM_CLOSE.invalid]: 'invalid',
};

/** 隔多久问一次“还在吗”；问了之后到下一次问之前没回音，就当连接已经死了 */
const PING_MS = 15_000;
/** 断了以后第几次重连等多久：半秒起，翻倍，最多八秒 */
const retryDelay = (attempt: number) => Math.min(8000, 500 * 2 ** attempt);

function parseEvent(text: string): RoomEvent | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    return typeof (value as { type?: unknown }).type === 'string' ? (value as RoomEvent) : null;
  } catch {
    return null;
  }
}

export interface ConnectRoomOptions {
  /** 房间服务的地址，可以是相对的（'/api/rooms'）；http(s) 会换成 ws(s) */
  readonly url: string;
  readonly code: string;
  readonly seat: RoomSeat;
}

/** 连到服务端的房间。连接断了自己重连；房间明确说了不让进（或者自己关了）才算结束 */
export function connectRoom({ url, code, seat }: ConnectRoomOptions): RoomClient {
  // 相对的地址按当前页面补全（Node 里没有 location：测试、脚本得给完整的地址）
  const target = new URL(`${url.replace(/\/$/, '')}/${code}`, globalThis.location?.href);
  target.protocol = target.protocol.replace('http', 'ws');
  target.search =
    seat.role === 'host' ? `?role=host&key=${seat.key}` : `?role=guest&peer=${seat.peer}`;

  let socket: WebSocket | undefined;
  let status: RoomStatus = { state: 'connecting' };
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let pinging: ReturnType<typeof setInterval> | undefined;

  const setStatus = (next: RoomStatus) => {
    status = next;
    client.onstatus?.(next);
  };

  /** 放下手里这条连接（之后它的事件都不理了） */
  function drop() {
    clearInterval(pinging);
    const old = socket;
    socket = undefined;
    old?.close();
  }

  function finish(reason: RoomCloseReason) {
    if (status.state === 'closed') return;
    clearTimeout(retry);
    drop();
    setStatus({ state: 'closed', reason });
  }

  /** 连接断了：过一会儿再连 */
  function lost() {
    drop();
    if (status.state === 'closed') return;
    if (status.state !== 'connecting') setStatus({ state: 'connecting' });
    retry = setTimeout(open, retryDelay(attempt++));
  }

  function open() {
    const ws = new WebSocket(target);
    ws.binaryType = 'arraybuffer';
    socket = ws;
    let answered = true;
    ws.onopen = () => {
      pinging = setInterval(() => {
        if (!answered) return lost();
        answered = false;
        ws.send('ping');
      }, PING_MS);
    };
    ws.onmessage = ({ data }: MessageEvent<string | ArrayBuffer>) => {
      if (ws !== socket) return;
      if (data === 'pong') {
        answered = true;
        return;
      }
      if (typeof data !== 'string') {
        const bytes = new Uint8Array(data);
        if (seat.role === 'guest') return client.onframe?.(bytes);
        const address = readAddress(bytes);
        if (address) client.onframe?.(address.payload, address.peer);
        return;
      }
      const event = parseEvent(data);
      if (!event) return;
      if (event.type === 'closing') return finish(REASONS[event.code] ?? 'invalid');
      if (event.type === 'welcome') {
        attempt = 0;
        setStatus({ state: 'open' });
      }
      client.onevent?.(event);
    };
    ws.onclose = () => {
      if (ws === socket) lost();
    };
  }

  const sendIfOpen = (data: string | Uint8Array<ArrayBuffer>) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(data);
  };

  const client: RoomClient = {
    get status() {
      return status;
    },
    onstatus: null,
    onevent: null,
    onframe: null,
    signal: (data, to) =>
      sendIfOpen(JSON.stringify({ type: 'signal', to, data } satisfies RoomRequest)),
    frame: (bytes, to) =>
      sendIfOpen((to === undefined ? bytes : addressFrame(to, bytes)) as Uint8Array<ArrayBuffer>),
    get buffered() {
      return socket?.bufferedAmount ?? 0;
    },
    close: () => finish('left'),
  };
  open();
  return client;
}
