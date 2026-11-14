/**
 * 界面采集：把画布里的一层层界面“拍”下来交给渲染线程去贴（贴的那头是 render 包的界面合成器，约定见它的 ui-types.ts）。
 * 舞台（Stage.tsx）用它；不用舞台、自己摆画布的也可以直接用。
 *
 * 一层是画布里一个带 drawable 属性的元素。这里做三件事：
 *   - 让每一层和画布一样大（它在画布里排版出来的位置没有意义，画在哪由我们定：铺满）
 *   - 浏览器说“这几层的样子变了”（画布的 paint 事件）时把它们重新拍下来发过去——一帧只拍一层，轮流来
 *   - 告诉浏览器每一层画在哪：这样点击、悬停、读屏才落得到里面的元素上。后登记的层在上面
 *
 * 这套接口（HTML-in-Canvas）只有新的 Chrome 有：canvasUiSupported() 是 false 时别把界面放进画布（放进去就看不见了），
 * 照老办法叠在画布上面。
 */
import {
  PLAIN_MATERIAL,
  type ElementImage,
  type UiMaterial,
  type UiMessage,
} from '@rune-engine/render/ui-types';

/** 画布上和界面层有关的那几个方法（还没进 TypeScript 自带的声明） */
interface DrawableCanvas extends HTMLCanvasElement {
  captureElementImage(element: Element): ElementImage;
  getElementImageDefaultSize(element: Element): { width: number; height: number };
  updateElementGeometry(element: Element, options: { canvasTransform?: DOMMatrixInit }): void;
  requestPaint(): void;
}

interface CanvasPaintEvent extends Event {
  readonly changedElements: readonly Element[];
}

export const canvasUiSupported = (): boolean =>
  typeof HTMLCanvasElement !== 'undefined' &&
  'captureElementImage' in HTMLCanvasElement.prototype &&
  'updateElementGeometry' in HTMLCanvasElement.prototype;

export interface CanvasUiLayer {
  /** 这一层怎么贴（没写的项保持原样）；durationMs 大于 0 时从现在的样子过渡过去 */
  set(material: Partial<UiMaterial>, durationMs?: number): void;
  /** 现在的贴法（过渡的终点） */
  readonly material: UiMaterial;
  remove(): void;
}

export interface CanvasUi {
  /** 登记一层：element 是画布里一个带 drawable 属性的元素；order 大的在上面 */
  addLayer(element: HTMLElement, order: number): CanvasUiLayer;
  /** 接上渲染线程：之后拍下来的都从 send 发出去 */
  connect(send: (message: UiMessage, transfer: Transferable[]) => void): void;
  /** 渲染线程那头的贴图没了（刚起来、显卡设备重建了）：全部重拍一遍 */
  refresh(): void;
  dispose(): void;
}

interface Layer {
  readonly id: number;
  readonly element: HTMLElement;
  readonly order: number;
  material: UiMaterial;
  /** 还没拍过，或者样子变了、该重拍 */
  stale: boolean;
  /** 渲染线程那头现在有它的画面 */
  drawn: boolean;
  /** 上一次是第几轮拍的：都等着拍的时候，等得最久的先拍 */
  turn: number;
}

/** 一层的贴法对应的变换（CSS 像素，绕画布中心）：命中测试要跟着画的位置走 */
function transformOf(material: UiMaterial, width: number, height: number): DOMMatrix {
  return new DOMMatrix()
    .translate(material.x + width / 2, material.y + height / 2)
    .rotate((material.rotate * 180) / Math.PI)
    .scale(material.scale)
    .translate(-width / 2, -height / 2);
}

export interface CanvasUiOptions {
  /**
   * 一秒里最多重画多少像素（百万像素，各层加在一起），默认 90。重拍一层就是把一整层重新画一遍，
   * 花的时间跟像素数走：1600×900 的窗口一秒能拍六十次，4K 的屏幕就只有十来次——再多，帧就开始等了
   * （不是主线程卡住，是这一帧迟迟交不出去）。
   */
  pixelBudget?: number;
}

/** 再小的窗口一秒也不拍超过这么多次；再大的屏幕一秒也至少拍这么多次 */
const MAX_RATE = 60;
const MIN_RATE = 10;
/** 刚操作过界面（指针、键盘落在界面上）的这段时间里不讲节奏：按下、悬停要马上看到反应 */
const INPUT_MS = 150;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'keydown', 'wheel', 'input'];

export function createCanvasUi(
  target: HTMLCanvasElement,
  { pixelBudget = 90 }: CanvasUiOptions = {},
): CanvasUi {
  const canvas = target as DrawableCanvas;
  /** 上一次拍的那层有多少像素（设备像素）：按它算两次拍之间隔多久 */
  let pixels = 0;
  let lastAt = -Infinity;
  let waiting: ReturnType<typeof setTimeout> | undefined;
  let inputAt = -Infinity;
  const touched = (event: Event) => {
    // 落在画布自己身上的是在动地图，不算操作界面
    if (event.target !== canvas) inputAt = performance.now();
  };
  for (const type of INPUT_EVENTS) canvas.addEventListener(type, touched, { passive: true });
  const layers: Layer[] = [];
  let send: ((message: UiMessage, transfer: Transferable[]) => void) | undefined;
  let nextId = 1;
  let turn = 0;

  /** 各层和画布一样大（CSS 像素） */
  const fit = () => {
    const width = `${canvas.clientWidth}px`;
    const height = `${canvas.clientHeight}px`;
    for (const { element } of layers) {
      // 没变就不写：写了样式会被下面的 restyled 当成“这层变了”
      if (element.style.width !== width) element.style.width = width;
      if (element.style.height !== height) element.style.height = height;
    }
  };
  const observer = new ResizeObserver(() => {
    fit();
    place();
  });
  observer.observe(canvas);
  // 一层自己被藏起来（display:none、visibility:hidden）时浏览器不一定马上发 paint——它等的是“有东西要重画”。
  // 层元素的样式、类名一变就请它补发一次，好及时把这层的旧画面收掉
  const restyled = new MutationObserver(() => canvas.requestPaint());

  /** 告诉浏览器各层画在哪。按从下到上的顺序说：后说的在命中测试里排在上面 */
  function place() {
    for (const layer of layers) {
      canvas.updateElementGeometry(layer.element, {
        canvasTransform: transformOf(layer.material, canvas.clientWidth, canvas.clientHeight),
      });
    }
  }

  /** 一层没有画面可拍了：渲染线程那头要是还留着它之前的画面，收掉（不然藏起来的界面还画在那里） */
  function vanish(layer: Layer) {
    if (!layer.drawn) return;
    layer.drawn = false;
    send?.({ type: 'ui-clear', layer: layer.id }, []);
  }

  /** 这一层现在有没有画面可拍 */
  const visible = (layer: Layer) => {
    try {
      canvas.getElementImageDefaultSize(layer.element);
      return true;
    } catch {
      return false;
    }
  };

  /** 拍一层发出去；拍不下来（这一层现在没有画面）是 false */
  function capture(layer: Layer): boolean {
    if (!send) return false;
    let image: ElementImage;
    let size: { width: number; height: number };
    try {
      image = canvas.captureElementImage(layer.element);
      size = canvas.getElementImageDefaultSize(layer.element);
    } catch {
      // 刚放进来还没画过、尺寸是 0，或者被藏起来了：它接着算“该重拍”，之后的 paint 再试
      vanish(layer);
      return false;
    }
    layer.stale = false;
    layer.drawn = true;
    layer.turn = ++turn;
    pixels = size.width * size.height;
    send(
      {
        type: 'ui-image',
        layer: layer.id,
        order: layer.order,
        image,
        width: Math.round(size.width),
        height: Math.round(size.height),
        pixelRatio: canvas.clientWidth > 0 ? size.width / canvas.clientWidth : devicePixelRatio,
      },
      [image as unknown as Transferable],
    );
    return true;
  }

  /**
   * 一次只拍一层，两次之间隔一会儿（隔多久看 pixelBudget）。实测（Chrome 157，真窗口，160 Hz 的屏）：
   *   1600×900：不讲节奏、两层同帧拍，一秒 46 帧；一次一层、一秒最多 60 次，一秒 128 帧（界面叠在画布上面时是 139）
   *   4K：一秒拍 30 次时每 4 秒有十几个超过 50 毫秒的帧；降到十来次就没有了
   * 而界面里只要有个循环的小动画、进度条在过渡，那一层就每帧都在变。所以该重拍的层排着队，等得最久的先拍。
   * 两种情况不排队：还没有画面的层（界面刚搬进画布、显卡设备刚重建：缺一层就是少一块界面），和刚操作过界面的时候。
   */
  const paint = (event: Event) => {
    const changed = new Set((event as CanvasPaintEvent).changedElements);
    for (const layer of layers) {
      if (changed.has(layer.element)) layer.stale = true;
      // 整层 display:none 的时候它不在“变了的”里面，只能自己问一下
      else if (layer.drawn && !visible(layer)) vanish(layer);
    }
    for (const layer of layers) {
      if (layer.stale && !layer.drawn) capture(layer);
    }
    const due = layers
      .filter((layer) => layer.stale && layer.drawn)
      .sort((a, b) => a.turn - b.turn);
    if (due.length === 0) return;
    const now = performance.now();
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, (pixelBudget * 1e6) / Math.max(1, pixels)));
    // 留两毫秒的余量：免得刚好卡在帧的边上多等一帧
    const wait = now - inputAt < INPUT_MS ? 0 : lastAt + 1000 / rate - 2 - now;
    if (wait > 0) {
      // 到点了再请浏览器发一次 paint（这些层自己不一定又变了）
      waiting ??= setTimeout(() => {
        waiting = undefined;
        canvas.requestPaint();
      }, wait);
      return;
    }
    const sent = due.findIndex((layer) => capture(layer));
    if (sent < 0) return;
    lastAt = now;
    // 后面还有排着的：下一轮接着拍
    if (sent < due.length - 1) canvas.requestPaint();
  };
  canvas.addEventListener('paint', paint);

  const sendMaterial = (layer: Layer, durationMs: number) =>
    send?.({ type: 'ui-material', layer: layer.id, material: layer.material, durationMs }, []);

  return {
    addLayer(element, order) {
      const layer: Layer = {
        id: nextId++,
        element,
        order,
        material: PLAIN_MATERIAL,
        stale: true,
        drawn: false,
        turn: 0,
      };
      // 按 order 插到位：命中测试的上下和画的上下是同一个顺序
      const at = layers.findIndex((other) => other.order > order);
      layers.splice(at < 0 ? layers.length : at, 0, layer);
      restyled.observe(element, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
      fit();
      place();
      canvas.requestPaint();
      return {
        get material() {
          return layer.material;
        },
        set(material, durationMs = 0) {
          layer.material = { ...layer.material, ...material };
          sendMaterial(layer, durationMs);
          place();
        },
        remove() {
          const index = layers.indexOf(layer);
          if (index < 0) return;
          layers.splice(index, 1);
          send?.({ type: 'ui-remove', layer: layer.id }, []);
        },
      };
    },
    connect(next) {
      send = next;
      this.refresh();
    },
    refresh() {
      for (const layer of layers) {
        layer.stale = true;
        layer.drawn = false;
        sendMaterial(layer, 0);
      }
      canvas.requestPaint();
    },
    dispose() {
      observer.disconnect();
      restyled.disconnect();
      clearTimeout(waiting);
      for (const type of INPUT_EVENTS) canvas.removeEventListener(type, touched);
      canvas.removeEventListener('paint', paint);
      // 渲染线程那头的贴图也收掉：不然这些层搬出画布以后还留着一份旧的画在那里
      for (const layer of layers) send?.({ type: 'ui-remove', layer: layer.id }, []);
      send = undefined;
      layers.length = 0;
    },
  };
}
