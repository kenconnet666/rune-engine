/**
 * 把一层贴着舞台上的一样东西摆（下拉贴着输入框、菜单贴着按钮、标注贴着指针下的那个点）。
 * 位置用 floating-ui 的核心来算——放不下就翻到另一侧、贴着舞台边缘挪回来这些它都有，
 * 这里只告诉它“坐标是舞台里的坐标、能用的地方是整个舞台”。算出来的是那一层左上角该在哪，
 * 交给 apply 去落地：用层的 moveTo 的话，界面画在画布里时跟着锚点走不用重拍。
 *
 * 量锚点用的是 getBoundingClientRect：层被挪过、缩放过，量到的也是它画出来的位置（实测过）。
 */
import {
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Middleware,
  type OffsetOptions,
  type Placement,
  type Platform,
  type Rect,
} from '@floating-ui/core';
import { autoUpdate } from '@floating-ui/dom';

/** 锚点：一个元素，或者舞台里的一个点（CSS 像素，相对舞台的左上角） */
export type AnchorTarget = Element | { readonly x: number; readonly y: number };

export interface AnchorOptions {
  /** 摆在锚点的哪一侧、怎么对齐，默认 bottom-start；放不下时翻到对侧 */
  placement?: Placement;
  /** 离锚点多远（像素），默认 6；也可以分开给主方向、对齐方向的距离 */
  offset?: OffsetOptions;
  /** 离舞台边缘至少多远（像素），默认 8 */
  padding?: number;
  /** 至少和锚点一样宽（下拉的选项列表） */
  matchWidth?: boolean;
  /** 最大高度限制在舞台剩下的地方里（层里面自己滚）：菜单、选项列表 */
  fitHeight?: boolean;
}

export interface AnchorResult {
  /** 那一层的左上角该在舞台的哪里（CSS 像素，取整：落在半个像素上字会糊） */
  readonly x: number;
  readonly y: number;
  /** 最后摆在了哪一侧（翻过面的话和要的不一样） */
  readonly placement: Placement;
}

export interface AnchorFollow {
  /** 锚点或者选项变了：重新算一次 */
  update(): void;
  stop(): void;
}

const isElement = (anchor: AnchorTarget): anchor is Element => 'getBoundingClientRect' in anchor;

/**
 * 让 floating（一层的元素）跟着锚点走：现在算一次，之后锚点挪了、大小变了、舞台滚了都重新算。
 * anchor、options 每次算的时候现读；锚点换了一个元素要 stop 了重新来（盯着的是开始时的那个）
 */
export function followAnchor(
  root: HTMLElement,
  anchor: () => AnchorTarget,
  floating: HTMLElement,
  options: () => AnchorOptions,
  apply: (result: AnchorResult) => void,
): AnchorFollow {
  /** 锚点现在在哪（视口里的坐标） */
  const anchorRect = () => {
    const target = anchor();
    if (isElement(target)) return target.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    return new DOMRect(base.x + target.x, base.y + target.y, 0, 0);
  };
  const platform: Platform = {
    getElementRects({ floating: element }: { floating: HTMLElement }) {
      const base = root.getBoundingClientRect();
      const rect = anchorRect();
      return {
        reference: {
          x: rect.x - base.x,
          y: rect.y - base.y,
          width: rect.width,
          height: rect.height,
        },
        floating: { x: 0, y: 0, width: element.offsetWidth, height: element.offsetHeight },
      };
    },
    getDimensions: (element: HTMLElement) => ({
      width: element.offsetWidth,
      height: element.offsetHeight,
    }),
    getClippingRect: (): Rect => ({
      x: 0,
      y: 0,
      width: root.clientWidth,
      height: root.clientHeight,
    }),
    isRTL: (element: Element) => getComputedStyle(element).direction === 'rtl',
  };

  let stopped = false;
  const update = () => {
    const { placement = 'bottom-start', offset: distance = 6, padding = 8, ...sizing } = options();
    const middleware: Middleware[] = [offset(distance), flip({ padding }), shift({ padding })];
    if (sizing.matchWidth || sizing.fitHeight) {
      middleware.push(
        size({
          padding,
          apply({ rects, availableHeight }) {
            if (sizing.matchWidth) floating.style.minWidth = `${rects.reference.width}px`;
            if (sizing.fitHeight) floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
          },
        }),
      );
    }
    void computePosition(null, floating, { placement, middleware, platform }).then((result) => {
      if (stopped) return;
      apply({ x: Math.round(result.x), y: Math.round(result.y), placement: result.placement });
    });
  };

  const target = anchor();
  const cleanup = autoUpdate(
    // 给它的是“视口里的位置”：它只拿来判断锚点动没动
    { getBoundingClientRect: anchorRect, contextElement: isElement(target) ? target : undefined },
    floating,
    update,
  );
  return {
    update,
    stop() {
      stopped = true;
      cleanup();
    },
  };
}
