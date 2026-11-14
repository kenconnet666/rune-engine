/**
 * 在一个元素上认手势：鼠标、触屏、触控笔、键盘用同一套回调，游戏代码不用分设备。
 * 手势的含义参考 vue-tsx-pro 的 usePanZoom：按下拖动是平移，滚轮与双指捏合以指针（两指中点）为中心缩放，
 * 没拖动就松开是轻点。这里只认手势、报位移和倍数，相机怎么动由使用方决定。
 *
 *   const stop = observeGestures(canvas, {
 *     pan: (dx, dy) => …, zoom: (factor, at) => …, tap: (at) => …, hover: (at) => …,
 *   });
 *
 * 元素会被设成 touch-action: none（否则触屏拖动会被浏览器当成滚动页面），并且可以聚焦（键盘操作）。
 *
 * 只认落在元素自己身上的手势：元素里面要是还有别的东西（画布里的界面层），从它们身上冒上来的
 * 按下、滚轮、按键都不算——在面板上拖动不是拖地图，在面板里滚滚轮不是缩放地图。
 */

/** 元素里的一点（CSS 像素，相对元素左上角） */
export interface GesturePoint {
  x: number;
  y: number;
}

export interface GestureHandlers {
  /** 拖动：这一下相对上一下移了多少（CSS 像素） */
  pan?(dx: number, dy: number): void;
  /** 缩放：factor 是倍数（大于 1 放大），at 是缩放中心 */
  zoom?(factor: number, at: GesturePoint): void;
  /** 轻点：按下后没怎么动就松开 */
  tap?(at: GesturePoint): void;
  /** 鼠标停在元素上移动（没按键）；触屏没有停留 */
  hover?(at: GesturePoint): void;
  /** 指针离开了元素 */
  leave?(): void;
  /** 键盘的“回到全貌”（0 键） */
  reset?(): void;
}

/** 按下后移动不超过这么多像素、不超过这么久，松开算轻点 */
const TAP_SLOP = 6;
const TAP_MS = 500;
/** 滚轮一格大约 100：缩放 1.2 倍 */
const WHEEL_ZOOM = 0.0018;
const KEY_PAN = 60;
const KEY_ZOOM = 1.25;

/** 开始认 element 上的手势，返回停止的函数 */
export function observeGestures(element: HTMLElement, handlers: GestureHandlers): () => void {
  const pointers = new Map<number, GesturePoint>();
  let moved = 0;
  let pressedAt = 0;
  /** 两指时上一下的间距与中点 */
  let pinch: { distance: number; center: GesturePoint } | null = null;

  const local = (event: { clientX: number; clientY: number }): GesturePoint => {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const center = (): GesturePoint => ({ x: element.clientWidth / 2, y: element.clientHeight / 2 });
  const measure = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return null;
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  };

  /** 指针现在是不是停在元素自己身上（不是它里面的东西上） */
  let over = false;

  const down = (event: PointerEvent) => {
    if (event.target !== element) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) {
      moved = 0;
      pressedAt = event.timeStamp;
    }
    pinch = measure();
  };

  const move = (event: PointerEvent) => {
    const at = local(event);
    const last = pointers.get(event.pointerId);
    if (!last) {
      if (event.target !== element) {
        // 移到了里面的东西上：对元素自己来说等于离开了
        if (over) handlers.leave?.();
        over = false;
      } else if (event.pointerType === 'mouse') {
        over = true;
        handlers.hover?.(at);
      }
      return;
    }
    pointers.set(event.pointerId, at);
    if (pointers.size === 1) {
      moved += Math.abs(at.x - last.x) + Math.abs(at.y - last.y);
      // 轻点时手会抖一下：超过阈值才开始平移
      if (moved > TAP_SLOP) handlers.pan?.(at.x - last.x, at.y - last.y);
      return;
    }
    const next = measure();
    if (pinch && next) {
      moved = Infinity;
      handlers.pan?.(next.center.x - pinch.center.x, next.center.y - pinch.center.y);
      if (pinch.distance > 0) handlers.zoom?.(next.distance / pinch.distance, next.center);
    }
    pinch = next;
  };

  const up = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    const tapped =
      event.type === 'pointerup' &&
      pointers.size === 0 &&
      moved <= TAP_SLOP &&
      event.timeStamp - pressedAt <= TAP_MS;
    pinch = measure();
    if (tapped) handlers.tap?.(local(event));
  };

  const wheel = (event: WheelEvent) => {
    if (event.target !== element) return;
    event.preventDefault();
    // 行模式（deltaMode 1，老式鼠标）的一格算 40 像素
    const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
    handlers.zoom?.(Math.exp(-delta * WHEEL_ZOOM), local(event));
  };

  const key = (event: KeyboardEvent) => {
    if (event.target !== element) return;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const shift = pan[event.key];
    if (shift) handlers.pan?.(...shift);
    else if (event.key === '+' || event.key === '=') handlers.zoom?.(KEY_ZOOM, center());
    else if (event.key === '-') handlers.zoom?.(1 / KEY_ZOOM, center());
    else if (event.key === '0') handlers.reset?.();
    else return;
    event.preventDefault();
  };

  const leave = () => {
    over = false;
    handlers.leave?.();
  };

  const touchAction = element.style.touchAction;
  element.style.touchAction = 'none';
  if (element.tabIndex < 0) element.tabIndex = 0;
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
  element.addEventListener('pointerleave', leave);
  element.addEventListener('wheel', wheel, { passive: false });
  element.addEventListener('keydown', key);

  return () => {
    element.style.touchAction = touchAction;
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', up);
    element.removeEventListener('pointerleave', leave);
    element.removeEventListener('wheel', wheel);
    element.removeEventListener('keydown', key);
  };
}
