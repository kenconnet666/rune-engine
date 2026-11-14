/**
 * 界面采集：把画布里的一层层界面“拍”下来交给渲染线程去贴（贴的那头是 render 包的界面合成器，约定见它的 ui-types.ts）。
 * 舞台（Stage.tsx）用它；不用舞台、自己摆画布的也可以直接用。
 *
 * 一层是画布里一个带 drawable 属性的元素。这里做三件事：
 *   - 铺满的层和画布一样大；只有内容那么大的层自己定大小、由使用方说放在哪
 *     （元素在画布里排版出来的位置没有意义，画在哪由我们定）
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
  /** 把这一层的左上角放到画布上的 (x, y)（CSS 像素）。不用重拍：只是换个地方贴，命中测试跟着走 */
  moveTo(x: number, y: number): void;
  /**
   * 这一层里有个滚动的盒子（scroller），滚动的内容在层里占 region 说的那一块（CSS 像素，相对这一层的左上角；
   * 粘在边上不跟着滚的东西——顶栏、侧栏——不算在里面）。说了之后滚动就顺了：新画面拍到之前，
   * 渲染线程先把手里那张在这一块里挪过去，而且滚动的时候少拍（每一帧都重拍整层，滚动本身就被拖慢了）。
   * 滚动还是浏览器原生的，键盘、触摸、滚动条都照常。返回“不跟了”的函数
   */
  followScroll(scroller: HTMLElement, region: () => ScrollRegion): () => void;
  remove(): void;
}

/** 层里的一块（CSS 像素，相对这一层的左上角） */
export interface ScrollRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasUiLayerOptions {
  /** 铺满画布（默认）；false 是只有内容那么大，位置用 moveTo 说 */
  fill?: boolean;
}

export interface CanvasUi {
  /** 登记一层：element 是画布里一个带 drawable 属性的元素；order 大的在上面 */
  addLayer(element: HTMLElement, order: number, options?: CanvasUiLayerOptions): CanvasUiLayer;
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
  readonly fill: boolean;
  /** 左上角在画布上的位置（CSS 像素）；铺满的层是 0,0 */
  x: number;
  y: number;
  material: UiMaterial;
  /** 还没拍过，或者样子变了、该重拍 */
  stale: boolean;
  /** 渲染线程那头现在有它的画面 */
  drawn: boolean;
  /** 上一次是第几轮拍的：都等着拍的时候，等得最久的先拍 */
  turn: number;
  /** 层里跟着的那个滚动盒子（见 followScroll）；at 是最近一次滚动的时刻 */
  scroll?: { readonly scroller: HTMLElement; readonly region: () => ScrollRegion; at: number };
}

/** 一层的位置和贴法对应的变换（CSS 像素，绕这一层自己的中心）：命中测试要跟着画的位置走 */
function transformOf(layer: Layer): DOMMatrix {
  const { material, element } = layer;
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  return new DOMMatrix()
    .translate(layer.x + material.x + width / 2, layer.y + material.y + height / 2)
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
/**
 * 一层头一回拍到之后，隔这么久各补拍一次（毫秒）。实测（Chrome 157）：层刚搬进画布的那一帧拍到的画面
 * 可能还停在某个过渡的半路上（按钮的底色正在变），而之后浏览器不再为它发 paint——不补拍的话，
 * 界面上要是没有别的变化，那个半路上的样子就一直留在画面上
 */
const SETTLE_MS = [150, 600];
/** 刚操作过界面（指针、键盘落在界面上）的这段时间里不讲节奏：按下、悬停要马上看到反应 */
const INPUT_MS = 150;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'keydown', 'wheel', 'input'];
/**
 * 一层里的滚动盒子正在滚的时候，这一层两次重拍之间至少隔这么久（毫秒）：这段时间画面靠渲染线程挪贴图跟上。
 * 隔得越久主线程越闲、滚动越顺，但滚得快的时候露出来还没拍到的边也越宽
 */
const SCROLL_CAPTURE_MS = 50;
/** 多久没有滚动事件就算停了（毫秒）：停了马上补拍一张准的 */
const SCROLL_IDLE_MS = 120;

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

  /** 铺满的层和画布一样大（CSS 像素） */
  const fit = () => {
    const width = `${canvas.clientWidth}px`;
    const height = `${canvas.clientHeight}px`;
    for (const { element, fill } of layers) {
      if (!fill) continue;
      // 没变就不写：写了样式会被当成“这层变了”
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
  // 层元素的样式、类名一变就请它补发一次，好及时把这层的旧画面收掉。
  // （试过盯着层里所有的 DOM 变化、一变就请求重拍：10 倍速时主线程被卡住的时间多了一截，也没有比现在更稳，没留）
  const restyled = new MutationObserver(() => canvas.requestPaint());

  /** 告诉浏览器各层画在哪。按从下到上的顺序说：后说的在命中测试里排在上面 */
  function place() {
    for (const layer of layers) {
      canvas.updateElementGeometry(layer.element, { canvasTransform: transformOf(layer) });
    }
  }

  /**
   * 一层没有画面可拍了：渲染线程那头要是还留着它之前的画面，收掉（不然藏起来的界面还画在那里）。
   * 它接着算“该重拍”：有的时候只是这一帧拍不到（刚搬进画布、刚重排），之后浏览器并不会再说它“变了”
   */
  function vanish(layer: Layer) {
    layer.stale = true;
    if (!layer.drawn) return;
    layer.drawn = false;
    send?.({ type: 'ui-clear', layer: layer.id }, []);
  }

  /**
   * 有的层该拍却拍不下来：过一会儿请浏览器再发一次 paint 重试。越等越久（最长两秒）——
   * 真被藏起来的层会一直拍不下来，不能为它每帧都问一遍
   */
  let retryMs = 0;
  let retrying: ReturnType<typeof setTimeout> | undefined;
  function retryLater() {
    if (retrying !== undefined) return;
    retryMs = Math.min(2000, Math.max(50, retryMs * 2));
    retrying = setTimeout(() => {
      retrying = undefined;
      canvas.requestPaint();
    }, retryMs);
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

  /** 等着补拍的定时器（收场时一起清掉） */
  const settling = new Set<ReturnType<typeof setTimeout>>();
  const retake = (layer: Layer) => {
    if (!layers.includes(layer)) return;
    layer.stale = true;
    canvas.requestPaint();
  };

  /** 一层里的滚动盒子现在滚到哪、滚动的内容占哪一块：告诉渲染线程 */
  function sendScroll(layer: Layer) {
    if (!layer.scroll || !send) return;
    const { scroller, region } = layer.scroll;
    const { x, y, width, height } = region();
    send(
      {
        type: 'ui-scroll',
        layer: layer.id,
        x: scroller.scrollLeft,
        y: scroller.scrollTop,
        rect: [x, y, width, height],
      },
      [],
    );
  }

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
    // 头一回拍到：过一会儿再补拍两次（见 SETTLE_MS）
    if (!layer.drawn) for (const ms of SETTLE_MS) settling.add(setTimeout(() => retake(layer), ms));
    layer.drawn = true;
    layer.turn = ++turn;
    pixels = size.width * size.height;
    // 先说一遍滚动区现在的位置（窗口变了大小它也跟着变），再发拍的时候滚到哪：两头对得上，那边才知道该挪多少
    sendScroll(layer);
    send(
      {
        type: 'ui-image',
        layer: layer.id,
        order: layer.order,
        image,
        width: Math.round(size.width),
        height: Math.round(size.height),
        pixelRatio:
          layer.element.offsetWidth > 0 ? size.width / layer.element.offsetWidth : devicePixelRatio,
        scroll: layer.scroll && {
          x: layer.scroll.scroller.scrollLeft,
          y: layer.scroll.scroller.scrollTop,
        },
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
    let missed = false;
    for (const layer of layers) {
      if (layer.stale && !layer.drawn && !capture(layer)) missed = true;
    }
    if (missed && send) retryLater();
    else retryMs = 0;
    const due = layers
      .filter((layer) => layer.stale && layer.drawn)
      .sort((a, b) => a.turn - b.turn);
    if (due.length === 0) return;
    const now = performance.now();
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, (pixelBudget * 1e6) / Math.max(1, pixels)));
    // 正在滚：画面有渲染线程挪着贴图顶着，不用每一帧都重拍（滚轮也算“刚操作过”，这条排在它前面）
    const scrolling = due.some((layer) => layer.scroll && now - layer.scroll.at < SCROLL_IDLE_MS);
    // 留两毫秒的余量：免得刚好卡在帧的边上多等一帧
    const wait = scrolling
      ? lastAt + SCROLL_CAPTURE_MS - 2 - now
      : now - inputAt < INPUT_MS
        ? 0
        : lastAt + 1000 / rate - 2 - now;
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
  const sendPlace = (layer: Layer) =>
    send?.({ type: 'ui-place', layer: layer.id, x: layer.x, y: layer.y }, []);

  return {
    addLayer(element, order, { fill = true } = {}) {
      const layer: Layer = {
        id: nextId++,
        element,
        order,
        fill,
        x: 0,
        y: 0,
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
      // 只有内容那么大的层：大小变了，绕中心的变换也跟着变
      if (!fill) observer.observe(element);
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
        moveTo(x, y) {
          if (x === layer.x && y === layer.y) return;
          layer.x = x;
          layer.y = y;
          sendPlace(layer);
          place();
        },
        followScroll(scroller, region) {
          const following = { scroller, region, at: -Infinity };
          layer.scroll = following;
          const onScroll = () => {
            following.at = performance.now();
            sendScroll(layer);
          };
          scroller.addEventListener('scroll', onScroll, { passive: true });
          sendScroll(layer);
          return () => {
            scroller.removeEventListener('scroll', onScroll);
            if (layer.scroll !== following) return;
            layer.scroll = undefined;
            // 那头别再挪了：滚动区的宽是 0 就是没有
            send?.({ type: 'ui-scroll', layer: layer.id, x: 0, y: 0, rect: [0, 0, 0, 0] }, []);
          };
        },
        remove() {
          const index = layers.indexOf(layer);
          if (index < 0) return;
          layers.splice(index, 1);
          if (!fill) observer.unobserve(element);
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
        sendPlace(layer);
        sendScroll(layer);
      }
      canvas.requestPaint();
    },
    dispose() {
      observer.disconnect();
      restyled.disconnect();
      clearTimeout(waiting);
      clearTimeout(retrying);
      for (const timer of settling) clearTimeout(timer);
      for (const type of INPUT_EVENTS) canvas.removeEventListener(type, touched);
      canvas.removeEventListener('paint', paint);
      // 渲染线程那头的贴图也收掉：不然这些层搬出画布以后还留着一份旧的画在那里
      for (const layer of layers) send?.({ type: 'ui-remove', layer: layer.id }, []);
      send = undefined;
      layers.length = 0;
    },
  };
}
