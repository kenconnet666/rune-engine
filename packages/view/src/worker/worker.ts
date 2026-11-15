/**
 * 只画界面的渲染线程：整张画布就是照着显示列表画出来的界面（没有地图、场景那样自己的画面）。
 * 主线程那头用 runViewRenderer（run.ts）起它。有自己画面的不用它：把 render 包的 createViewPainter
 * 接到自己的渲染线程里，在主画面之后接着画。
 */
import { createUiRenderer, createViewPainter, type UiRenderer } from '@rune-engine/render';
import type { ViewRendererControl, ViewRendererReport } from './messages.ts';

const report = (message: ViewRendererReport) => self.postMessage(message);

/** 帧率隔多久报一次（毫秒） */
const STATS_MS = 500;

const painter = createViewPainter();
let renderer: UiRenderer | undefined;
let size: { width: number; height: number } | undefined;

async function init({ canvas, stats }: Extract<ViewRendererControl, { type: 'init' }>) {
  renderer = await createUiRenderer({
    canvas,
    layer: painter,
    onLost: (reason) => report({ type: 'lost', reason }),
    onRestored: () => report({ type: 'ready' }),
    onError: (message) => report({ type: 'error', message }),
  });
  if (size) renderer.resize(size.width, size.height);
  let last = 0;
  let since = 0;
  let frames = 0;
  let worstMs = 0;
  const frame = (now: number) => {
    renderer?.render(now);
    if (stats) {
      if (last > 0) worstMs = Math.max(worstMs, now - last);
      last = now;
      frames++;
      if (now - since >= STATS_MS) {
        if (since > 0) report({ type: 'stats', fps: (frames * 1000) / (now - since), worstMs });
        since = now;
        frames = 0;
        worstMs = 0;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  report({ type: 'ready' });
}

self.onmessage = ({ data }: MessageEvent<ViewRendererControl>) => {
  switch (data.type) {
    case 'init':
      init(data).catch((error: unknown) => report({ type: 'error', message: String(error) }));
      break;
    case 'resize':
      size = { width: data.width, height: data.height };
      renderer?.resize(data.width, data.height);
      break;
    default:
      // 界面的消息在画面接上之前就可以到：画的那一层先记着
      painter.handle(data);
  }
};
