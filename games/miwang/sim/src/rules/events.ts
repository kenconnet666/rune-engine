/** 事件：每天有小概率发生一件事（集会、灾害、谣言、突破、拨款、自发变异），双方都会在新闻里看到 */
import { chance, clamp, nextFloat } from '@rune-engine/core';
import type { EventDef } from '../config.ts';
import { FOR_BOTH, REACHED, report, TECH_ACTIVE, type OutbreakState } from '../state.ts';

/** 按相对的常见程度抽一种事件 */
function pickEvent(state: OutbreakState): EventDef | undefined {
  const { events } = state.config;
  let total = 0;
  for (const event of events) total += event.weight;
  let at = nextFloat(state.random) * total;
  for (const event of events) {
    at -= event.weight;
    if (at < 0) return event;
  }
  return events.at(-1);
}

/** 按人口抽一个地区：人多的地方更容易出事 */
function pickRegion(state: OutbreakState): number {
  const { regions } = state.config;
  let at = nextFloat(state.random) * state.worldPopulation;
  for (let r = 0; r < regions.length; r++) {
    at -= regions[r]!.population;
    if (at < 0) return r;
  }
  return regions.length - 1;
}

export function rollEvents(state: OutbreakState) {
  const { rules, events } = state.config;
  if (events.length === 0 || !chance(state.random, rules.eventChance)) return;
  const event = pickEvent(state);
  if (!event) return;
  const amount = event.amount ?? 0;
  const until = state.tick + (event.days ?? 0);

  switch (event.kind) {
    case 'gathering':
    case 'disaster': {
      const region = pickRegion(state);
      // 集会只在已经有感染的地方才算得上新闻；灾害哪里都算
      if (event.kind === 'gathering') {
        if ((state.reached[region]! & REACHED) === 0) return;
        state.gatheringUntil[region] = until;
      } else {
        state.disasterUntil[region] = until;
      }
      report(state, 'event', FOR_BOTH, region, event.id);
      return;
    }
    case 'rumor':
      state.trust = clamp(state.trust - amount, 0, 1);
      break;
    case 'breakthrough': {
      // 没有进行中的研究就无事发生
      let any = false;
      for (let index = 0; index < state.techs.length; index++) {
        if (state.techs[index] !== TECH_ACTIVE) continue;
        state.techRemaining[index]! *= 1 - amount;
        any = true;
      }
      if (!any) return;
      break;
    }
    case 'funding':
      state.budget += amount;
      break;
    case 'mutation':
      state.points += amount;
      break;
  }
  report(state, 'event', FOR_BOTH, -1, event.id);
}
