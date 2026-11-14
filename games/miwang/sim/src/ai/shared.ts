/** 电脑对手的难度：0 简单、1 普通、2 困难 */
export type AiLevel = 0 | 1 | 2;

/**
 * 电脑对手的性格：同一个难度下打法的偏向，每局按种子定一种（所以这一局的对手和上一局不是一个路数）。
 * 攻方：steady 先铺开后致命（原来的打法）、swift 快攻（全押传播，早早收割）、
 *       lurker 潜伏（看重隐蔽，铺得很开才动手）、lethal 凶猛（很早就往致命走）。
 * 守方：steady 按部就班、cautious 谨慎（病例还很少就设防，手里多留钱）、
 *       scientist 重科研（钱先给研究，封锁来得晚）、frugal 惜经济（尽量不封锁，维持费压得低）。
 */
export const ATTACK_STYLES = ['steady', 'swift', 'lurker', 'lethal'] as const;
export const DEFEND_STYLES = ['steady', 'cautious', 'scientist', 'frugal'] as const;
export type AttackStyle = (typeof ATTACK_STYLES)[number];
export type DefendStyle = (typeof DEFEND_STYLES)[number];
export type AiStyle = AttackStyle | DefendStyle;

/** 这一局电脑对手是什么性格：由种子和它扮演哪一方定下来 */
export function aiStyle(seed: number, attacker: true): AttackStyle;
export function aiStyle(seed: number, attacker: false): DefendStyle;
export function aiStyle(seed: number, attacker: boolean): AiStyle;
export function aiStyle(seed: number, attacker: boolean): AiStyle {
  const styles: readonly AiStyle[] = attacker ? ATTACK_STYLES : DEFEND_STYLES;
  // 把种子搅一搅再取：相邻的种子不该轮着来
  const mixed = Math.floor(noise(Math.abs(seed) % 1_000_003, attacker ? 11 : 12) * styles.length);
  return styles[mixed] ?? 'steady';
}

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
