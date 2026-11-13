/**
 * 浏览器里的联机连接。上层拿到的是 net 包的 Wire（一条收发字节的线），脚下是什么不用管：
 *   房间（服务端的，或者同一个浏览器里不经服务器的）让两头找到彼此；
 *   能直连就直连（WebRTC），不能就经房间中转。
 */
export { PUBLIC_STUN } from './direct.ts';
export { guestRoom, type GuestRoom } from './guest-room.ts';
export { hostRoom, type GuestLink, type HostRoom, type RoomLinkOptions } from './host-room.ts';
export { localRoom } from './local-room.ts';
export {
  connectRoom,
  type ConnectRoomOptions,
  type RoomClient,
  type RoomCloseReason,
  type RoomStatus,
} from './room-client.ts';
