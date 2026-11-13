import { describe, expect, it } from 'vitest';
import {
  binomial,
  createStepClock,
  exp,
  fnv1a,
  nextFloat,
  nextUint32,
  seedRandom,
} from './index.ts';

describe('随机数', () => {
  it('同一个种子给出同一个序列，状态可以存成 JSON 再接着用', () => {
    const a = seedRandom(42);
    const b = seedRandom(42);
    for (let i = 0; i < 100; i++) expect(nextUint32(a)).toBe(nextUint32(b));
    const restored = JSON.parse(JSON.stringify(a)) as typeof a;
    for (let i = 0; i < 100; i++) expect(nextUint32(restored)).toBe(nextUint32(a));
  });

  it('序列在所有机器上都一样（x64、ARM 的 CI 核对同一个数）', () => {
    const state = seedRandom(20261113);
    const values = new Float64Array(10000);
    for (let i = 0; i < values.length; i++) values[i] = nextFloat(state);
    expect(fnv1a(values)).toBe(GOLDEN_RANDOM);
  });

  it('二项分布的均值大致是 n × p，结果不超出 [0, n]', () => {
    const state = seedRandom(7);
    for (const [n, p] of [
      [10, 0.3],
      [1000, 0.02],
      [1_000_000, 0.4],
      [5_000_000, 0.0000004],
    ] as const) {
      let sum = 0;
      for (let i = 0; i < 4000; i++) {
        const value = binomial(state, n, p);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(n);
        sum += value;
      }
      expect(sum / 4000 / (n * p)).toBeGreaterThan(0.93);
      expect(sum / 4000 / (n * p)).toBeLessThan(1.07);
    }
  });
});

describe('确定性的 exp', () => {
  it('和 Math.exp 相差不到 1e-13（相对误差）', () => {
    for (let x = -40; x <= 40; x += 0.137) {
      expect(Math.abs(exp(x) / Math.exp(x) - 1)).toBeLessThan(1e-13);
    }
    expect(exp(0)).toBe(1);
    expect(exp(-1000)).toBe(0);
    expect(exp(1000)).toBe(Infinity);
  });

  it('结果在所有机器上逐位相同', () => {
    const values = new Float64Array(4000);
    for (let i = 0; i < values.length; i++) values[i] = exp((i - 2000) / 97);
    expect(fnv1a(values)).toBe(GOLDEN_EXP);
  });
});

describe('固定步长的时钟', () => {
  it('按倍速把流过的时间换成步数，暂停时不走，一次不超过上限', () => {
    const clock = createStepClock(100, 5);
    expect(clock.advance(250)).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5);
    clock.speed = 2;
    expect(clock.advance(100)).toBe(2);
    clock.paused = true;
    expect(clock.advance(10_000)).toBe(0);
    clock.paused = false;
    expect(clock.advance(10_000)).toBe(5);
    expect(clock.alpha).toBe(0);
  });
});

// 跨机器核对用的定值：第一次在 x64 上算出来填进去，之后任何机器算出不同的数都说明确定性破了
const GOLDEN_RANDOM = 671499131;
const GOLDEN_EXP = 1140529580;
