/**
 * 房间：让两台设备上的浏览器找到彼此的地方。房间自己不懂游戏，只做三件事——
 *   1. 记住谁在：一位主人（开房间的人，主机在他的浏览器里）和几位客人；谁来了、谁走了告诉对面；
 *   2. 递纸条（signal）：两头商量怎么直连（WebRTC 的 offer / answer / candidate）时互相传的话；
 *   3. 中转（二进制帧）：直连打不通时，对局的消息经房间转一手。
 * 客人之间不互通：客人的话只到主人，主人的话指名给某位客人。
 *
 * 这里是两头（浏览器里的连接层、服务端的房间）共用的约定；实现各在各处。
 */

/** 房间号：好念好抄的 4–8 位大写字母与数字（不含容易看混的 0 O 1 I L） */
export const ROOM_CODE = /^[A-HJ-KM-NP-Z2-9]{4,8}$/;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** 客人的标识、主人的钥匙：4–32 位小写字母与数字，各自随机生成 */
export const ROOM_TOKEN = /^[a-z0-9]{4,32}$/;
const TOKEN_LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

const pick = (letters: string, length: number, random: () => number) =>
  Array.from({ length }, () => letters[Math.floor(random() * letters.length)]).join('');
/** 随机的房间号；random 给 0–1 的随机数（这个包里不自己取随机数，由调用方给） */
export const roomCode = (random: () => number, length = 6) => pick(CODE_LETTERS, length, random);
export const roomToken = (random: () => number, length = 12) => pick(TOKEN_LETTERS, length, random);

/** 进房间时报的身份：主人带钥匙（同一把钥匙才能再以主人的身份进来），客人带自己的标识 */
export type RoomSeat =
  | { readonly role: 'host'; readonly key: string }
  | { readonly role: 'guest'; readonly peer: string };

/** 客户端 → 房间（文本帧）：递一张纸条。主人要写给谁（to），客人的只会到主人 */
export interface RoomRequest {
  readonly type: 'signal';
  readonly to?: string;
  readonly data: unknown;
}

/** 房间 → 客户端（文本帧） */
export type RoomEvent =
  /** 进来了。主人得知现在有哪些客人，客人得知主人在不在 */
  | { readonly type: 'welcome'; readonly role: 'host'; readonly peers: readonly string[] }
  | { readonly type: 'welcome'; readonly role: 'guest'; readonly hostOnline: boolean }
  /** 给主人的：来了一位客人、走了一位客人 */
  | { readonly type: 'peer-joined'; readonly peer: string }
  | { readonly type: 'peer-left'; readonly peer: string }
  /** 给客人的：主人来了（也可能是换了个页面又进来）、主人走了 */
  | { readonly type: 'host-joined' }
  | { readonly type: 'host-left' }
  /** 对面递来的纸条；主人收到的带着是哪位客人写的 */
  | { readonly type: 'signal'; readonly from?: string; readonly data: unknown }
  /**
   * 房间要关掉这条连接了，code 是下面 ROOM_CLOSE 里的一个。紧跟着连接就会关（关闭代码也是它），
   * 但关闭的握手要等两头都点头，收到这句话的一方可以直接当作已经关了。
   */
  | { readonly type: 'closing'; readonly code: number };

/** 房间主动关掉连接的原因（也用作 WebSocket 的关闭代码，4000–4999 留给应用自己定） */
export const ROOM_CLOSE = {
  /** 发来的东西不合约定 */
  invalid: 4000,
  /** 这个房间号已经有别的主人了 */
  taken: 4001,
  /** 客人满了 */
  full: 4003,
  /** 没有这个房间（没人开过，或者散了很久） */
  missing: 4004,
  /** 同一个身份从别处又进来了，这条旧的让位 */
  replaced: 4005,
} as const;

/** 中转帧的大小上限（字节）：一份完整的状态远小于它，超了多半是有人乱发 */
export const ROOM_FRAME_LIMIT = 256 * 1024;
/** 纸条的大小上限（字符）：一份 SDP 几千个字符 */
export const ROOM_SIGNAL_LIMIT = 16 * 1024;

/**
 * 主人那一头的中转帧前面带着客人的标识：[1 字节：标识的长度][标识][内容]。
 * 主人发的由房间拆掉前缀转给那位客人；客人发的由房间加上前缀转给主人。
 */
export function addressFrame(peer: string, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(1 + peer.length + payload.byteLength);
  frame[0] = peer.length;
  for (let i = 0; i < peer.length; i++) frame[1 + i] = peer.charCodeAt(i);
  frame.set(payload, 1 + peer.length);
  return frame;
}

/** 拆出前缀；格式不对时返回 null。payload 是 frame 的一段，不拷贝 */
export function readAddress(frame: Uint8Array): { peer: string; payload: Uint8Array } | null {
  const length = frame[0];
  if (length === undefined || frame.byteLength < 1 + length) return null;
  const peer = String.fromCharCode(...frame.subarray(1, 1 + length));
  if (!ROOM_TOKEN.test(peer)) return null;
  return { peer, payload: frame.subarray(1 + length) };
}
