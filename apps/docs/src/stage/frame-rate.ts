/**
 * 两条线程各一秒画几帧：主线程（网页自己的帧）和渲染线程（画进画布时把界面画到屏幕上的那条）。
 * 角上的开关（StageSwitch）把它显示出来——“顺不顺”先看这两个数，再谈感觉。
 */
import type { UiRendererStats } from '@rune-engine/stage/ui-renderer';
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

/** 渲染线程报上来的（没画进画布时一直是空的） */
const renderStats = shallowRef<UiRendererStats | null>(null);
export const reportRenderStats = (stats: UiRendererStats) => (renderStats.value = stats);

/** 隔多久更新一次显示（毫秒） */
const EVERY_MS = 500;

/** 在组件里用：返回主线程的帧率和渲染线程的帧率（都是刚过去半秒的） */
export function useFrameRates() {
  const main = shallowRef<UiRendererStats | null>(null);
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
        if (since > 0) main.value = { fps: (frames * 1000) / (now - since), worstMs };
        since = now;
        frames = 0;
        worstMs = 0;
      }
      running = requestAnimationFrame(tick);
    };
    running = requestAnimationFrame(tick);
  });
  onBeforeUnmount(() => cancelAnimationFrame(running));
  return { main, render: renderStats };
}
