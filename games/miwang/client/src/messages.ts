/** 主线程和两个 Worker 之间的控制消息（对局本身的消息走 net 的会话协议，见各自收到的 port） */
import type { Command, OutbreakConfig } from '@miwang/sim';
import type { PlayerId, Recording } from '@rune-engine/core';

export type GameRecording = Recording<OutbreakConfig, Command>;

/** 主线程 → 主机 Worker */
export type HostControl =
  /** 开一局，或者拿着记录接着走（刷新之后） */
  | {
      readonly type: 'start';
      readonly start: { config: OutbreakConfig } | { recording: GameRecording };
      readonly stepMs: number;
    }
  /** 接上一方；同一个 id 再接一次会先断开上一次的（换视角） */
  | {
      readonly type: 'connect';
      readonly id: string;
      readonly player: PlayerId;
      readonly readonly: boolean;
      readonly port: MessagePort;
    }
  /** 哪一方由电脑控制；null 是都不要（两边都是人） */
  | { readonly type: 'ai'; readonly player: PlayerId | null }
  /** 开一个房间：另一位玩家凭房间号接进来 */
  | { readonly type: 'open-room'; readonly room: string };

/** 主机 Worker → 主线程 */
export type HostReport =
  | { readonly type: 'recording'; readonly recording: GameRecording }
  /** 主机起来了：是不是照着记录重放的，重放了几步、用了多久 */
  | { readonly type: 'started'; readonly replayedTicks: number; readonly replayMs: number }
  /** 另一位玩家接进来了，扮演的是 player 这一方 */
  | { readonly type: 'joined'; readonly player: PlayerId };

/** 主线程 → 渲染 Worker */
export type RenderControl =
  | {
      readonly type: 'init';
      readonly canvas: OffscreenCanvas;
      readonly meshUrl: string;
      readonly regionCount: number;
    }
  | { readonly type: 'resize'; readonly width: number; readonly height: number }
  /** 对局的状态从这个 port 来 */
  | { readonly type: 'connect'; readonly port: MessagePort }
  /** 对局的状态从这个名字的广播通道来（作为客人加入别人的房间时） */
  | { readonly type: 'connect-channel'; readonly name: string };

/** 渲染 Worker → 主线程 */
export type RenderReport =
  { readonly type: 'ready' } | { readonly type: 'error'; readonly message: string };

/**
 * 房间里的招呼（广播通道 `miwang:<房间号>`）：客人报上自己的通道名和要扮演的一方，
 * 主机在 `miwang:<房间号>:<client>` 这条通道上把它当成一个普通的客户端接上。
 * 现在走的是浏览器的广播通道，只能连同一台电脑、同一个浏览器里的标签页；换成 WebRTC 之后招呼的内容不变。
 */
export type RoomMessage =
  | {
      readonly type: 'join';
      readonly client: string;
      readonly player: PlayerId;
      readonly readonly: boolean;
    }
  | { readonly type: 'welcome'; readonly client: string };

export const roomChannel = (room: string) => `miwang:${room}`;
export const clientChannel = (room: string, client: string) => `miwang:${room}:${client}`;
