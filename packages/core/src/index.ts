/**
 * 模拟内核：让一局游戏在任何地方（浏览器、Worker、Node、云端）算出逐位相同的结果。
 * 这里的代码只用加减乘除、开方和取整：实测 sin、cos、exp、log 在不同版本的引擎之间不一致，
 * 要用它们时走 math.ts 里自己实现的版本。
 */
export { dateAtTick, dateFromText, dateToText } from './calendar.ts';
export { createStepClock, type StepClock } from './clock.ts';
export { fnv1a, hashBytes, hashNumbers, HASH_SEED } from './hash.ts';
export { clamp, exp, lerp } from './math.ts';
export {
  binomial,
  chance,
  nextFloat,
  nextInt,
  nextUint32,
  seedRandom,
  type RandomState,
} from './random.ts';
export {
  compareNumeric,
  isDecimal,
  isNumeric,
  numericText,
  toDecimal,
  toNumber,
  type Numeric,
} from './numeric.ts';
export { commandsAt, replay, type Recording } from './replay.ts';
export type { PlayerId, Simulation, Stamped } from './simulation.ts';
export { fromWire, toWire } from './wire.ts';
