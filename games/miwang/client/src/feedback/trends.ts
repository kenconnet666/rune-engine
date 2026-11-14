/**
 * 各地区这一周涨了多少：界面自己记最近几天各地区的病例数，拿现在的减去一周前的。
 * 模拟只给“现在”，不给每个地区的历史；这里记的是这一方自己看得到的数（守方是按上报估的），不多知道任何东西。
 */
import type { OutbreakView } from '@miwang/sim';
import { shallowRef, watchEffect, type ShallowRef } from 'vue';

/** 和多少天前比 */
const SPAN_DAYS = 7;
/** 至少隔这么多天才比得出有意义的数 */
const MIN_DAYS = 3;

/** 盯着这一方的状态，给出各地区一周的增量；数据还不够（刚开局、刚读档）时是 null。要在组件的 setup 里调 */
export function watchRegionGrowth(
  view: () => OutbreakView | null,
): ShallowRef<Float64Array | null> {
  const growth = shallowRef<Float64Array | null>(null);
  let samples: { tick: number; cases: Float64Array }[] = [];

  watchEffect(() => {
    const now = view();
    if (!now) return;
    const last = samples.at(-1);
    // 倒回去了、换了一方：之前记的不是一回事了
    if (last && (now.tick < last.tick || now.cases.length !== last.cases.length)) samples = [];
    if (samples.at(-1)?.tick !== now.tick) {
      samples.push({ tick: now.tick, cases: now.cases.slice() });
      while (samples.length > 0 && samples[0]!.tick < now.tick - SPAN_DAYS) samples.shift();
    }
    const oldest = samples[0];
    growth.value =
      oldest && now.tick - oldest.tick >= MIN_DAYS
        ? now.cases.map((value, region) => value - oldest.cases[region]!)
        : null;
  });
  return growth;
}
