/**
 * 固定步长的时钟：把现实里流过的时间换成“该推进几步”。暂停、倍速都在这里，玩法代码不自己计时。
 * 一次最多推进 maxSteps 步：标签页切回来、机器卡了一下时不会一口气补几百步。
 */
export interface StepClock {
  /** 一步对应多少毫秒（1 倍速时） */
  readonly stepMs: number;
  /** 倍速，1 为正常 */
  speed: number;
  paused: boolean;
  /** 告诉时钟现实里过了多久，返回这次该推进几步 */
  advance(elapsedMs: number): number;
  /** 当前这一步走了多少（0–1）：渲染在上一步和这一步之间插值用 */
  readonly alpha: number;
}

export function createStepClock(stepMs: number, maxSteps = 8): StepClock {
  let accumulated = 0;
  return {
    stepMs,
    speed: 1,
    paused: false,
    advance(elapsedMs) {
      if (this.paused) return 0;
      accumulated += elapsedMs * this.speed;
      let steps = Math.floor(accumulated / stepMs);
      if (steps > maxSteps) {
        steps = maxSteps;
        accumulated = 0;
      } else {
        accumulated -= steps * stepMs;
      }
      return steps;
    },
    get alpha() {
      return accumulated / stepMs;
    },
  };
}
