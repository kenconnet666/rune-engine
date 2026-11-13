/** 电脑对手的难度：0 简单、1 普通、2 困难 */
export type AiLevel = 0 | 1 | 2;

/**
 * 0–1 之间的“随机”数，只由步数和一个盐决定。电脑对手发出的命令会被记进对局记录，
 * 它自己不需要可重放；用确定的噪声只是为了同一局里同一步问两次得到同一个决定。
 */
export function noise(tick: number, salt: number): number {
  let h = Math.imul(tick + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
