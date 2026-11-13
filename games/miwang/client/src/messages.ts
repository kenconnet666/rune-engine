/**
 * 主线程和两个 Worker 之间的控制消息（对局本身的消息走 net 的会话协议，见各自收到的 port），
 * 以及联机时两位玩家的页面之间说的话。
 */
import type { AiLevel, Command, OutbreakConfig, OutbreakView } from '@miwang/sim';
import type { PlayerId, Recording } from '@rune-engine/core';
import type { ClientMessage, HostMessage } from '@rune-engine/net';
import type { MapPaletteName } from '@rune-engine/render';
import type { MapCamera } from '@rune-engine/render/map-view';

export type GameRecording = Recording<OutbreakConfig, Command>;

/** 主线程 → 主机 Worker */
export type HostControl =
  /** 开一局；或者拿着记录接着走（读档、刷新之后）；或者回放一份记录（从第 from 天放起） */
  | {
      readonly type: 'start';
      readonly start:
        | { config: OutbreakConfig }
        | { recording: GameRecording }
        | { playback: GameRecording; from?: number };
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
  /** 断开一方（联机的另一位玩家走了） */
  | { readonly type: 'disconnect'; readonly id: string }
  /** 哪一方由电脑控制、多大难度；player 是 null 表示都不要（两边都是人） */
  | { readonly type: 'ai'; readonly player: PlayerId | null; readonly level: AiLevel };

/** 主机 Worker → 主线程 */
export type HostReport =
  | { readonly type: 'recording'; readonly recording: GameRecording }
  /** 主机起来了：是不是照着记录重放的，重放了几步、用了多久 */
  | { readonly type: 'started'; readonly replayedTicks: number; readonly replayMs: number };

/** 主线程 → 渲染 Worker */
export type RenderControl =
  | {
      readonly type: 'init';
      readonly canvas: OffscreenCanvas;
      readonly meshUrl: string;
      /** 更细的那份网格：先用粗的把画面画出来，再在后台加载它 */
      readonly detailUrl: string;
      readonly regionCount: number;
    }
  | { readonly type: 'resize'; readonly width: number; readonly height: number }
  /** 对局的状态从这个 port 来 */
  | { readonly type: 'connect'; readonly port: MessagePort }
  | { readonly type: 'camera'; readonly camera: MapCamera }
  /** 指针在画布上的位置（占画布宽高的比例，0–1）；离开画布时是 null。tap 是在那里点了一下 */
  | {
      readonly type: 'pointer';
      readonly at: { readonly x: number; readonly y: number } | null;
      readonly tap: boolean;
    }
  /** 选中的地区（下标），没有时是 -1 */
  | { readonly type: 'select'; readonly region: number }
  /** 换一套色带 */
  | { readonly type: 'palette'; readonly name: MapPaletteName }
  /** 开发时用：把显卡设备弄丢，看画面能不能自己恢复 */
  | { readonly type: 'lose-device' }
  /** 开发时用：问一下最近这段时间画得多快 */
  | { readonly type: 'stats' };

/** 渲染 Worker → 主线程 */
export type RenderReport =
  /** 画面接上了：第一次建好，或者显卡设备丢了以后重建好 */
  | { readonly type: 'ready' }
  /** 显卡设备丢了，画面停了，正在自己重建 */
  | { readonly type: 'lost'; readonly message: string }
  /** 指针停在哪个地区上（下标，海上是 -1）；picked 表示在那里点了一下 */
  | { readonly type: 'region'; readonly region: number; readonly picked: boolean }
  | { readonly type: 'error'; readonly message: string }
  /** 最近一段时间的帧率，和每帧在这个线程里花的时间（毫秒：平均、最长） */
  | {
      readonly type: 'stats';
      readonly fps: number;
      readonly frameMs: number;
      readonly worstMs: number;
    };

/**
 * 联机：主机在主人的浏览器里，客人的页面经房间连过来（见 session/room.ts）。两个页面之间除了会话协议本身，
 * 只多几句话——客人进来打招呼，主人告诉它扮演哪一方；之后就是普通的客户端了。
 */
/** 主人的页面 → 客人的页面 */
export type GuestDown =
  /** 你扮演这一方（开局时、主人换边时都会说） */
  | { readonly type: 'seat'; readonly player: PlayerId }
  /** 这一局已经有另一位玩家了 */
  | { readonly type: 'full' }
  | HostMessage<OutbreakView>;

/** 客人的页面 → 主人的页面 */
export type GuestUp =
  /** 我来了（还没被安排位置的时候隔一会儿说一次） */
  { readonly type: 'hello' } | ClientMessage<Command>;
