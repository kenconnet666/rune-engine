/** 出行：带病的人沿陆路、航线、海运把感染带到别的地区 */
import { chance } from '@rune-engine/core';
import type { Links, PathogenStats } from '../config.ts';
import type { OutbreakState } from '../state.ts';
import { expose, type DayTally } from './epidemic.ts';
import { after, hasMeasure } from './regional.ts';

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
  // 潜伏的人照常出行；发病的人病得越重越走不动
  const mobility = 1 / (1 + rules.severityImmobility * pathogen.severity);

  /** 一个口子（口岸、机场、港口）：出发地或目的地任意一头关了就算关了 */
  const gate = (
    from: number,
    to: number,
    measure: 'borders' | 'airports' | 'ports',
    effect: number,
  ) =>
    hasMeasure(state, from, measure) || hasMeasure(state, to, measure) ? 1 - effect * comply : 1;

  const send = (to: number, expected: number) => {
    // 目的地封锁、入境筛查都会拦下一部分
    const admitted =
      expected *
      after(state, to, 'lockdown', rules.lockdownTravel, comply) *
      after(state, to, 'screening', rules.screeningEffect, comply);
    if (admitted < NEGLIGIBLE || state.susceptible[to]! <= 0) return;
    const whole = Math.floor(admitted);
    arrivals[to]! += whole + (chance(state.random, admitted - whole) ? 1 : 0);
  };

  const along = (
    from: number,
    links: Links,
    travelers: number,
    measure: 'airports' | 'ports',
    effect: number,
  ) => {
    for (let i = 0; i < links.to.length; i++) {
      const to = links.to[i]!;
      send(to, travelers * links.weight[i]! * gate(from, to, measure, effect));
    }
  };

  for (let from = 0; from < regions.length; from++) {
    const carriers = state.exposed[from]! + state.infectious[from]! * mobility;
    if (carriers <= 0) continue;
    const leaving = carriers * after(state, from, 'lockdown', rules.lockdownTravel, comply);
    const region = regions[from]!;
    for (const to of region.neighbors) {
      send(to, leaving * rules.landRate * gate(from, to, 'borders', rules.bordersEffect));
    }
    along(
      from,
      region.air,
      leaving * rules.airRate * (1 + pathogen.aviation),
      'airports',
      rules.airportsEffect,
    );
    along(
      from,
      region.sea,
      leaving * rules.seaRate * (1 + pathogen.maritime),
      'ports',
      rules.portsEffect,
    );
  }

  for (let to = 0; to < regions.length; to++) {
    if (arrivals[to]! > 0) expose(state, to, arrivals[to]!, tally);
  }
}
