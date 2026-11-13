/**
 * 配色：标准的，或者色觉友好的（地图的色带和界面的颜色一起换）。选的哪一套记在这台设备上。
 * 两套各是什么见 render 包的 map-palette.ts 和 ui 包的 colorSafeTheme。
 */
import type { MapPaletteName } from '@rune-engine/render';
import { jsonStore } from '@rune-engine/runtime';
import { shallowRef, watch } from 'vue';

const store = jsonStore<MapPaletteName>('miwang:palette', 'device');

/** 现在用的哪一套；改它就换，也会记下来 */
export const palette = shallowRef<MapPaletteName>(store.load() === 'safe' ? 'safe' : 'standard');
watch(palette, (name) => store.save(name));
