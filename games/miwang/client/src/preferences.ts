/**
 * 偏好，记在这台设备上：
 *   autoPause  一个人玩时，冒出一件要拿主意的事要不要自己把时间停下（默认停——开着倍速时七八天一晃就过，来不及看）
 *   hudLook    对局里的面板是平实的，还是带“全息屏”的质感（扫描线、轻微闪烁；界面画在画布里才有）
 */
import { jsonStore } from '@rune-engine/runtime';
import { shallowRef, watch } from 'vue';

const store = jsonStore<boolean>('miwang:autopause', 'device');

export const autoPause = shallowRef(store.load() !== false);
watch(autoPause, (on) => store.save(on));

export type HudLook = 'plain' | 'holo';
const lookStore = jsonStore<HudLook>('miwang:look', 'device');

export const hudLook = shallowRef<HudLook>(lookStore.load() === 'holo' ? 'holo' : 'plain');
watch(hudLook, (look) => lookStore.save(look));
