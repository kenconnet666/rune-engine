/** 两条线程各一秒几帧：渲染线程的是它自己报上来的，主线程的在这里数 */
import type { ViewRendererStats } from '@rune-engine/view';
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

export const renderRate = shallowRef<ViewRendererStats | null>(null);

/** 隔多久更新一次（毫秒） */
const EVERY_MS = 500;

/** 在组件里用：主线程刚过去半秒的帧率 */
export function useMainRate() {
  const rate = shallowRef<ViewRendererStats | null>(null);
  let running = 0;
  onMounted(() => {
    let since = 0;
    let last = 0;
    let frames = 0;
    let worstMs = 0;
    const tick = (now: number) => {
      if (last > 0) worstMs = Math.max(worstMs, now - last);
      last = now;
      frames++;
      if (now - since >= EVERY_MS) {
        if (since > 0) rate.value = { fps: (frames * 1000) / (now - since), worstMs };
        since = now;
        frames = 0;
        worstMs = 0;
      }
      running = requestAnimationFrame(tick);
    };
    running = requestAnimationFrame(tick);
  });
  onBeforeUnmount(() => cancelAnimationFrame(running));
  return rate;
}
