/**
 * 界面采集：把界面画布里的一层层界面“拍”下来交给渲染线程去贴（贴的那头是 render 包的界面合成器，约定见它的 ui-types.ts）。
 * 舞台（Stage.tsx）用它；不用舞台、自己摆画布的也可以直接用。
 *
 * 界面画布是一张 2D 的画布，透明地盖在画面上，交给渲染线程（transferControlToOffscreen，发 ui-canvas）：
 * 拍下来的界面只能画回它所在的那张画布。拍只是记下怎么画，画成像素在渲染线程里。
 * 一层是界面画布里一个带 drawable 属性的元素。这里做三件事：
 *   - 铺满的层和画布一样大；只有内容那么大的层自己定大小、由使用方说放在哪
 *     （元素在画布里排版出来的位置没有意义，画在哪由我们定）
 *   - 浏览器说“这几层的样子变了”（画布的 paint 事件）时把它们重新拍下来发过去——一帧里拍的加起来不超过一张画布那么多像素
 *   - 各层在界面画布里按上下的次序排着：两层叠在一处时，点到的是文档里靠后的那个
 * “每一层在页面上的哪里”不归这里说：2D 的画布上浏览器认的是渲染线程最后把它画在哪（见 render 包的 ui-compositor.ts），
 * 所以位置、贴法只管发给渲染线程，它画的时候点击、悬停、量位置就都跟上了（晚一帧）。
 *
 * 这套接口（HTML-in-Canvas）只有新的 Chrome 有：canvasUiSupported() 是 false 时别把界面放进画布（放进去就看不见了），
 * 照老办法叠在画布上面。
 */
import {
  PLAIN_MATERIAL,
  type ElementImage,
  type UiMaterial,
  type UiMessage,
  type UiReport,
} from '@rune-engine/render/ui-types';

/** 画布上和界面层有关的那几个方法（还没进 TypeScript 自带的声明） */
interface DrawableCanvas extends HTMLCanvasElement {
  captureElementImage(element: Element): ElementImage;
  getElementImageDefaultSize(element: Element): { width: number; height: number };
  requestPaint(): void;
}

interface CanvasPaintEvent extends Event {
  readonly changedElements: readonly Element[];
}

export const canvasUiSupported = (): boolean =>
  typeof HTMLCanvasElement !== 'undefined' &&
  'captureElementImage' in HTMLCanvasElement.prototype &&
  // 渲染线程那头要用 2D 上下文把拍下来的界面画出来
  'drawElementImage' in CanvasRenderingContext2D.prototype;

export interface CanvasUiLayer {
  /** 这一层怎么贴（没写的项保持原样）；durationMs 大于 0 时从现在的样子过渡过去 */
  set(material: Partial<UiMaterial>, durationMs?: number): void;
  /** 现在的贴法（过渡的终点） */
  readonly material: UiMaterial;
  /** 把这一层的左上角放到画布上的 (x, y)（CSS 像素）。不用重拍：只是换个地方贴，命中测试跟着走 */
  moveTo(x: number, y: number): void;
  /**
   * 把这一层当**滚动层**：它的元素是整份内容（可以很高），画面上只露出 width×height 这么大的一块（CSS 像素），
   * 左上角在 moveTo 说的地方。露出哪一块用 scrollTo 说。内容整份只拍一次，滚动不用重拍——
   * 渲染线程只把露出来的（和上下多备的几格）画成像素，代价跟这一块的面积走，不跟内容的长度走
   */
  view(width: number, height: number): void;
  /** 滚动层滚到哪：露出来的那块的左上角在内容里的位置（CSS 像素）。smooth 时渲染线程缓着滚过去 */
  scrollTo(x: number, y: number, smooth?: boolean): void;
  remove(): void;
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
  /** 渲染线程回的话（见 UiReport）：贴图没了就全部重拍；哪几层画上了，就可以接着拍它们的下一张 */
  receive(report: UiReport): void;
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
  /** 发出去了、渲染线程还没说“画上了”的画面有几张，最后一张是什么时候发的 */
  flying: number;
  sentAt: number;
  /** 滚动层：露出多大一块、现在要滚到哪（见 CanvasUiLayer 的 view、scrollTo） */
  scroll?: { width: number; height: number; x: number; y: number };
}

export interface CanvasUiOptions {
  /**
   * 一秒里最多重画多少像素（百万像素，各层加在一起），默认 90。重拍一层就是把一整层重新画一遍，
   * 花的显卡时间跟像素数走：1600×900 的窗口一秒六十来次，4K 的屏幕就只有十来次。
   * 它是留给**画面**的余量：有自己画面的（游戏的地图）不能让界面的动画把显卡占满。
   * 整页都是界面的（文档站）可以给得很大，那就只剩“渲染线程画上了一张才拍下一张”这一条在管。
   */
  pixelBudget?: number;
}

/** 再大的屏幕一秒也至少拍这么多次 */
const MIN_RATE = 10;
/**
 * 一层最多有几张画面在路上（发出去了、渲染线程还没说画上了）。两张：渲染线程回话到的时候主线程的这一帧可能已经过了，
 * 只许一张的话动画就只有一半的帧
 */
const IN_FLIGHT = 2;
/** 发出去这么久（毫秒）还没回话就当它到了：渲染线程重建、回话丢了的时候不能就此不拍了 */
const LOST_MS = 250;
/**
 * 一层头一回拍到之后，隔这么久各补拍一次（毫秒）。实测（Chrome 157）：层刚搬进画布的那一帧拍到的画面
 * 可能还停在某个过渡的半路上（按钮的底色正在变），而之后浏览器不再为它发 paint——不补拍的话，
 * 界面上要是没有别的变化，那个半路上的样子就一直留在画面上
 */
const SETTLE_MS = [150, 600];
/** 刚操作过界面（指针、键盘落在界面上）的这段时间里不讲节奏：按下、悬停要马上看到反应 */
const INPUT_MS = 150;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'keydown', 'wheel', 'input'];

export function createCanvasUi(
  target: HTMLCanvasElement,
  { pixelBudget = 90 }: CanvasUiOptions = {},
): CanvasUi {
  const canvas = target as DrawableCanvas;
  /** 上一轮拍了多少像素（设备像素）：按它算两轮之间隔多久 */
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
  /** 界面画布占的地方合多少设备像素：渲染线程那头的画布跟着它，拍下来的界面也按它算该画多大 */
  let devicePixels = {
    width: Math.round(canvas.clientWidth * devicePixelRatio),
    height: Math.round(canvas.clientHeight * devicePixelRatio),
  };
  const pixelRatio = () =>
    canvas.clientWidth > 0 ? devicePixels.width / canvas.clientWidth : devicePixelRatio;
  const sendResize = () => send?.({ type: 'ui-resize', ...devicePixels }, []);
  // 按设备像素量：缩放比不是整数时也不发虚
  const sized = new ResizeObserver(([entry]) => {
    const box = entry?.devicePixelContentBoxSize?.[0];
    devicePixels = {
      width: box?.inlineSize ?? Math.round(canvas.clientWidth * devicePixelRatio),
      height: box?.blockSize ?? Math.round(canvas.clientHeight * devicePixelRatio),
    };
    sendResize();
    fit();
  });
  sized.observe(canvas, { box: 'device-pixel-content-box' });
  // 一层自己被藏起来（display:none、visibility:hidden）时浏览器不一定马上发 paint——它等的是“有东西要重画”。
  // 层元素的样式、类名一变就请它补发一次，好及时把这层的旧画面收掉。
  // （试过盯着层里所有的 DOM 变化、一变就请求重拍：10 倍速时主线程被卡住的时间多了一截，也没有比现在更稳，没留）
  const restyled = new MutationObserver(() => canvas.requestPaint());

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

  /** 滚动层滚到哪：告诉渲染线程 */
  function sendScroll(layer: Layer, smooth: boolean) {
    if (!layer.scroll) return;
    send?.(
      { type: 'ui-scroll', layer: layer.id, x: layer.scroll.x, y: layer.scroll.y, smooth },
      [],
    );
  }

  /** 这一层要画多大（设备像素）：排版尺寸乘上设备像素比（界面画布那头的像素尺寸是渲染线程在改，这边看到的会晚一拍） */
  function sizeOf(layer: Layer) {
    const ratio = pixelRatio();
    const width = Math.max(1, Math.round(layer.element.offsetWidth * ratio));
    const height = Math.max(1, Math.round(layer.element.offsetHeight * ratio));
    // 要画成像素的面积：滚动层只画露出来的那一块，内容再长也不算进去
    const pixels = layer.scroll
      ? layer.scroll.width * layer.scroll.height * ratio * ratio
      : width * height;
    return { ratio, width, height, pixels };
  }

  /** 这一层之前发出去的画面渲染线程画上了没有（没画上就先不拍下一张） */
  const landed = (layer: Layer, now: number) =>
    layer.flying < IN_FLIGHT || now - layer.sentAt > LOST_MS;

  /** 拍一层发出去；拍不下来（这一层现在没有画面）是 false */
  function capture(layer: Layer): boolean {
    if (!send) return false;
    let image: ElementImage;
    try {
      image = canvas.captureElementImage(layer.element);
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
    layer.flying++;
    layer.sentAt = performance.now();
    const { ratio, width, height } = sizeOf(layer);
    send(
      {
        type: 'ui-image',
        layer: layer.id,
        order: layer.order,
        image,
        width,
        height,
        pixelRatio: ratio,
        view: layer.scroll && { width: layer.scroll.width, height: layer.scroll.height },
      },
      [image as unknown as Transferable],
    );
    return true;
  }

  /**
   * 该重拍的层怎么排。三条：
   *   - 一层发出去的画面渲染线程还没画上，就先不拍它的下一张（见 IN_FLIGHT）：拍得比画得快是白拍，
   *     跟着渲染线程走，显卡快的机器上界面里的动画就是屏幕的帧率，慢的机器上自己降下来；
   *   - 一轮里拍的像素加起来不超过一张画布那么多；
   *   - 两轮之间隔一会儿（隔多久看 pixelBudget）：给画面留的余量。
   * 界面里只要有个循环的小动画、进度条在过渡，那一层就每帧都在变。所以该重拍的层排着队，等得最久的先拍：
   * 整屏的层还是一轮一层；小块的层（侧栏、顶栏、本页目录）凑得进一张画布的就同一轮拍——
   * 文档站换页时正文、侧栏、目录、滚动条四层一起变，一层层轮着拍的话正文要多等两三帧，之后和侧栏的过渡各占一半的帧。
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
    const now = performance.now();
    const pending = layers.filter((layer) => layer.stale && layer.drawn);
    const due = pending.filter((layer) => landed(layer, now)).sort((a, b) => a.turn - b.turn);
    if (due.length === 0) {
      // 都在等渲染线程回话：回话到了会再来（receive）；万一回话丢了，过一会儿自己再来
      if (pending.length > 0) {
        waiting ??= setTimeout(() => {
          waiting = undefined;
          canvas.requestPaint();
        }, LOST_MS);
      }
      return;
    }
    const rate = Math.max(MIN_RATE, (pixelBudget * 1e6) / Math.max(1, pixels));
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
    const room = devicePixels.width * devicePixels.height;
    let used = 0;
    let left = false;
    for (const layer of due) {
      const size = sizeOf(layer).pixels;
      // 头一层多大都拍；后面的凑得进才拍（凑不进的下一轮排在最前面）
      if (used > 0 && used + size > room) left = true;
      else if (capture(layer)) used += size;
    }
    if (used === 0) return;
    pixels = used;
    lastAt = now;
    if (left) canvas.requestPaint();
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
        flying: 0,
        sentAt: 0,
      };
      // 按 order 插到位，元素在界面画布里也排到同样的位置：点到谁看的是文档里的先后
      const at = layers.findIndex((other) => other.order > order);
      const above = at < 0 ? null : layers[at]!.element;
      layers.splice(at < 0 ? layers.length : at, 0, layer);
      if (element.parentElement === canvas && element.nextElementSibling !== above) {
        // moveBefore 不惊动它：不重置滚动位置、动画和焦点
        canvas.moveBefore(element, above);
      }
      restyled.observe(element, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
      fit();
      canvas.requestPaint();
      return {
        get material() {
          return layer.material;
        },
        set(material, durationMs = 0) {
          layer.material = { ...layer.material, ...material };
          sendMaterial(layer, durationMs);
        },
        moveTo(x, y) {
          if (x === layer.x && y === layer.y) return;
          layer.x = x;
          layer.y = y;
          sendPlace(layer);
        },
        view(width, height) {
          const scroll = (layer.scroll ??= { width, height, x: 0, y: 0 });
          if (scroll.width === width && scroll.height === height && layer.drawn) return;
          scroll.width = width;
          scroll.height = height;
          // 露出多大一块是跟着画面一起发的：重拍一次（只是记下怎么画，便宜）
          layer.stale = true;
          canvas.requestPaint();
        },
        scrollTo(x, y, smooth = false) {
          if (!layer.scroll) return;
          layer.scroll.x = x;
          layer.scroll.y = y;
          sendScroll(layer, smooth);
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
      this.receive({ type: 'ui-request' });
    },
    receive(report) {
      if (report.type === 'ui-drawn') {
        let freed = false;
        for (const layer of layers) {
          if (!report.layers.includes(layer.id)) continue;
          layer.flying = 0;
          freed ||= layer.stale;
        }
        // 有等着这句话的：现在可以拍了
        if (freed) canvas.requestPaint();
        return;
      }
      // 渲染线程那头的贴图没了（刚起来、显卡设备重建了）：全部重拍一遍
      sendResize();
      for (const layer of layers) {
        layer.stale = true;
        layer.drawn = false;
        layer.flying = 0;
        sendMaterial(layer, 0);
        sendPlace(layer);
      }
      canvas.requestPaint();
    },
    dispose() {
      sized.disconnect();
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
