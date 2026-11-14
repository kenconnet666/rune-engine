/**
 * 只画界面的渲染线程：整张画布就是各层界面叠起来（没有地图、场景那样自己的画面）。
 * 主线程那头用 runUiRenderer（run.ts）起它。
 */
import { createUiCompositor, createUiRenderer, type UiRenderer } from '@rune-engine/render';
import type { UiRendererControl, UiRendererReport } from './messages.ts';

const report = (message: UiRendererReport) => self.postMessage(message);

let renderer: UiRenderer | undefined;
let size: { width: number; height: number } | undefined;
/** 合成器建好之前到的界面消息先留着 */
let handle:
  ((message: Exclude<UiRendererControl, { type: 'init' | 'resize' }>) => void) | undefined;

/** 帧率隔多久报一次（毫秒） */
const STATS_MS = 500;

async function init({ canvas, glow, stats }: Extract<UiRendererControl, { type: 'init' }>) {
  const ui = createUiCompositor({ report, glow });
  handle = (message) => ui.handle(message);
  renderer = await createUiRenderer({
    canvas,
    layer: ui,
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

self.onmessage = ({ data }: MessageEvent<UiRendererControl>) => {
  switch (data.type) {
    case 'init':
      init(data).catch((error: unknown) => report({ type: 'error', message: String(error) }));
      break;
    case 'resize':
      size = { width: data.width, height: data.height };
      renderer?.resize(data.width, data.height);
      break;
    default:
      handle?.(data);
  }
};
