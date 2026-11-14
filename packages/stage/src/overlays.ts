/**
 * 弹层的宿主：舞台上打开着的弹层（对话框、下拉、菜单……）排成一摞，后打开的在上面。
 * 浏览器的“顶层”（模态的 <dialog>、popover）画不进画布，它替弹层做的那几件事在这里照着做一遍：
 *
 * - **上下**：每个弹层自己占一层，次序按打开的先后排在 OVERLAY_ORDER 往上；
 * - **模态**：最上面那个模态弹层以下的层全部 inert——点不到、焦点进不去、滚不动；
 *   焦点进到它里面，按 Tab 走到头绕回开头，关了还给打开之前的元素；
 * - **点外面关**：在一个弹层外面按下又松开，它上面的弹层挨个被请去关（和原生 popover 一样：
 *   点在父弹层里只关子弹层）。碰到模态的就停——一次点击只过一个模态；
 * - **Esc**：只请最上面那个去关。
 *
 * 宿主自己不关任何东西：它只说“有人想关你”（onDismiss），关不关、怎么关由开它的组件定
 * （有没保存的改动要先问一句的，就在那里问）。
 *
 * 一般不直接用它：<StageLayer overlay={…}> 会来登记（见 StageLayer.tsx）。
 */

export type DismissReason = 'escape' | 'outside';

export interface OverlayOptions {
  /** 模态：它下面的东西不再响应操作，焦点留在它里面。打开之后不能改 */
  modal?: boolean;
  /** 按 Esc 时请它关，默认 true */
  escape?: boolean;
  /** 点在它外面时请它关；默认不是模态的会，模态的不会 */
  outside?: boolean;
  /**
   * 哪一块算它的“里面”，默认整层。铺满舞台的层要给：压暗的底不算里面，中间的面板才算。
   * 模态打开时焦点也是给它（里面有 autofocus 的元素就给那个）
   */
  content?: () => Element | null | undefined;
  /** 层外面也算“里面”的元素（打开它的那个按钮）：点它们不算点外面 */
  inside?: () => Iterable<Element | null | undefined>;
  /** 有人想关它 */
  onDismiss: (reason: DismissReason, event: Event) => void;
}

/** 登记了的一个弹层 */
export interface OverlayEntry {
  /** 它这一层的次序 */
  readonly order: number;
  /** 它关了：从这一摞里拿掉 */
  close(): void;
}

export interface OverlayHost {
  /** 登记一个打开的弹层：layer 是它那一层的元素，options 每次用的时候现读 */
  open(layer: HTMLElement, options: () => OverlayOptions): OverlayEntry;
  /** 舞台上的层有增减：重新定哪些层该是 inert */
  sync(): void;
  dispose(): void;
}

export interface OverlayHostEnv {
  /** 舞台最外面的元素 */
  root(): HTMLElement | null;
  /** 舞台上现在所有的层（自带的、自己加的、弹层的）和它们的次序 */
  layers(): Iterable<{ readonly element: HTMLElement; readonly order: number }>;
}

/** 弹层从这个次序起往上排（hud 是 1，tips 是 3） */
export const OVERLAY_ORDER = 2;
/** 相邻两个弹层的次序差多少：同时开着的弹层不会多到排进 tips 那一层 */
const STEP = 0.01;

/** 能用 Tab 走到的元素（再筛掉禁用的、看不见的） */
const TAB_STOPS =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';

function tabStops(scope: Element): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(TAB_STOPS)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !(element as HTMLButtonElement).disabled &&
      !element.closest('[inert]') &&
      // 测试用的模拟 DOM 里没有这个方法：当成看得见
      element.checkVisibility?.({ visibilityProperty: true }) !== false,
  );
}

interface Entry {
  readonly layer: HTMLElement;
  readonly order: number;
  readonly modal: boolean;
  readonly options: () => OverlayOptions;
  /** 模态的：打开之前焦点在哪 */
  readonly returnTo: Element | null;
}

export function createOverlayHost(env: OverlayHostEnv): OverlayHost {
  /** 开着的弹层，后打开的在后面 */
  const entries: Entry[] = [];
  let listening: Document | undefined;
  /** 按下的时候在第几个弹层里面（-1 是都不在）：松开时还在同一个里面才算一次点击 */
  let pressedIn: number | undefined;
  /** 最近一次按的是不是 Shift+Tab：焦点跑出去的时候，决定拉回到开头还是末尾 */
  let backward = false;

  const contentOf = (entry: Entry) => entry.options().content?.() ?? entry.layer;
  const holds = (entry: Entry, target: Node) => {
    if (contentOf(entry).contains(target)) return true;
    for (const element of entry.options().inside?.() ?? []) {
      if (element?.contains(target)) return true;
    }
    return false;
  };
  /** target 在哪个弹层里面（最上面的那个）；都不在是 -1 */
  const depthOf = (target: EventTarget | null) =>
    target instanceof Node ? entries.findLastIndex((entry) => holds(entry, target)) : -1;
  const topModal = () => entries.findLast((entry) => entry.modal);

  function sync() {
    const floor = topModal()?.order ?? -Infinity;
    for (const { element, order } of env.layers()) element.toggleAttribute('inert', order < floor);
  }

  /** 模态挡不住的层（它自己和它上面的），按它们在文档里的先后 */
  const reachable = (modal: Entry) =>
    [...env.layers()]
      .filter(({ order }) => order >= modal.order)
      .map(({ element }) => element)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  function focusInto(entry: Entry) {
    const content = contentOf(entry);
    const target = content.querySelector<HTMLElement>('[autofocus]') ?? (content as HTMLElement);
    target.focus?.({ preventScroll: true });
  }

  const onPointerDown = (event: PointerEvent) => {
    pressedIn = depthOf(event.target);
  };
  const onPointerUp = (event: PointerEvent) => {
    const depth = depthOf(event.target);
    const pressed = pressedIn;
    pressedIn = undefined;
    // 在里面按下、拖到外面松开（选中文字、拖滑块）不算点外面
    if (pressed !== depth) return;
    for (const entry of entries.slice(depth + 1).reverse()) {
      const options = entry.options();
      if (options.outside ?? !entry.modal) options.onDismiss('outside', event);
      if (entry.modal) return;
    }
  };

  /**
   * 有模态开着、焦点在它够得着的层里：再按一下 Tab 前面已经没有能停的地方了，就绕到另一头
   * （不绕的话焦点会走到浏览器自己的界面上去，原生的模态对话框就是那样）
   */
  const wrapTab = (event: KeyboardEvent) => {
    const modal = topModal();
    const active = listening?.activeElement;
    if (!modal || !active || event.defaultPrevented) return;
    const layers = reachable(modal);
    if (!layers.some((layer) => layer.contains(active))) return;
    const stops = layers.flatMap(tabStops);
    const ahead = backward ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
    if (stops.some((stop) => active.compareDocumentPosition(stop) & ahead)) return;
    event.preventDefault();
    (backward ? stops.at(-1) : stops[0])?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      backward = event.shiftKey;
      wrapTab(event);
      return;
    }
    // 输入法正在组字时的 Esc 是取消组字；里面的组件已经处理过的（defaultPrevented）也不再管
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    for (const entry of entries.toReversed()) {
      const options = entry.options();
      if (options.escape ?? true) {
        event.preventDefault();
        options.onDismiss('escape', event);
        return;
      }
      if (entry.modal) return;
    }
  };

  /** 有模态开着的时候，焦点落到了舞台上它够不着的地方（画布本身）：拉回来 */
  const onFocusIn = (event: FocusEvent) => {
    const modal = topModal();
    const root = env.root();
    const target = event.target;
    if (!modal || !root || !(target instanceof Node) || !root.contains(target)) return;
    const layers = reachable(modal);
    if (layers.some((layer) => layer.contains(target))) return;
    const stops = layers.flatMap(tabStops);
    const to = backward ? stops.at(-1) : stops[0];
    if (to) to.focus({ preventScroll: true });
    else focusInto(modal);
  };

  function listen(document: Document) {
    listening = document;
    // 捕获阶段：里面的组件拦了冒泡也照样认得出点在哪。Esc 在冒泡阶段：让里面的组件先处理
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
  }
  function unlisten() {
    listening?.removeEventListener('pointerdown', onPointerDown, true);
    listening?.removeEventListener('pointerup', onPointerUp, true);
    listening?.removeEventListener('keydown', onKeyDown);
    listening?.removeEventListener('focusin', onFocusIn);
    listening = undefined;
  }

  return {
    open(layer, options) {
      const document = layer.ownerDocument;
      const modal = options().modal === true;
      const entry: Entry = {
        layer,
        order: (entries.at(-1)?.order ?? OVERLAY_ORDER - STEP) + STEP,
        modal,
        options,
        returnTo: modal ? document.activeElement : null,
      };
      entries.push(entry);
      if (!listening) listen(document);
      if (modal) {
        sync();
        focusInto(entry);
      }
      return {
        order: entry.order,
        close() {
          const index = entries.indexOf(entry);
          if (index < 0) return;
          entries.splice(index, 1);
          if (entries.length === 0) unlisten();
          if (!modal) return;
          sync();
          // 焦点还在它里面、或者已经丢了（落在 body 上）才还：用户自己点到别处去了就不抢
          const active = document.activeElement;
          const lost = !active || active === document.body || layer.contains(active);
          const { returnTo } = entry;
          if (lost && returnTo instanceof HTMLElement && returnTo.isConnected) {
            returnTo.focus({ preventScroll: true });
          }
        },
      };
    },
    sync,
    dispose() {
      entries.length = 0;
      unlisten();
    },
  };
}
