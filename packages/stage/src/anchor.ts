/**
 * 把一层贴着舞台上的一样东西摆（下拉贴着输入框、菜单贴着按钮、标注贴着指针下的那个点）。
 * 位置怎么算在 placement.ts（纯函数，和组件库是同一套规则）；这里管“量”和“跟”：
 * 量锚点和这一层的大小，换成舞台里的坐标，算出这一层左上角该在哪，交给 apply 去落地——
 * 用层的 moveTo 的话，界面画在画布里时跟着锚点走不用重拍。之后锚点挪了、大小变了、舞台里有东西滚了，重新算。
 *
 * 量锚点用的是 getBoundingClientRect：层被挪过、缩放过，量到的也是它画出来的位置（实测过）。
 */
import { computePlacement, type Placement, type PlacementResult } from './placement.ts';

/** 锚点：一个元素，或者舞台里的一个点（CSS 像素，相对舞台的左上角） */
export type AnchorTarget = Element | { readonly x: number; readonly y: number };

export interface AnchorOptions {
  /** 摆在锚点的哪一侧、怎么对齐，默认 bottom-start；放不下时翻到对侧 */
  placement?: Placement;
  /** 离锚点多远（像素），默认 6 */
  offset?: number;
  /** 离舞台边缘至少多远（像素），默认 8 */
  padding?: number;
  /** 主方向和对侧都放不下时，再试垂直的两侧 */
  crossAxisFallback?: boolean;
  /** 至少和锚点一样宽（下拉的选项列表） */
  matchWidth?: boolean;
  /** 最大高度限制在舞台剩下的地方里（层里面自己滚）：菜单、选项列表 */
  fitHeight?: boolean;
}

/** 那一层的左上角该在舞台的哪里（CSS 像素，取整：落在半个像素上字会糊），最后摆在了哪一侧、怎么对齐的 */
export type AnchorResult = Pick<PlacementResult, 'x' | 'y' | 'side' | 'align'>;

export interface AnchorFollow {
  /** 锚点或者选项变了：重新算一次 */
  update(): void;
  stop(): void;
}

const isElement = (anchor: AnchorTarget): anchor is Element => 'getBoundingClientRect' in anchor;

/**
 * 元素挪了位置（没有滚动、没有变大小：上面的内容变高了，把它挤下去）时调用 onMove。
 * 做法同组件库的 floating.ts（那边又是照 floating-ui 的 layoutShift）：一个交叉观察器，根的范围正好收到元素的边上，
 * 元素一挪交叉比例就变；每次变了按新位置重建。比每帧量一次省
 */
function observeMove(element: Element, onMove: () => void): () => void {
  const root = element.ownerDocument.documentElement;
  let observer: IntersectionObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    clearTimeout(timer);
    observer?.disconnect();
    observer = undefined;
  };
  function watch(moved: boolean, threshold = 1) {
    cleanup();
    const { left, top, width, height } = element.getBoundingClientRect();
    if (moved) onMove();
    if (!width || !height) return;
    const inset = (value: number) => `${-Math.floor(value)}px`;
    const rootMargin = [
      inset(top),
      inset(root.clientWidth - (left + width)),
      inset(root.clientHeight - (top + height)),
      inset(left),
    ].join(' ');
    let first = true;
    observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0]!.intersectionRatio;
        if (ratio !== threshold) {
          if (!first) return watch(true);
          // 元素有一部分在视口外：按现在的比例重新观察；完全在外面时过一会儿再看
          if (ratio) watch(false, ratio);
          else timer = setTimeout(() => watch(false, 1e-7), 1000);
        }
        first = false;
      },
      { rootMargin, threshold: Math.max(0, Math.min(threshold, 1)) || 1 },
    );
    observer.observe(element);
  }
  watch(false);
  return cleanup;
}

/**
 * 让 floating（一层的元素）跟着锚点走：现在算一次，之后锚点挪了、大小变了、它的祖先滚了、舞台变了大小都重新算。
 * anchor、options 每次算的时候现读；锚点换了一个元素要 stop 了重新来（盯着的是开始时的那个）
 */
export function followAnchor(
  root: HTMLElement,
  anchor: () => AnchorTarget,
  floating: HTMLElement,
  options: () => AnchorOptions,
  apply: (result: AnchorResult) => void,
): AnchorFollow {
  const update = () => {
    const {
      placement = 'bottom-start',
      offset = 6,
      padding = 8,
      crossAxisFallback,
      matchWidth,
      fitHeight,
    } = options();
    const stage = root.getBoundingClientRect();
    const target = anchor();
    // 都换成舞台里的坐标
    const rect = isElement(target)
      ? target.getBoundingClientRect()
      : new DOMRect(stage.left + target.x, stage.top + target.y, 0, 0);
    if (matchWidth) floating.style.minWidth = `${rect.width}px`;
    const result = computePlacement({
      anchor: {
        left: rect.left - stage.left,
        top: rect.top - stage.top,
        width: rect.width,
        height: rect.height,
      },
      width: floating.offsetWidth,
      height: floating.offsetHeight,
      viewport: { left: 0, top: 0, width: root.clientWidth, height: root.clientHeight },
      placement,
      gap: offset,
      rtl: getComputedStyle(floating).direction === 'rtl',
      padding,
      crossAxisFallback,
    });
    if (fitHeight) floating.style.maxHeight = `${result.availableHeight}px`;
    apply({
      x: Math.round(result.x),
      y: Math.round(result.y),
      side: result.side,
      align: result.align,
    });
  };

  const target = anchor();
  const element = isElement(target) ? target : undefined;
  // 滚动不冒泡，在舞台上捕获能收到里面任何元素的滚动：只管锚点的祖先的（这一层里面自己滚，位置不变）
  const onScroll = (event: Event) => {
    if (element && event.target instanceof Node && event.target.contains(element)) update();
  };
  root.addEventListener('scroll', onScroll, { capture: true, passive: true });
  const resize = new ResizeObserver(update);
  resize.observe(root);
  resize.observe(floating);
  if (element) resize.observe(element);
  const stopMove = element && observeMove(element, update);
  update();

  return {
    update,
    stop() {
      root.removeEventListener('scroll', onScroll, { capture: true });
      resize.disconnect();
      stopMove?.();
    },
  };
}
