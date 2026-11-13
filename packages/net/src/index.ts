/**
 * 对局的主机与会话。单机时主机在本机的 Worker 里，联机时在创建者的浏览器里、另一方经网络连上来：
 * 两种情况客户端的代码一样，换的只是脚下那条消息通道（Worker 消息、WebRTC、WebSocket 中转）。
 */
export { connectSession, type Session, type SessionHandlers } from './client.ts';
export { decodeMessage, encodeMessage } from './codec.ts';
export { createHost, type Host, type HostOptions } from './host.ts';
export { createPortPair, type Port } from './port.ts';
export type { ClientMessage, HostMessage } from './protocol.ts';
export {
  addressFrame,
  readAddress,
  ROOM_CLOSE,
  ROOM_CODE,
  ROOM_FRAME_LIMIT,
  ROOM_SIGNAL_LIMIT,
  ROOM_TOKEN,
  roomCode,
  roomToken,
  type RoomEvent,
  type RoomRequest,
  type RoomSeat,
} from './room.ts';
export { portOverWire, throttleLatest, type Wire } from './wire.ts';
