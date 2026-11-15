/**
 * 给一张画布起一条只画界面的渲染线程：整页都是自己画的界面时用它——
 *
 *   const renderer = runViewRenderer(canvas);
 *   const host = createViewHost(canvas, { send: renderer.send });
 *   host.mount(App);
 *
 * 画布交给渲染线程之后主线程不能再改它的宽高，尺寸变了由这里告诉那头。
 * 有自己画面的（游戏）不用它：把 render 包的 createViewPainter 接到自己的渲染线程里。
 */
import type { ViewMessage } from '@rune-engine/render/view-types';
import type { ViewRendererControl, ViewRendererReport, ViewRendererStats } from './messages.ts';

export type { ViewRendererStats };

export interface ViewRendererOptions {
  /** 渲染线程的帧率，半秒报一次（给了才报） */
  onStats?: (stats: ViewRendererStats) => void;
  /** 画面接上了（刚起来、显卡设备重建好了） */
  onReady?: () => void;
  onError?: (message: string) => void;
}

export interface ViewRenderer {
  /** 界面的消息发给渲染线程（交给 createViewHost 的 send） */
  send: (message: ViewMessage, transfer?: Transferable[]) => void;
  /** 收掉渲染线程 */
  stop(): void;
}

export function runViewRenderer(
  canvas: HTMLCanvasElement,
  options: ViewRendererOptions = {},
): ViewRenderer {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const post = (message: ViewRendererControl, transfer: Transferable[] = []) =>
    worker.postMessage(message, transfer);

  worker.onmessage = ({ data }: MessageEvent<ViewRendererReport>) => {
    switch (data.type) {
      case 'ready':
        options.onReady?.();
        break;
      case 'stats':
        options.onStats?.(data);
        break;
      case 'lost':
        // 设备在那头自己重建，画的那一层留着显示列表，重建好了接着画
        break;
      case 'error':
        (options.onError ?? console.error)(data.message);
        break;
    }
  };

  // 按设备像素量，缩放比不是整数时也不发虚
  const observer = new ResizeObserver(([entry]) => {
    const box = entry?.devicePixelContentBoxSize?.[0];
    const width = box?.inlineSize ?? Math.round(canvas.clientWidth * devicePixelRatio);
    const height = box?.blockSize ?? Math.round(canvas.clientHeight * devicePixelRatio);
    if (width > 0 && height > 0) post({ type: 'resize', width, height });
  });
  observer.observe(canvas, { box: 'device-pixel-content-box' });

  const offscreen = canvas.transferControlToOffscreen();
  post({ type: 'init', canvas: offscreen, stats: Boolean(options.onStats) }, [offscreen]);

  return {
    send: post,
    stop() {
      observer.disconnect();
      worker.terminate();
    },
  };
}
