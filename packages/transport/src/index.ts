/**
 * 浏览器这头和服务端打交道的部分。
 * 联机：上层拿到的是 net 包的 Wire（一条收发字节的线），脚下是什么不用管——
 *   房间（服务端的，或者同一个浏览器里不经服务器的）让两头找到彼此；
 *   能直连就直连（WebRTC），不能就经房间中转。
 * 云存档：存档柜的客户端（vault-client.ts）。
 */
export { PUBLIC_STUN } from './direct.ts';
export { guestRoom, type GuestRoom } from './guest-room.ts';
export { hostRoom, type GuestLink, type HostRoom } from './host-room.ts';
export type { RoomLinkOptions } from './link.ts';
export { localRoom } from './local-room.ts';
export {
  connectRoom,
  type ConnectRoomOptions,
  type RoomClient,
  type RoomCloseReason,
  type RoomStatus,
} from './room-client.ts';
export {
  connectVault,
  gunzipText,
  gzipText,
  VaultError,
  type ConnectVaultOptions,
  type VaultClient,
  type VaultFailure,
} from './vault-client.ts';
