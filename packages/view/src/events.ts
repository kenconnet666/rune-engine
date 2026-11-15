/**
 * 指针落在谁身上（命中）、事件怎么派。节点不是网页元素，浏览器不知道它们在哪：
 * 页面只把“指针到了画布上的哪个位置”告诉这里，谁被点到、谁被指着、该滚哪个盒子，都是这里算。
 *
 * 事件照网页的习惯：从被点到的节点往上冒，处理函数写在节点的属性上（onClick、onPointerdown……）；
 * 进来、出去（pointerenter / pointerleave）不冒，进到子节点里不算出去。
 * 指着、按着的节点带上 hovered / pressed，样式里的 hover、active 跟着生效。
 *
 * 选中文字也在这里：在一段字上按下开始选，拖到哪选到哪；双击选一个词，三击选整段，按着 Shift 点是接着选。
 */
import { childRange, type ViewNode, type ViewTree } from './node.ts';
import { blockAt, pointAt, selectable, wordAt, type TextPoint } from './selection.ts';

export interface ViewPointerEvent {
  readonly type:
    'pointerdown' | 'pointerup' | 'pointermove' | 'pointerenter' | 'pointerleave' | 'click';
  /** 在画布上的位置（CSS 像素） */
  readonly x: number;
  readonly y: number;
  /** 指针落在的那个节点；处理函数所在的节点 */
  readonly target: ViewNode;
  currentTarget: ViewNode;
  /** 不再往上冒 */
  stopPropagation(): void;
}

export interface ViewWheelEvent {
  readonly type: 'wheel';
  readonly x: number;
  readonly y: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly target: ViewNode;
  currentTarget: ViewNode;
  stopPropagation(): void;
  /** 不要默认的滚动 */
  preventDefault(): void;
}

/** 一个点在主轴上占的“宽度”：找命中时拿它当一小段去找重叠的子节点 */
const POINT = 1e-6;

/** 画布上的这个位置落在哪个节点上（最上面、最里面的那个）；谁也没落到是 null */
export function hitTest(tree: ViewTree, x: number, y: number): ViewNode | null {
  return hit(tree.root, x, y);
}

/** x、y 是相对 node 的父节点左上角的（和 node.x、node.y 一个坐标系） */
function hit(node: ViewNode, x: number, y: number): ViewNode | null {
  const localX = x - node.x;
  const localY = y - node.y;
  const inside = localX >= 0 && localY >= 0 && localX < node.width && localY < node.height;
  const style = node.look;
  // 超出不显示的盒子：外面的点不到它的子孙
  if (!inside && (style.overflow === 'hidden' || style.overflow === 'scroll')) return null;
  if (node.type !== 'text') {
    const childX = localX + node.scrollLeft;
    const childY = localY + node.scrollTop;
    const at = node.flowAxis === 'x' ? childX : childY;
    const [from, to] = childRange(node, at, at + POINT);
    // 后画的在上面：从后往前找
    for (let index = to - 1; index >= from; index--) {
      const child = node.children[index]!;
      if (child.type[0] === '#') continue;
      const found = hit(child, childX, childY);
      if (found) return found;
    }
  }
  return inside && style.pointerEvents !== 'none' && node.type !== 'root' ? node : null;
}

/** 从这个节点到根的一串（自己在最前） */
function pathOf(node: ViewNode | null): ViewNode[] {
  const path: ViewNode[] = [];
  for (let each = node; each; each = each.parent) path.push(each);
  return path;
}

const handlerName = (type: string) => `on${type[0]!.toUpperCase()}${type.slice(1)}`;

export interface PointerInput {
  /** 指针挪到了画布上的 (x, y) */
  move(x: number, y: number): void;
  /** shift：按着 Shift（接着上回的选区选到这里） */
  down(x: number, y: number, options?: { shift?: boolean }): void;
  up(x: number, y: number): void;
  /** 指针离开了画布 */
  leave(): void;
  /** 滚轮；返回 true 是有东西滚了、或者有处理函数接了（页面就不该再跟着滚） */
  wheel(x: number, y: number, deltaX: number, deltaY: number): boolean;
  /** 现在该显示什么光标 */
  readonly cursor: string;
}

/** 把指针的动作变成节点上的事件和状态 */
/** 两次按下隔得比这短（毫秒）、离得比这近（像素）算连击（双击选词、三击选整段） */
const MULTI_CLICK_MS = 400;
const MULTI_CLICK_DISTANCE = 4;

export interface PointerInputOptions {
  /** 现在是什么时候（毫秒）：算连击用，测试里可以换成假的钟 */
  now?: () => number;
}

export function createPointerInput(
  tree: ViewTree,
  { now = () => performance.now() }: PointerInputOptions = {},
): PointerInput {
  /** 正拖着选文字：从哪个位置开始的 */
  let selectingFrom: TextPoint | null = null;
  /** 上一次按下：什么时候、在哪、是第几连击 */
  let lastDown = { at: -Infinity, x: 0, y: 0, count: 0 };
  /** 现在指着的那一串节点（从最里面到根） */
  let hovered: ViewNode[] = [];
  /** 按下时落在谁身上（松开时算点击用）、哪些节点正按着 */
  let downTarget: ViewNode | null = null;
  let pressed: ViewNode[] = [];
  let cursor = 'default';

  function dispatch(
    type: ViewPointerEvent['type'],
    target: ViewNode,
    x: number,
    y: number,
    bubbles = true,
  ) {
    let stopped = false;
    const event: ViewPointerEvent = {
      type,
      x,
      y,
      target,
      currentTarget: target,
      stopPropagation: () => (stopped = true),
    };
    const name = handlerName(type);
    for (
      let node: ViewNode | null = target;
      node && !stopped;
      node = bubbles ? node.parent : null
    ) {
      const handler = node.props?.[name];
      if (typeof handler !== 'function') continue;
      event.currentTarget = node;
      (handler as (event: ViewPointerEvent) => void)(event);
    }
  }

  function setState(nodes: ViewNode[], key: 'hovered' | 'pressed', value: boolean) {
    for (const node of nodes) {
      if (node[key] === value) continue;
      node[key] = value;
      // 没写 hover / active 的节点样子不会变，不用重算
      if (key === 'hovered' ? node.style.hover : node.style.active) node.restyle();
    }
  }

  function hoverTo(target: ViewNode | null, x: number, y: number) {
    if (target === (hovered[0] ?? null)) return;
    const next = pathOf(target);
    const staying = new Set(next);
    const left = hovered.filter((node) => !staying.has(node));
    const before = new Set(hovered);
    const entered = next.filter((node) => !before.has(node));
    setState(left, 'hovered', false);
    for (const node of left) dispatch('pointerleave', node, x, y, false);
    hovered = next;
    setState(entered, 'hovered', true);
    // 进来是从外往里一个个进的
    for (const node of entered.reverse()) dispatch('pointerenter', node, x, y, false);
    // 指着能选的字是“工”字形的光标，除非它或者祖先另外写了
    let shape = target?.type === 'text' && selectable(target) ? 'text' : 'default';
    for (const node of next) {
      if (node.look.cursor) {
        shape = node.look.cursor;
        break;
      }
    }
    cursor = shape;
  }

  return {
    get cursor() {
      return cursor;
    },
    move(x, y) {
      const target = hitTest(tree, x, y);
      hoverTo(target, x, y);
      if (target) dispatch('pointermove', target, x, y);
      // 拖着选：选到指针现在对着的那个位置（指针在空白处就取最近的一段字）
      if (selectingFrom) {
        const focus = pointAt(tree, x, y);
        if (focus) tree.select({ anchor: selectingFrom, focus });
      }
    },
    down(x, y, { shift = false } = {}) {
      const target = hitTest(tree, x, y);
      hoverTo(target, x, y);
      downTarget = target;
      const at = now();
      const again =
        at - lastDown.at < MULTI_CLICK_MS &&
        Math.hypot(x - lastDown.x, y - lastDown.y) < MULTI_CLICK_DISTANCE;
      lastDown = { at, x, y, count: again ? lastDown.count + 1 : 1 };
      // 在一段能选的字上按下：开始选。按在别处：原来的选区不要了
      const point = target?.type === 'text' && selectable(target) ? pointAt(tree, x, y) : null;
      if (!point) tree.select(null);
      else if (shift && tree.selection) {
        selectingFrom = tree.selection.anchor;
        tree.select({ anchor: selectingFrom, focus: point });
      } else if (lastDown.count === 2) tree.select(wordAt(point));
      else if (lastDown.count >= 3) tree.select(blockAt(point));
      else {
        selectingFrom = point;
        tree.select({ anchor: point, focus: point });
      }
      if (!target) return;
      pressed = pathOf(target);
      setState(pressed, 'pressed', true);
      dispatch('pointerdown', target, x, y);
    },
    up(x, y) {
      selectingFrom = null;
      const target = hitTest(tree, x, y);
      setState(pressed, 'pressed', false);
      pressed = [];
      hoverTo(target, x, y);
      if (target) dispatch('pointerup', target, x, y);
      // 点击落在“按下的节点”和“松开的节点”共同的最近祖先上（和网页一样）
      if (target && downTarget) {
        const down = new Set(pathOf(downTarget));
        const shared = pathOf(target).find((node) => down.has(node));
        if (shared && shared.type !== 'root') dispatch('click', shared, x, y);
      }
      downTarget = null;
    },
    leave() {
      hoverTo(null, 0, 0);
    },
    wheel(x, y, deltaX, deltaY) {
      const target = hitTest(tree, x, y);
      if (!target) return false;
      let stopped = false;
      let prevented = false;
      let handled = false;
      const event: ViewWheelEvent = {
        type: 'wheel',
        x,
        y,
        deltaX,
        deltaY,
        target,
        currentTarget: target,
        stopPropagation: () => (stopped = true),
        preventDefault: () => (prevented = true),
      };
      for (let node: ViewNode | null = target; node && !stopped; node = node.parent) {
        const handler = node.props?.onWheel;
        if (typeof handler !== 'function') continue;
        event.currentTarget = node;
        (handler as (event: ViewWheelEvent) => void)(event);
        handled = true;
      }
      if (prevented) return true;
      // 默认：最近的、这个方向还滚得动的盒子滚
      for (let node: ViewNode | null = target; node; node = node.parent) {
        if (node.look.overflow !== 'scroll') continue;
        if (!node.scrollTo(node.scrollLeft + deltaX, node.scrollTop + deltaY)) continue;
        // 内容在指针下面挪走了：指着的可能换了人
        hoverTo(hitTest(tree, x, y), x, y);
        return true;
      }
      return handled;
    },
  };
}
