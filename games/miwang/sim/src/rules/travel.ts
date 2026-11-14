/** 出行：带病的人沿陆路、航线、海运把感染带到别的地区 */
import { chance } from '@rune-engine/core';
import type { Links, PathogenStats } from '../config.ts';
import { REACHED, type Hop, type OutbreakState } from '../state.ts';
import { calendarBoost } from './calendar.ts';
import { expose, type DayTally } from './epidemic.ts';
import { after, strengthOf } from './regional.ts';

/** 期望值小到这个数以下就不掷了：省掉绝大多数没有意义的随机数 */
const NEGLIGIBLE = 1e-7;

/**
 * 算出这一天各地区输入了多少感染者，再一起落地。
 * 先全部算完再落地：这样结果和地区的排列顺序无关（否则排在后面的地区当天就能把刚输入的再传出去）。
 */
export function travel(
  state: OutbreakState,
  pathogen: PathogenStats,
  comply: number,
  tally: DayTally,
) {
  const { regions, rules } = state.config;
  const arrivals = new Float64Array(regions.length);
  /** 各地区今天第一批输入的感染者是从哪里、沿哪种路线来的（没有时 from 是 -1） */
  const firstFrom = new Int32Array(regions.length).fill(-1);
  const firstRoute: Hop['route'][] = [];
  // 潜伏的人照常出行；发病的人病得越重越走不动
  const mobility = 1 / (1 + rules.severityImmobility * pathogen.severity);
  // 日程：出行高峰时各条路线上的人都多；有国际赛事时坐飞机的人多
  const peak = 1 + calendarBoost(state, 'travel');
  const flights = peak + calendarBoost(state, 'games');

  /** 这个地区的口子现在漏不漏风（有人在走私）：漏的话关着也只剩几成效果 */
  const tight = (region: number) => (state.leakUntil[region]! > state.tick ? rules.leakGate : 1);

  /** 一个口子（口岸、机场、港口）：出发地和目的地谁管得严就按谁的档位算 */
  const gate = (
    from: number,
    to: number,
    measure: 'borders' | 'airports' | 'ports',
    effect: number,
  ) =>
    1 -
    effect *
      Math.max(
        strengthOf(rules, state.measures[from]!, measure) * tight(from),
        strengthOf(rules, state.measures[to]!, measure) * tight(to),
      ) *
      comply;

  const send = (from: number, to: number, route: Hop['route'], expected: number) => {
    // 目的地封锁、入境筛查都会拦下一部分
    const admitted =
      expected *
      after(rules, state.measures[to]!, 'lockdown', rules.lockdownTravel, comply) *
      after(rules, state.measures[to]!, 'screening', rules.screeningEffect, comply);
    if (admitted < NEGLIGIBLE || state.susceptible[to]! <= 0) return;
    const whole = Math.floor(admitted);
    const landed = whole + (chance(state.random, admitted - whole) ? 1 : 0);
    if (landed <= 0) return;
    arrivals[to]! += landed;
    if (firstFrom[to]! < 0) {
      firstFrom[to] = from;
      firstRoute[to] = route;
    }
  };

  const along = (
    from: number,
    links: Links,
    travelers: number,
    measure: 'airports' | 'ports',
    effect: number,
  ) => {
    const route = measure === 'airports' ? 'air' : 'sea';
    for (let i = 0; i < links.to.length; i++) {
      const to = links.to[i]!;
      send(from, to, route, travelers * links.weight[i]! * gate(from, to, measure, effect));
    }
  };

  for (let from = 0; from < regions.length; from++) {
    const carriers = state.exposed[from]! + state.infectious[from]! * mobility;
    if (carriers <= 0) continue;
    const leaving =
      carriers * after(rules, state.measures[from]!, 'lockdown', rules.lockdownTravel, comply);
    const region = regions[from]!;
    // 遭了灾的地方，人沿陆路往外逃
    const fleeing = state.disasterUntil[from]! > state.tick ? rules.refugeeLand : 1;
    for (const to of region.neighbors) {
      send(
        from,
        to,
        'land',
        leaving * rules.landRate * peak * fleeing * gate(from, to, 'borders', rules.bordersEffect),
      );
    }
    along(
      from,
      region.air,
      leaving * rules.airRate * flights * (1 + pathogen.aviation),
      'airports',
      rules.airportsEffect,
    );
    along(
      from,
      region.sea,
      leaving * rules.seaRate * peak * (1 + pathogen.maritime),
      'ports',
      rules.portsEffect,
    );
  }

  for (let to = 0; to < regions.length; to++) {
    if (arrivals[to]! <= 0) continue;
    // 第一次到这个地区：记下这一跳
    if ((state.reached[to]! & REACHED) === 0 && state.susceptible[to]! > 0) {
      state.hops.push({ tick: state.tick, from: firstFrom[to]!, to, route: firstRoute[to]! });
    }
    expose(state, to, arrivals[to]!, tally);
  }
}
