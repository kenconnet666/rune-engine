/** 只画界面的渲染线程（worker.ts）和主线程（run.ts）之间的消息 */
import type { ViewMessage } from '@rune-engine/render/view-types';

/** 主线程 → 渲染线程 */
export type ViewRendererControl =
  | {
      readonly type: 'init';
      readonly canvas: OffscreenCanvas;
      /** 要不要报帧率（见 ViewRendererStats） */
      readonly stats?: boolean;
    }
  /** 画布的像素尺寸变了 */
  | { readonly type: 'resize'; readonly width: number; readonly height: number }
  | ViewMessage;

/** 渲染线程 → 主线程 */
export type ViewRendererReport =
  /** 画面接上了（刚起来、设备重建好了） */
  | { readonly type: 'ready' }
  /** 显卡设备丢了，正在重建 */
  | { readonly type: 'lost'; readonly reason: string }
  | ({ readonly type: 'stats' } & ViewRendererStats)
  | { readonly type: 'error'; readonly message: string };

/** 渲染线程刚过去这一小段的帧率 */
export interface ViewRendererStats {
  /** 一秒画了几帧 */
  readonly fps: number;
  /** 最长的一帧隔了多久（毫秒） */
  readonly worstMs: number;
}
