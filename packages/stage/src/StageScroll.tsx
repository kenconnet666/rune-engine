/**
 * 滚动的一块：滚动由引擎接管，不靠浏览器。
 *
 *   <StageScroll sx={styles.main} onReady={(scroll) => …}>…很长的内容…</StageScroll>
 *
 * 它在原地留一个“视口”（一个空盒子，在哪、多大由 sx 定），内容单独成一层、整份那么高。界面画在画布里时
 * 内容整份只拍一次，渲染线程每帧把露出来的那一块画出来：**滚动不用重拍、不用重排，主线程忙不忙都照样滚**，
 * 代价跟露出来的面积走，不跟内容的长度走。界面叠在画布上面时是同一套做法（内容层往回挪、裁掉露出来的那块以外）。
 *
 * 浏览器帮不上的那些这里自己做：滚轮、键盘（翻页、空格、Home、End、上下）、滚动条（能拖）、
 * 焦点用键盘走到看不见的地方时滚过去。还没做的：触摸的拖动和惯性、选中文字拖到边上时自动滚、页内查找滚到结果。
 * 内容里 `position: sticky` 的东西粘不住（内容本身并没有在滚）：要粘着的东西放在这一块外面、另外成层。
 *
 * 视口那个元素对脚本来说“像个滚动容器”：读写 scrollTop、读 scrollHeight、调 scrollTo、听 scroll 事件都行——
 * 认滚动容器的代码（本页目录的高亮、回到顶部）拿它当容器就能用。它的内容不在它里面，所以
 * element.scrollIntoView() 不管用：用 onReady 给的 reveal。
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, shallowRef, Teleport, watch, type VNodeChild } from 'vue';
import { useStage, type StageLayerHandle } from './stage-context.ts';
import { StageLayer } from './StageLayer.tsx';

export interface StageScrollHandle {
  /** 视口那个元素（像个滚动容器，见文件头） */
  readonly element: HTMLElement;
  /** 滚到哪（内容里的纵向位置，CSS 像素）；smooth 时缓着滚过去 */
  scrollTo(top: number, smooth?: boolean): void;
  /**
   * 让内容里的一个元素露出来。align 是 start 时把它放到视口顶上（让开它的 scroll-margin-top），
   * nearest（默认）时已经看得见就不动、不然滚最少的距离
   */
  reveal(element: Element, options?: { align?: 'start' | 'nearest'; smooth?: boolean }): void;
}

export interface StageScrollProps {
  /** 视口那个盒子的样式：在哪、多大 */
  sx?: SxStyles;
  /** 视口那个盒子的行内样式：位置要跟着状态变的时候用（两边的栏在不在） */
  style?: Record<string, string>;
  /** 内容那一层的样式 */
  contentSx?: SxStyles;
  /** 内容那一层的次序，默认 0.5（在一直在的界面下面：它上面可以压着顶栏、侧栏） */
  order?: number;
  onReady?: (scroll: StageScrollHandle) => void;
  children?: VNodeChild;
}

/** 滚动条：宽、离边上多远、最短多长（像素）；停下多久之后藏起来（毫秒） */
const THUMB_WIDTH = 6;
const THUMB_INSET = 3;
const THUMB_MIN = 28;
const THUMB_HIDE_MS = 900;
/** 滚轮按“行”报的时候一行算多少像素；上下键一下滚多少 */
const LINE = 40;

const styles = css.create({
  // 视口：只占着地方，自己不接指针（点到的是它下面的内容层）
  viewport: { pointerEvents: 'none' },
  content: { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, pointerEvents: 'auto' },
  // 不在舞台里：就是个普通的滚动盒子
  plain: { overflowY: 'auto' },
  thumb: {
    width: `${THUMB_WIDTH}px`,
    borderRadius: `${THUMB_WIDTH}px`,
    backgroundColor: 'rgba(128, 128, 128, 0.55)',
    transition: 'opacity 300ms',
    pointerEvents: 'auto',
    touchAction: 'none',
  },
});

/** 指针下面有没有自己能滚的盒子（代码块、表格）：有、而且这个方向还滚得动，就让它先滚 */
function scrollsInside(target: EventTarget | null, limit: Element, deltaY: number): boolean {
  for (
    let node = target instanceof Element ? target : null;
    node && node !== limit;
    node = node.parentElement
  ) {
    if (node.scrollHeight <= node.clientHeight + 1) continue;
    const overflow = getComputedStyle(node).overflowY;
    if (overflow !== 'auto' && overflow !== 'scroll') continue;
    const room =
      deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
    if (room) return true;
  }
  return false;
}

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export const StageScroll = _component(
  ({ sx, style, contentSx, order = 0.5, onReady, children }: StageScrollProps) => {
    const stage = useStage();
    const viewport = shallowRef<HTMLElement | null>(null);
    const content = shallowRef<HTMLElement | null>(null);
    const setViewport = (element: unknown) => (viewport.value = element as HTMLElement | null);
    const setContent = (element: unknown) => (content.value = element as HTMLElement | null);
    let handle: StageLayerHandle | undefined;
    /** 要滚到哪 */
    let top = 0;
    /** 视口在舞台里的位置和大小 */
    let view = { x: 0, y: 0, width: 0, height: 0 };
    /** 滚动条：在哪、多长、现在显不显示 */
    let thumb = _state({ x: 0, y: 0, height: 0, shown: false });
    let hiding: ReturnType<typeof setTimeout> | undefined;

    const contentHeight = () => content.value?.offsetHeight ?? 0;
    const limit = () => Math.max(0, contentHeight() - view.height);

    function placeThumb(shown = thumb.shown) {
      const total = contentHeight();
      const track = view.height - THUMB_INSET * 2;
      const height = total > view.height ? Math.max(THUMB_MIN, (track * view.height) / total) : 0;
      thumb = {
        x: view.x + view.width - THUMB_WIDTH - THUMB_INSET,
        y: view.y + THUMB_INSET + (limit() > 0 ? ((track - height) * top) / limit() : 0),
        height,
        shown: shown && height > 0,
      };
    }
    function showThumb() {
      placeThumb(true);
      clearTimeout(hiding);
      hiding = setTimeout(() => placeThumb(false), THUMB_HIDE_MS);
    }

    function scrollTo(next: number, smooth = false) {
      const clamped = Math.round(Math.min(limit(), Math.max(0, next)));
      if (clamped === top) return;
      top = clamped;
      handle?.scrollTo(0, top, smooth);
      viewport.value?.dispatchEvent(new Event('scroll'));
      follow();
      showThumb();
    }

    /**
     * 内容画到新位置之前，量到的位置还是旧的（界面画在画布里时，位置是渲染线程画了才更新的，缓着滚还要走一小会儿）。
     * 听 scroll 的代码要量位置（本页目录的高亮）：所以画面还在动的时候每帧再说一次“滚了”，停稳了才不说
     */
    let following = 0;
    function follow() {
      cancelAnimationFrame(following);
      let last = NaN;
      let still = 0;
      const check = () => {
        const now = content.value?.getBoundingClientRect().top ?? NaN;
        still = now === last ? still + 1 : 0;
        if (now !== last) viewport.value?.dispatchEvent(new Event('scroll'));
        last = now;
        // 连着几帧没动就是停稳了（也给渲染线程留出开始动的时间）
        if (still < 6) following = requestAnimationFrame(check);
      };
      following = requestAnimationFrame(check);
    }

    const reveal: StageScrollHandle['reveal'] = (
      element,
      { align = 'nearest', smooth = true } = {},
    ) => {
      const box = content.value;
      if (!box) return;
      // 量到的是画出来的位置：减掉内容层现在画在哪，就是它在内容里的位置
      const inner = element.getBoundingClientRect();
      const offset = inner.top - box.getBoundingClientRect().top;
      const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
      if (align === 'start' || offset - margin < top) scrollTo(offset - margin, smooth);
      else if (offset + inner.height > top + view.height) {
        scrollTo(offset + inner.height - view.height, smooth);
      }
    };

    /** 视口在哪、多大：内容层跟着它 */
    function measure() {
      const element = viewport.value;
      const root = stage?.root.value;
      if (!element || !root || !handle) return;
      const box = element.getBoundingClientRect();
      const base = root.getBoundingClientRect();
      view = {
        x: box.left - base.left,
        y: box.top - base.top,
        width: box.width,
        height: box.height,
      };
      if (content.value) content.value.style.width = `${view.width}px`;
      handle.moveTo(view.x, view.y);
      handle.view(view.width, view.height);
      // 内容变矮了、视口变高了：滚过头的收回来
      if (top > limit()) scrollTo(limit());
      placeThumb();
    }
    const resized = new ResizeObserver(measure);

    const onWheel = (event: WheelEvent) => {
      const box = content.value;
      if (!box || event.ctrlKey || scrollsInside(event.target, box, event.deltaY)) return;
      const unit = event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? view.height : 1;
      scrollTo(top + event.deltaY * unit, true);
    };
    const onKey = (event: KeyboardEvent) => {
      const box = content.value;
      const active = document.activeElement;
      // 焦点在这块内容里、或者哪儿都不在的时候才管；正在打字的、别处已经处理了的不管
      if (!box || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditable(event.target) || (active !== document.body && !box.contains(active))) return;
      const page = view.height * 0.9;
      const step: Record<string, number | undefined> = {
        PageDown: page,
        PageUp: -page,
        ' ': event.shiftKey ? -page : page,
        ArrowDown: LINE,
        ArrowUp: -LINE,
        Home: -Infinity,
        End: Infinity,
      };
      const by = step[event.key];
      if (by === undefined || (event.key === ' ' && active !== document.body)) return;
      event.preventDefault();
      scrollTo(top + by, true);
    };
    // 用键盘把焦点走到了看不见的地方：滚过去（鼠标点的不管，点得到就是看得见）
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) {
        reveal(event.target);
      }
    };

    watch(
      content,
      (element, previous) => {
        previous?.removeEventListener('wheel', onWheel);
        previous?.removeEventListener('focusin', onFocus);
        handle?.remove();
        handle = undefined;
        if (!element || !stage) return;
        handle = stage.addLayer(element, order, { fill: false });
        element.addEventListener('wheel', onWheel, { passive: true });
        element.addEventListener('focusin', onFocus);
        resized.observe(element);
        measure();
      },
      { flush: 'post' },
    );
    watch(
      viewport,
      (element) => {
        if (!element || !stage) return;
        // 让它对脚本来说像个滚动容器（见文件头）
        Object.defineProperties(element, {
          scrollTop: { configurable: true, get: () => top, set: (next: number) => scrollTo(next) },
          scrollHeight: { configurable: true, get: contentHeight },
          scrollTo: {
            configurable: true,
            value: (first?: ScrollToOptions | number, second?: number) => {
              const options = typeof first === 'object' ? first : { top: second };
              scrollTo(options.top ?? top, options.behavior === 'smooth');
            },
          },
        });
        resized.observe(element);
        const root = stage.root.value;
        if (root) resized.observe(root);
        measure();
        onReady?.({ element, scrollTo, reveal });
      },
      { flush: 'post' },
    );
    if (stage) document.addEventListener('keydown', onKey);
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onKey);
      resized.disconnect();
      clearTimeout(hiding);
      cancelAnimationFrame(following);
      handle?.remove();
    });

    /** 拖滚动条：按下时记住从哪开始，之后按挪了多远算 */
    const drag = (event: PointerEvent) => {
      const bar = event.currentTarget as HTMLElement;
      const from = { pointer: event.clientY, top };
      const travel = view.height - THUMB_INSET * 2 - thumb.height;
      bar.setPointerCapture(event.pointerId);
      const move = (next: PointerEvent) => {
        if (travel > 0) scrollTo(from.top + ((next.clientY - from.pointer) * limit()) / travel);
      };
      const stop = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', stop);
        bar.removeEventListener('pointercancel', stop);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', stop);
      bar.addEventListener('pointercancel', stop);
    };

    return () => {
      if (!stage) return <div {...css.attrs(styles.plain, sx)}>{children}</div>;
      const host = stage.root.value;
      return (
        <>
          <div ref={setViewport} style={style} {...css.attrs(styles.viewport, sx)} />
          {host && (
            <Teleport to={host}>
              <div ref={setContent} {...css.attrs(styles.content, contentSx)}>
                {children}
              </div>
            </Teleport>
          )}
          {thumb.height > 0 && (
            <StageLayer fit="content" order={Math.max(order, 1) + 0.8} x={thumb.x} y={thumb.y}>
              <div
                aria-hidden="true"
                // 显示、藏起来写在样式上（两种摆法都认；这一层很小，变一下重拍得起）
                style={{
                  height: `${Math.round(thumb.height)}px`,
                  opacity: thumb.shown ? '1' : '0',
                }}
                onPointerdown={drag}
                {...css.attrs(styles.thumb)}
              />
            </StageLayer>
          )}
        </>
      );
    };
  },
);
