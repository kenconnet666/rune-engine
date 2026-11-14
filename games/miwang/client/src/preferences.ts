/**
 * 打法上的偏好，记在这台设备上。现在只有一项：
 * 一个人玩时，冒出一件要拿主意的事要不要自己把时间停下（默认停——开着倍速时七八天一晃就过，来不及看）。
 */
import { jsonStore } from '@rune-engine/runtime';
import { shallowRef, watch } from 'vue';

const store = jsonStore<boolean>('miwang:autopause', 'device');

export const autoPause = shallowRef(store.load() !== false);
watch(autoPause, (on) => store.save(on));
