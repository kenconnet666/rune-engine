/**
 * 确定性的数学函数：模拟里不直接用 Math.exp 这类函数（不同引擎的实现差在最后几位，联机和回放会分叉），
 * 用这里只靠加减乘除算出来的版本。精度够游戏用（exp 的相对误差在 1e-13 以内）。
 */

/** 2 的整数次幂，逐次乘 2、除以 2 得到（每一步都精确） */
const POW2_OFFSET = 1100;
const POW2 = new Float64Array(POW2_OFFSET * 2 + 1);
POW2[POW2_OFFSET] = 1;
for (let i = 1; i <= POW2_OFFSET; i++) {
  POW2[POW2_OFFSET + i] = POW2[POW2_OFFSET + i - 1]! * 2;
  POW2[POW2_OFFSET - i] = POW2[POW2_OFFSET - i + 1]! / 2;
}

const LN2 = 0.6931471805599453;

/** e 的 x 次幂：先减掉 ln2 的整数倍，剩下的小量用 13 阶泰勒展开，再乘回 2 的幂 */
export function exp(x: number): number {
  if (x !== x) return x;
  if (x > 709.78) return Infinity;
  if (x < -745.13) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let sum = 1;
  for (let i = 13; i >= 1; i--) sum = 1 + (r / i) * sum;
  // 分两次乘：k 接近上下限时一次乘的 2 的幂会溢出或下溢
  const half = k >> 1;
  return sum * POW2[POW2_OFFSET + half]! * POW2[POW2_OFFSET + k - half]!;
}

/** 把 value 夹在 [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** a 到 b 之间按 t（0–1）取值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
