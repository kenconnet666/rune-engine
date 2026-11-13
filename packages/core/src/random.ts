/**
 * 可存档的随机数（sfc32）：状态是四个 32 位整数，放在模拟状态里一起存、一起回放。
 * 只用整数运算，任何引擎上的序列都一样。
 */
export interface RandomState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** 用一个整数种子建出状态（splitmix32 把种子摊开，再空转几次打散） */
export function seedRandom(seed: number): RandomState {
  let s = seed | 0;
  const next = () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) | 0;
  };
  const state: RandomState = { a: next(), b: next(), c: next(), d: 1 };
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

/** 下一个 32 位无符号整数 */
export function nextUint32(state: RandomState): number {
  const t = (((state.a + state.b) | 0) + state.d) | 0;
  state.d = (state.d + 1) | 0;
  state.a = state.b ^ (state.b >>> 9);
  state.b = (state.c + (state.c << 3)) | 0;
  state.c = ((state.c << 21) | (state.c >>> 11)) + t;
  state.c |= 0;
  return t >>> 0;
}

/** [0, 1) 上的小数 */
export function nextFloat(state: RandomState): number {
  return nextUint32(state) / 4294967296;
}

/** [0, bound) 上的整数 */
export function nextInt(state: RandomState, bound: number): number {
  return Math.floor(nextFloat(state) * bound);
}

/** 以 probability 的概率返回 true */
export function chance(state: RandomState, probability: number): boolean {
  return nextFloat(state) < probability;
}

/** 试验次数不超过它时逐次掷，超过时用正态近似 */
const EXACT_TRIALS = 24;

/**
 * n 次独立试验、每次成功概率 p，成功了几次。
 * n 小时逐次掷；n 大时用正态近似（12 个均匀数之和减 6 近似标准正态，只用加减乘除和开方），取整后夹在 [0, n]。
 */
export function binomial(state: RandomState, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= EXACT_TRIALS) {
    let hits = 0;
    for (let i = 0; i < n; i++) if (nextFloat(state) < p) hits++;
    return hits;
  }
  const mean = n * p;
  // 期望很小（稀有事件）时正态近似会把它抹成 0：改成先掷“有没有至少一次”，再在小范围里均匀取
  if (mean < 4) {
    let hits = 0;
    const perSlot = mean / 8;
    for (let i = 0; i < 8; i++) if (nextFloat(state) < perSlot) hits++;
    return Math.min(n, hits);
  }
  let normal = -6;
  for (let i = 0; i < 12; i++) normal += nextFloat(state);
  const value = Math.round(mean + normal * Math.sqrt(mean * (1 - p)));
  return value < 0 ? 0 : value > n ? n : value;
}
