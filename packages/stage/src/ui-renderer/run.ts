/**
 * 给一个“只有界面”的舞台接上渲染线程：整站都是界面的页面（组件库的文档站）不用自己写渲染线程，
 * 在舞台的 onReady 里叫它就行——
 *
 *   <Stage onReady={(stage) => runUiRenderer(stage)}>…</Stage>
 *
 * 画面接上之后界面搬进画布；显卡设备丢了搬回画布上面，重建好了再搬回去。浏览器不支持时什么也不做。
 * 有自己画面的（游戏的地图）不用它：把合成器接到自己的渲染线程里（render 包的 createUiCompositor）。
 */
import type { StageHandle } from '../Stage.tsx';
import type { UiRendererControl, UiRendererReport } from './messages.ts';

export interface UiRendererRunOptions {
  /** 一块块显现时亮边的颜色（RGB，各 0–1） */
  glow?: readonly [number, number, number];
  onError?: (message: string) => void;
}

/** 返回停止的函数（渲染线程收掉，界面搬回画布上面） */
export function runUiRenderer(stage: StageHandle, options: UiRendererRunOptions = {}): () => void {
  if (!stage.supported) return () => {};
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const send = (message: UiRendererControl, transfer: Transferable[] = []) =>
    worker.postMessage(message, transfer);

  worker.onmessage = ({ data }: MessageEvent<UiRendererReport>) => {
    switch (data.type) {
      case 'ready':
        stage.setLive(true);
        break;
      case 'lost':
        stage.setLive(false);
        break;
      case 'ui-request':
        stage.refresh();
        break;
      case 'error':
        (options.onError ?? console.error)(data.message);
        break;
    }
  };

  const { canvas } = stage;
  // 画布交给渲染线程之后主线程不能再改它的宽高：尺寸变了告诉那头。
  // 按设备像素量，缩放比不是整数时也不发虚（和 runtime 包的 observeCanvasSize 是同一件事；舞台不依赖那个包）
  const observer = new ResizeObserver(([entry]) => {
    const box = entry?.devicePixelContentBoxSize?.[0];
    const width = box?.inlineSize ?? Math.round(canvas.clientWidth * devicePixelRatio);
    const height = box?.blockSize ?? Math.round(canvas.clientHeight * devicePixelRatio);
    if (width > 0 && height > 0) send({ type: 'resize', width, height });
  });
  observer.observe(canvas, { box: 'device-pixel-content-box' });

  const offscreen = canvas.transferControlToOffscreen();
  send({ type: 'init', canvas: offscreen, glow: options.glow }, [offscreen]);
  stage.connect(send);

  return () => {
    observer.disconnect();
    stage.setLive(false);
    worker.terminate();
  };
}
