/** 房间的两头（host-room.ts、guest-room.ts）共用的选项和门槛 */

export interface RoomLinkOptions {
  /** 要不要试直连（不经服务器的房间用不着）。默认试 */
  readonly direct?: boolean;
  readonly iceServers?: RTCIceServer[];
}

/** 发送队列里压了这么多字节就算堵了：这时“只要最新一份”的消息先别发 */
export const CONGESTED_BYTES = 512 * 1024;
