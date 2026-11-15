/**
 * 宿主：把一棵界面树接到一张画布上——
 *   - 画布多大、一个 CSS 像素合几个设备像素，跟着页面变；
 *   - 指针、滚轮落在画布上，换算成画布里的位置交给命中和事件（events.ts）；
 *   - 树变了就重排、重列显示列表，发给渲染线程去画。
 *
 * 刷新不等下一帧：树一变，这一轮事件处理完马上排、马上发（Vue 自己的更新在它前头已经做完了），
 * 渲染线程下一帧就能画上。指针位置用的是 pointerrawupdate（一到就发，不像 pointermove 要攒到帧边上）——
 * 量过，这样渲染线程拿到的输入比主线程自己画还新鲜；没有这个事件的浏览器退回 pointermove，多一帧。
 */
import type { ViewMessage } from '@rune-engine/render/view-types';
import type { App, Component } from 'vue';
import { createDisplayBuilder } from './display.ts';
import { createPointerInput } from './events.ts';
import { layoutTree } from './layout.ts';
import { ViewTree, type ViewNode } from './node.ts';
import { createViewApp } from './renderer.ts';
import { createCanvasMeasurer, type TextMeasurer } from './text.ts';

export interface ViewHostOptions {
  /** 排好的东西从这里发给渲染线程（画的那头是 render 包的 createViewPainter） */
  send: (message: ViewMessage, transfer: Transferable[]) => void;
  /** 量文字用的；默认用一块 2D 画布量 */
  measurer?: TextMeasurer;
}

export interface ViewHostStats {
  /** 最近一次重排、列显示列表各花了多久（毫秒）；这一帧列了多少项 */
  layoutMs: number;
  buildMs: number;
  items: number;
  /** 一共刷新了几次 */
  flushes: number;
}

export interface ViewHost {
  readonly tree: ViewTree;
  readonly stats: ViewHostStats;
  /** 把一个 Vue 组件挂上来当整个界面的根；返回的应用可以 unmount */
  mount(root: Component, props?: Record<string, unknown>): App<ViewNode>;
  /** 现在就刷新一遍（平常不用叫：树变了会自己安排） */
  flush(): void;
  dispose(): void;
}

/** 滚轮按“行”报的时候一行算多少像素 */
const WHEEL_LINE = 40;

export function createViewHost(canvas: HTMLCanvasElement, options: ViewHostOptions): ViewHost {
  const { send } = options;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  let pixelRatio = 0;
  let pending = false;
  let disposed = false;
  const stats: ViewHostStats = { layoutMs: 0, buildMs: 0, items: 0, flushes: 0 };

  // 这一轮事件处理完之后马上跑（比等下一帧早）：微任务里 Vue 先把自己的更新做完，再轮到它
  const channel = new MessageChannel();
  const schedule = () => {
    if (pending || disposed) return;
    pending = true;
    channel.port2.postMessage(null);
  };
  const tree = new ViewTree(options.measurer ?? createCanvasMeasurer(), schedule);
  const display = createDisplayBuilder();
  const input = createPointerInput(tree);
  /** 指针现在在画布上的哪里（不在画布上是 null）：内容在它下面变了要重新看指着谁 */
  let pointer: { x: number; y: number } | null = null;

  function flush() {
    pending = false;
    if (disposed || width <= 0 || height <= 0) return;
    stats.flushes++;
    if (tree.needsLayout) {
      const started = performance.now();
      layoutTree(tree, width, height);
      stats.layoutMs = performance.now() - started;
      // 东西挪了位置：指针没动，指着的也可能换了人（这可能又改了样式，那就再排一轮）
      if (pointer) {
        input.move(pointer.x, pointer.y);
        if (tree.needsLayout) layoutTree(tree, width, height);
      }
    }
    if (!tree.needsPaint) return;
    const started = performance.now();
    const frame = display.build(tree, width, height);
    stats.buildMs = performance.now() - started;
    stats.items = frame.count;
    if (frame.runs.length > 0) send({ type: 'view-runs', runs: frame.runs }, []);
    send({ type: 'view-frame', items: frame.items, count: frame.count }, [frame.items.buffer]);
    if (frame.dropped.length > 0) send({ type: 'view-drop-runs', ids: frame.dropped }, []);
    syncCursor();
  }
  channel.port1.onmessage = flush;

  let cursor = '';
  const syncCursor = () => {
    if (input.cursor === cursor) return;
    cursor = input.cursor;
    canvas.style.cursor = cursor;
  };

  // 画布占多大、合多少设备像素（按设备像素量：缩放比不是整数时也准）
  const sized = new ResizeObserver(([entry]) => {
    const box = entry?.devicePixelContentBoxSize?.[0];
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = box && width > 0 ? box.inlineSize / width : devicePixelRatio;
    if (ratio !== pixelRatio) {
      pixelRatio = ratio;
      send({ type: 'view-scale', pixelRatio }, []);
    }
    // 视口变了：根节点的大小跟着变，整个重排（没变的子树自己会跳过）
    tree.invalidateLayout(tree.root);
  });
  sized.observe(canvas, { box: 'device-pixel-content-box' });

  const move = (event: PointerEvent) => {
    pointer = { x: event.offsetX, y: event.offsetY };
    input.move(pointer.x, pointer.y);
    syncCursor();
  };
  const down = (event: PointerEvent) => {
    // 按住拖到画布外面也接着收得到
    canvas.setPointerCapture(event.pointerId);
    pointer = { x: event.offsetX, y: event.offsetY };
    input.down(pointer.x, pointer.y);
    syncCursor();
  };
  const up = (event: PointerEvent) => {
    input.up(event.offsetX, event.offsetY);
    syncCursor();
  };
  const leave = () => {
    pointer = null;
    input.leave();
    syncCursor();
  };
  const wheel = (event: WheelEvent) => {
    const unit = event.deltaMode === 1 ? WHEEL_LINE : event.deltaMode === 2 ? height : 1;
    // 我们滚了就别让页面再跟着滚
    if (input.wheel(event.offsetX, event.offsetY, event.deltaX * unit, event.deltaY * unit)) {
      event.preventDefault();
    }
  };
  const moveEvent = 'onpointerrawupdate' in canvas ? 'pointerrawupdate' : 'pointermove';
  canvas.addEventListener(moveEvent, move as EventListener);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', leave);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('wheel', wheel, { passive: false });

  return {
    tree,
    stats,
    mount(root, props) {
      const app = createViewApp(tree, root, props);
      app.mount(tree.root);
      return app;
    },
    flush,
    dispose() {
      disposed = true;
      sized.disconnect();
      channel.port1.close();
      canvas.removeEventListener(moveEvent, move as EventListener);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', leave);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
    },
  };
}
