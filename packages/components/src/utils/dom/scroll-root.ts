/**
 * “整页滚动”滚的是谁。普通网页里是窗口；站点整个放在舞台里的时候（见引擎的 stage 包），文档不滚了，
 * 滚的是舞台里的一个盒子——盯着窗口滚动的组件（本页目录的高亮、回到顶部）在那里就都不对。
 * 所以最外面说一声滚的是谁，这些组件没有另外指定容器时就认它：
 *
 *   provideScrollRoot(() => scroller);      // 站点最外面（setup 里）
 *   const pageScroller = usePageScroller(); // 组件里：没人说过就是 null，也就是窗口
 *
 * 这个文件是这边（rune-engine）加的，上游没有；同步上游时它留着，用到它的那几处改动由同步脚本重新打上
 * （scripts/sync-upstream.mjs）。
 */
import { inject, provide, type InjectionKey } from 'vue';

const SCROLL_ROOT: InjectionKey<() => HTMLElement | null> = Symbol('scroll-root');

/** 说一声：这棵子树里“整页滚动”滚的是这个元素（还没挂上时给 null，之后给了会跟着变） */
export function provideScrollRoot(root: () => HTMLElement | null): void {
  provide(SCROLL_ROOT, root);
}

const WINDOW = () => null;

/** 整页滚动的那个元素；null 是窗口（没人说过）。在 setup 里调用 */
export function usePageScroller(): () => HTMLElement | null {
  return inject(SCROLL_ROOT, WINDOW);
}
