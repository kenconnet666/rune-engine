/** 按权重抽一个：事件、抉择、短期任务都是“表里每一项有个相对的常见程度” */
import { nextFloat, type RandomState } from '@rune-engine/core';

/** 抽中的下标；权重全是 0（没有可抽的）时是 -1。总是用掉一个随机数 */
export function pickWeighted(random: RandomState, weights: readonly number[]): number {
  let total = 0;
  for (const weight of weights) total += weight;
  let at = nextFloat(random) * total;
  if (total <= 0) return -1;
  for (let index = 0; index < weights.length; index++) {
    at -= weights[index]!;
    if (at < 0) return index;
  }
  // 浮点误差落到了最后一项的外面：算最后一个有权重的
  return weights.findLastIndex((weight) => weight > 0);
}
