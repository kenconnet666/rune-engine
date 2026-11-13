/**
 * 一个房间（Durable Object，每个房间号一个）：约定见 net 包的 room.ts。
 *
 * 用的是“可休眠的 WebSocket”：没人说话时对象会被收起来，连接留着，不计运行时间；
 * 有消息来了再被叫醒。所以对象里不存任何东西——谁是谁记在各条连接自己身上（attachment），
 * 主人的钥匙记在存储里，这两样休眠之后都还在。
 */
import {
  addressFrame,
  readAddress,
  ROOM_CLOSE,
  ROOM_FRAME_LIMIT,
  ROOM_SIGNAL_LIMIT,
  ROOM_TOKEN,
  type RoomEvent,
  type RoomRequest,
} from '@rune-engine/net';
import { DurableObject } from 'cloudflare:workers';

/** 人都走了以后房间再留多久：主人刷新页面、断了一下网，回来还是这个房间 */
const IDLE_MS = 10 * 60_000;

/** 记在连接身上的身份；被顶替、被请出去的连接没有身份 */
type Seat = { readonly role: 'host' } | { readonly role: 'guest'; readonly peer: string };

const seatOf = (socket: WebSocket) => socket.deserializeAttachment() as Seat | null;

function parseRequest(text: string): RoomRequest | null {
  if (text.length > ROOM_SIGNAL_LIMIT) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { type, to, data } = value as Record<string, unknown>;
  if (type !== 'signal') return null;
  if (to !== undefined && (typeof to !== 'string' || !ROOM_TOKEN.test(to))) return null;
  return { type, to, data };
}

export class RoomObject extends DurableObject {
  /** 最多几位客人；游戏的服务入口按自己的需要改 */
  protected readonly maxGuests: number = 4;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    // 客户端隔一会儿发一个 ping 看连接还活着没有：这一问一答不用叫醒对象
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** 来了一条连接：地址里带着身份（?role=host&key=… 或 ?role=guest&peer=…） */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    // 不让进的也先接下再关：浏览器看不到握手失败的原因，只能接通了再告诉它
    this.ctx.acceptWebSocket(server);
    const refusal = await this.admit(server, new URL(request.url).searchParams);
    if (refusal !== null) this.dismiss(server, refusal);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** 认身份、安排位置；不让进时返回关闭代码 */
  private async admit(socket: WebSocket, params: URLSearchParams): Promise<number | null> {
    const key = await this.ctx.storage.get<string>('key');
    const role = params.get('role');

    if (role === 'host') {
      const offered = params.get('key') ?? '';
      if (!ROOM_TOKEN.test(offered)) return ROOM_CLOSE.invalid;
      if (key !== undefined && key !== offered) return ROOM_CLOSE.taken;
      if (key === undefined) await this.ctx.storage.put('key', offered);
      this.retire({ role: 'host' });
      socket.serializeAttachment({ role: 'host' } satisfies Seat);
      this.send(socket, { type: 'welcome', role: 'host', peers: this.peers() });
      // 就算是顶替旧连接也说一声：主人可能换了个页面，客人手里的直连得重新商量
      for (const guest of this.guests()) this.send(guest, { type: 'host-joined' });
    } else if (role === 'guest') {
      const peer = params.get('peer') ?? '';
      if (!ROOM_TOKEN.test(peer)) return ROOM_CLOSE.invalid;
      if (key === undefined) return ROOM_CLOSE.missing;
      this.retire({ role: 'guest', peer });
      if (this.peers().length >= this.maxGuests) return ROOM_CLOSE.full;
      socket.serializeAttachment({ role: 'guest', peer } satisfies Seat);
      this.send(socket, { type: 'welcome', role: 'guest', hostOnline: this.host() !== undefined });
      this.send(this.host(), { type: 'peer-joined', peer });
    } else {
      return ROOM_CLOSE.invalid;
    }
    await this.ctx.storage.deleteAlarm();
    return null;
  }

  override webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const seat = seatOf(socket);
    if (!seat) return;

    if (typeof message === 'string') {
      const request = parseRequest(message);
      if (!request) return this.expel(socket, seat);
      if (seat.role === 'guest') {
        this.send(this.host(), { type: 'signal', from: seat.peer, data: request.data });
      } else if (request.to !== undefined) {
        this.send(this.guest(request.to), { type: 'signal', data: request.data });
      }
      return;
    }

    if (message.byteLength > ROOM_FRAME_LIMIT) return this.expel(socket, seat);
    const frame = new Uint8Array(message);
    if (seat.role === 'guest') {
      this.forward(this.host(), addressFrame(seat.peer, frame));
      return;
    }
    const address = readAddress(frame);
    if (!address) return this.expel(socket, seat);
    this.forward(this.guest(address.peer), address.payload);
  }

  override async webSocketClose(socket: WebSocket) {
    await this.left(socket);
  }

  override async webSocketError(socket: WebSocket) {
    await this.left(socket);
  }

  /** 人都走了一阵子了：把房间忘掉（钥匙也忘掉，这个房间号可以给别人用了） */
  override async alarm() {
    if ([...this.seated()].length === 0) await this.ctx.storage.deleteAll();
  }

  // ───── 谁在 ─────

  /** 现在有身份、还连着的连接；except 是正在关的那条（关闭的回调里它可能还在列表里） */
  private *seated(except?: WebSocket): Generator<{ socket: WebSocket; seat: Seat }> {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except || socket.readyState !== WebSocket.OPEN) continue;
      const seat = seatOf(socket);
      if (seat) yield { socket, seat };
    }
  }

  private host(except?: WebSocket): WebSocket | undefined {
    for (const { socket, seat } of this.seated(except)) if (seat.role === 'host') return socket;
    return undefined;
  }

  private guest(peer: string, except?: WebSocket): WebSocket | undefined {
    for (const { socket, seat } of this.seated(except)) {
      if (seat.role === 'guest' && seat.peer === peer) return socket;
    }
    return undefined;
  }

  private guests(): WebSocket[] {
    return [...this.seated()].filter(({ seat }) => seat.role === 'guest').map((it) => it.socket);
  }

  private peers(): string[] {
    return [...this.seated()].flatMap(({ seat }) => (seat.role === 'guest' ? [seat.peer] : []));
  }

  // ───── 进出 ─────

  /** 同一个身份又进来了：旧的那条让位 */
  private retire(seat: Seat) {
    const old = seat.role === 'host' ? this.host() : this.guest(seat.peer);
    if (!old) return;
    this.dismiss(old, ROOM_CLOSE.replaced);
  }

  /** 发来的东西不合约定：请出去，并且当它走了 */
  private expel(socket: WebSocket, seat: Seat) {
    this.dismiss(socket, ROOM_CLOSE.invalid);
    this.announceLeft(seat);
  }

  /** 关掉一条连接并说明原因；先摘掉身份，之后它不再算房间里的人 */
  private dismiss(socket: WebSocket, code: number) {
    socket.serializeAttachment(null);
    this.send(socket, { type: 'closing', code });
    socket.close(code, 'dismissed');
  }

  private async left(socket: WebSocket) {
    const seat = seatOf(socket);
    if (!seat) return;
    this.announceLeft(seat, socket);
    if ([...this.seated(socket)].length === 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    }
  }

  private announceLeft(seat: Seat, gone?: WebSocket) {
    if (seat.role === 'guest') {
      this.send(this.host(gone), { type: 'peer-left', peer: seat.peer });
      return;
    }
    for (const { socket, seat: other } of this.seated(gone)) {
      if (other.role === 'guest') this.send(socket, { type: 'host-left' });
    }
  }

  // ───── 发 ─────

  private send(socket: WebSocket | undefined, event: RoomEvent) {
    this.forward(socket, JSON.stringify(event));
  }

  /** 对面正好在这一刻断了的话 send 会抛错：那条消息丢了就丢了，它的关闭回调随后会来 */
  private forward(socket: WebSocket | undefined, data: string | Uint8Array) {
    try {
      socket?.send(data);
    } catch {
      // 见上
    }
  }
}
