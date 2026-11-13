/** 客户端发给主机的消息 */
export type ClientMessage<Command> =
  /** 一条玩法命令：主机给它盖上“下一步生效”的戳 */
  | { readonly type: 'command'; readonly command: Command }
  /** 调倍速、暂停（整局共用一个时钟） */
  | { readonly type: 'speed'; readonly speed: number }
  | { readonly type: 'pause'; readonly paused: boolean };

/** 主机发给客户端的消息 */
export type HostMessage<View> =
  /** 这一方现在能看到的状态；hash 是完整状态的哈希，用来核对回放与联机 */
  {
    readonly type: 'view';
    readonly tick: number;
    readonly hash: number;
    readonly speed: number;
    readonly paused: boolean;
    readonly view: View;
  };
