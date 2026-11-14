/**
 * 浮层贴着锚点摆在哪：纯函数，只吃量好的矩形，不碰 DOM。
 *
 * 算法和测试是从组件库的 `utils/dom/floating.ts`（上游 vue-tsx-pro 0.27.0 起自己写的那一版，同一位作者）搬过来的，
 * 一个字没改规则：引擎不能反过来依赖组件库，所以搬一份；组件库的那一份之后改成用这里的。
 * 两边要一直是同一套规则——翻面、贴边的行为对不上的话，同一个下拉在两种摆法下会摆在不同的地方。
 */

/** 在锚点的哪一侧 */
export type Side = 'top' | 'right' | 'bottom' | 'left';
/** 弹出位置：主方向，加对齐方式（start 对齐锚点的起始边，end 对齐结束边，不写是居中） */
export type Placement = Side | `${Side}-start` | `${Side}-end`;

/** 矩形（px；用哪个坐标系都行，几个矩形用同一个就好——舞台这边用的是舞台里的坐标） */
export interface FloatingRect {
  /** 左边 */
  left: number;
  /** 上边 */
  top: number;
  /** 宽 */
  width: number;
  /** 高 */
  height: number;
}

/** computePlacement 的输入：都是量好的数，不碰 DOM */
export interface PlacementInput {
  /** 锚点的位置 */
  anchor: FloatingRect;
  /** 浮层的宽（布局尺寸，不受进出场的缩放影响） */
  width: number;
  /** 浮层的高 */
  height: number;
  /** 能用的那一块：舞台这边就是整个舞台 */
  viewport: FloatingRect;
  /** 想要的位置 */
  placement: Placement;
  /** 与锚点的距离 */
  gap: number;
  /** 浮层是不是从右到左排版：start / end 镜像 */
  rtl: boolean;
  /** 与视口边缘至少留出的距离 */
  padding: number;
  /** 主方向与对侧都放不下时，再试垂直的两侧 */
  crossAxisFallback?: boolean;
  /** 箭头：边长，与离浮层两端至少留出的距离 */
  arrow?: { size: number; padding: number };
}

/** computePlacement 的结果 */
export interface PlacementResult {
  /** 浮层的左边 */
  x: number;
  /** 浮层的上边 */
  y: number;
  /** 最后在锚点的哪一侧 */
  side: Side;
  /** 对齐方式 */
  align: 'start' | 'center' | 'end';
  /** 箭头在浮层里的横向位置（上下弹出时） */
  arrowX?: number;
  /** 箭头在浮层里的纵向位置（左右弹出时） */
  arrowY?: number;
  /** 这一侧能用的高度：fitHeight 写成浮层的最大高度 */
  availableHeight: number;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };
const isVertical = (side: Side) => side === 'top' || side === 'bottom';
/** 夹在 min–max 之间；放不下（max < min）时贴着 min 那一边 */
const clampTo = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** 浮层在锚点这一侧、这样对齐时的左上角 */
function coordsOf(
  side: Side,
  align: PlacementResult['align'],
  { anchor, width, height, gap, rtl }: PlacementInput,
) {
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  if (isVertical(side)) {
    // start / end 是逻辑方向：从右到左排版时 start 贴锚点的右边
    const atLeft = align === 'center' ? null : (align === 'start') !== rtl;
    return {
      x:
        atLeft == null
          ? anchor.left + (anchor.width - width) / 2
          : atLeft
            ? anchor.left
            : right - width,
      y: side === 'top' ? anchor.top - height - gap : bottom + gap,
    };
  }
  return {
    x: side === 'left' ? anchor.left - width - gap : right + gap,
    y:
      align === 'start'
        ? anchor.top
        : align === 'end'
          ? bottom - height
          : anchor.top + (anchor.height - height) / 2,
  };
}

/**
 * 算浮层的位置（纯函数，定位的全部规则都在这里）：
 * 1. 按想要的一侧放；放不下换对侧（crossAxisFallback 时再试垂直的两侧）；都放不下选空间最大的一侧；
 * 2. 沿着对齐的方向挪回视口里；
 * 3. 箭头对准锚点的中间，但不画到浮层的圆角外；
 * 4. 报告这一侧能用的高度。
 */
export function computePlacement(input: PlacementInput): PlacementResult {
  const { anchor, width, height, viewport, placement, padding, rtl, arrow } = input;
  const [wanted, align = 'center'] = placement.split('-') as [Side, PlacementResult['align']?];
  const bounds = {
    left: viewport.left + padding,
    top: viewport.top + padding,
    right: viewport.left + viewport.width - padding,
    bottom: viewport.top + viewport.height - padding,
  };
  /** 这一侧还差多少放不下（≤ 0 放得下） */
  const overflowOf = (side: Side) => {
    const { x, y } = coordsOf(side, align, input);
    if (side === 'top') return bounds.top - y;
    if (side === 'bottom') return y + height - bounds.bottom;
    if (side === 'left') return bounds.left - x;
    return x + width - bounds.right;
  };
  const perpendicular: Side[] = isVertical(wanted)
    ? rtl
      ? ['left', 'right']
      : ['right', 'left']
    : ['bottom', 'top'];
  const candidates = [
    wanted,
    OPPOSITE[wanted],
    ...(input.crossAxisFallback ? perpendicular : []),
  ].map((side) => ({ side, overflow: overflowOf(side) }));
  const side = (
    candidates.find((candidate) => candidate.overflow <= 0) ??
    candidates.reduce((best, candidate) => (candidate.overflow < best.overflow ? candidate : best))
  ).side;

  let { x, y } = coordsOf(side, align, input);
  if (isVertical(side)) x = clampTo(x, bounds.left, bounds.right - width);
  else y = clampTo(y, bounds.top, bounds.bottom - height);

  const result: PlacementResult = {
    x,
    y,
    side,
    align,
    availableHeight: Math.max(
      0,
      side === 'bottom'
        ? bounds.bottom - y
        : side === 'top'
          ? y + height - bounds.top
          : bounds.bottom - bounds.top,
    ),
  };
  if (arrow) {
    // 对准锚点的中间；离浮层两端留出距离，尖角不画到圆角外
    const along = (center: number, start: number, length: number) =>
      clampTo(center - start - arrow.size / 2, arrow.padding, length - arrow.size - arrow.padding);
    if (isVertical(side)) result.arrowX = along(anchor.left + anchor.width / 2, x, width);
    else result.arrowY = along(anchor.top + anchor.height / 2, y, height);
  }
  return result;
}
