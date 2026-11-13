/**
 * 性能预算里能在 Node 里量的那几项（全部的预算和它们的来由见 docs/performance.md）：
 * 用真的世界数据让两个电脑对打一局，看模拟一天要多久、经网络发的一份状态有多大、一局的记录有多大。
 * 线都定得比现状宽好几倍——CI 的机器有快有慢，这里要拦的是“慢了一个数量级”“大了好几倍”这种事，不是百分之十的波动。
 */
import { createConfig } from '@miwang/content';
import { ATTACKER, decide, DEFENDER, outbreak, type Command } from '@miwang/sim';
import { toWire, type Stamped } from '@rune-engine/core';
import { encodeMessage } from '@rune-engine/net';
import { expect, it } from 'vitest';

/** 模拟一天（两方电脑各想一次、各看一次、走一步）平均不超过这么多毫秒。10 倍速时主机每 40 毫秒要走一天 */
const DAY_MS = 5;
/** 经网络发的一份状态不超过这么多字节。走中转时每秒大约发八份 */
const VIEW_BYTES = 16 * 1024;
/** 一局的记录（存档、云存档里放的就是它）写成 JSON 不超过这么多字符。云端一份的上限是压缩后 512 KB */
const RECORDING_CHARS = 256 * 1024;

it('性能预算：模拟的速度、一份状态的大小、一局记录的大小', () => {
  const config = createConfig(40595, '2026-01-01');
  const state = outbreak.create(config);
  const commands: Stamped<Command>[] = [];
  let largestView = 0;

  const started = performance.now();
  let days = 0;
  for (; !state.outcome && days < 400; days++) {
    const today: Stamped<Command>[] = [];
    for (const player of [ATTACKER, DEFENDER]) {
      const view = outbreak.observe(state, player);
      for (const command of decide(view, config, 1))
        today.push({ tick: state.tick, player, command });
      if (days % 40 === 0) {
        const message = { type: 'view', tick: days, hash: 0, speed: 1, paused: false, view };
        largestView = Math.max(largestView, encodeMessage(message).byteLength);
      }
    }
    commands.push(...today);
    outbreak.step(state, today);
  }
  const perDay = (performance.now() - started) / days;

  expect(days).toBeGreaterThan(100);
  expect(perDay, `模拟一天用了 ${perDay.toFixed(2)} 毫秒`).toBeLessThan(DAY_MS);
  expect(largestView).toBeLessThan(VIEW_BYTES);
  // 太小也不对：说明量的不是真的状态
  expect(largestView).toBeGreaterThan(2000);
  const recording = JSON.stringify(toWire({ config, commands, ticks: days }));
  expect(recording.length).toBeLessThan(RECORDING_CHARS);
});
