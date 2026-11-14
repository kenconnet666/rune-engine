/**
 * 措施的预案：一下子把一个地区的几项措施设到位，省得一项一项点。
 * 现成的有四套（只动它写了的那几项：净水、灭蚊这种看情况的不碰；封锁和口子每一套都写明了——
 * 从“围堵”换到“缓解”就是把封锁撤掉，不用先全撤再重开），再加一套自己存的——
 * 把某个地区现在的样子记下来，之后用到别处。自己存的那套记在这台设备上。
 */
import { MEASURES, type MeasureLevel } from '@miwang/sim';
import { jsonStore } from '@rune-engine/runtime';
import { shallowRef, watch } from 'vue';
import type { MeasurePlan } from './rules.ts';

export const PRESET_IDS = ['watch', 'mitigate', 'contain', 'clear'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** 不封锁、不关口子 */
const OPEN = { lockdown: 0, borders: 0, airports: 0, ports: 0 } as const;

export const PRESETS: Readonly<Record<PresetId, MeasurePlan>> = {
  /** 监测：先看清楚——检测、隔离开一点，口岸量体温 */
  watch: { testing: 2, isolation: 1, screening: 1, masks: 0, ...OPEN },
  /** 缓解：不封锁，把能做的都做足 */
  mitigate: { testing: 3, isolation: 3, masks: 2, screening: 2, ...OPEN },
  /** 围堵：封锁并切断往来 */
  contain: {
    testing: 3,
    isolation: 3,
    masks: 3,
    lockdown: 3,
    borders: 3,
    airports: 3,
    ports: 3,
    screening: 3,
  },
  /** 全撤 */
  clear: Object.fromEntries(MEASURES.map((measure) => [measure, 0 as MeasureLevel])),
};

const store = jsonStore<MeasurePlan>('miwang:preset', 'device');

const isPlan = (value: unknown): value is MeasurePlan =>
  typeof value === 'object' &&
  value !== null &&
  MEASURES.every((measure) => {
    const level = (value as Record<string, unknown>)[measure];
    return level === 0 || level === 1 || level === 2 || level === 3;
  });

const stored = store.load();
/** 自己存的那一套；还没存过是 null */
export const customPreset = shallowRef<MeasurePlan | null>(isPlan(stored) ? stored : null);
watch(customPreset, (plan) => {
  if (plan) store.save(plan);
});
