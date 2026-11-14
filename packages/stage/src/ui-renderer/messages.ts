/** 只画界面的渲染线程（worker.ts）和主线程（run.ts）之间的消息 */
import type { UiMessage } from '@rune-engine/render/ui-types';

/** 主线程 → 渲染线程 */
export type UiRendererControl =
  | {
      readonly type: 'init';
      readonly canvas: OffscreenCanvas;
      /** 一块块显现时亮边的颜色（RGB，各 0–1） */
      readonly glow?: readonly [number, number, number];
    }
  | { readonly type: 'resize'; readonly width: number; readonly height: number }
  | UiMessage;

/** 渲染线程 → 主线程 */
export type UiRendererReport =
  /** 画面接上了（刚起来、设备重建好了） */
  | { readonly type: 'ready' }
  /** 显卡设备丢了，正在重建 */
  | { readonly type: 'lost'; readonly reason: string }
  /** 贴图都没了：把各层重新拍一遍 */
  | { readonly type: 'ui-request' }
  | { readonly type: 'error'; readonly message: string };
