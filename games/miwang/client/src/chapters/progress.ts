/** 章节打过了哪些：每章两方各记一次“通过”，存在这台设备上，章节页上打勾用 */
import type { ChapterId } from '@miwang/content';
import { jsonStore } from '@rune-engine/runtime';

export type ChapterProgress = Partial<
  Record<ChapterId, { readonly attacker?: boolean; readonly defender?: boolean }>
>;

const store = jsonStore<ChapterProgress>('miwang:chapters', 'device');

export const chapterProgress = (): ChapterProgress => store.load() ?? {};

/** 记下某一章用某一方通过了 */
export function markChapterPassed(id: ChapterId, attacker: boolean) {
  const all = chapterProgress();
  store.save({ ...all, [id]: { ...all[id], [attacker ? 'attacker' : 'defender']: true } });
}
