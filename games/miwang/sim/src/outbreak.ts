import {
  binomial,
  chance,
  dateAtTick,
  dateFromText,
  dateToText,
  exp,
  fnv1a,
  hashNumbers,
  seedRandom,
  type PlayerId,
  type Simulation,
  type Stamped,
} from '@rune-engine/core';
import type { Command, OutbreakConfig, OutbreakState, OutbreakView, Trait } from './types.ts';

/** 攻方、守方的编号 */
export const ATTACKER: PlayerId = 0;
export const DEFENDER: PlayerId = 1;

/** 各种操作的代价：界面和电脑对手都从这里读，不各写一份 */
export const COSTS = { evolve: 12, measure: 8 } as const;
/** 地区措施的位：measures 数组里按位存 */
export const MEASURE_BITS = { lockdown: 1, testing: 2 } as const;
const LOCKDOWN = MEASURE_BITS.lockdown;
const TESTING = MEASURE_BITS.testing;

/** 一步是一天。下面的数是为了让曲线有个样子随手定的，等接上真实疾病的资料再换 */
const BASE_TRANSMISSION = 0.32;
const TRANSMISSION_PER_LEVEL = 0.07;
const INCUBATION_RATE = 0.25;
const REMOVAL_RATE = 0.12;
const BASE_FATALITY = 0.004;
const FATALITY_PER_LEVEL = 0.006;
const BASE_DETECTION = 0.25;
const DETECTION_PER_SEVERITY = 0.06;
const DETECTION_PER_STEALTH = 0.07;
const TESTING_BONUS = 0.4;
const LOCKDOWN_TRANSMISSION = 0.35;
const LOCKDOWN_TRAVEL = 0.05;
const LAND_TRAVEL = 0.0006;
const FLIGHT_TRAVEL = 0.00012;
const BUDGET_PER_DAY = 0.6;

function create(config: OutbreakConfig): OutbreakState {
  const count = config.regions.length;
  const state: OutbreakState = {
    tick: 0,
    random: seedRandom(config.seed),
    susceptible: Float64Array.from(config.regions, (region) => region.population),
    exposed: new Float64Array(count),
    infectious: new Float64Array(count),
    removed: new Float64Array(count),
    deaths: new Float64Array(count),
    reported: new Float64Array(count),
    measures: new Uint8Array(count),
    traits: { transmission: 0, severity: 0, stealth: 0 },
    points: 0,
    budget: 10,
    config,
  };
  const seeded = Math.min(5, state.susceptible[config.origin]!);
  state.susceptible[config.origin]! -= seeded;
  state.infectious[config.origin]! += seeded;
  return state;
}

function apply(state: OutbreakState, player: PlayerId, command: Command) {
  switch (command.type) {
    case 'evolve':
      if (player !== ATTACKER || state.points < COSTS.evolve) return;
      state.points -= COSTS.evolve;
      state.traits[command.trait]++;
      return;
    case 'measure': {
      const known =
        Number.isInteger(command.region) &&
        command.region >= 0 &&
        command.region < state.measures.length;
      if (player !== DEFENDER || !known) return;
      const bit = command.measure === 'lockdown' ? LOCKDOWN : TESTING;
      const active = (state.measures[command.region]! & bit) !== 0;
      if (active === command.on) return;
      if (command.on) {
        if (state.budget < COSTS.measure) return;
        state.budget -= COSTS.measure;
        state.measures[command.region]! |= bit;
      } else {
        state.measures[command.region]! &= ~bit;
      }
      return;
    }
  }
}

function step(state: OutbreakState, commands: readonly Stamped<Command>[]) {
  for (const { player, command } of commands) apply(state, player, command);

  const { regions } = state.config;
  const { random, susceptible, exposed, infectious, removed, deaths, reported, measures } = state;
  const transmission = BASE_TRANSMISSION + TRANSMISSION_PER_LEVEL * state.traits.transmission;
  const fatality = BASE_FATALITY + FATALITY_PER_LEVEL * state.traits.severity;
  const detection = Math.max(
    0.02,
    BASE_DETECTION +
      DETECTION_PER_SEVERITY * state.traits.severity -
      DETECTION_PER_STEALTH * state.traits.stealth,
  );
  const incubate = 1 - exp(-INCUBATION_RATE);
  const remove = 1 - exp(-REMOVAL_RATE);
  let newlyInfected = 0;

  for (let r = 0; r < regions.length; r++) {
    const population = regions[r]!.population;
    const locked = (measures[r]! & LOCKDOWN) !== 0;
    const sick = infectious[r]!;

    // 本地传播：一个易感者这一天被感染的概率
    if (sick > 0 && susceptible[r]! > 0) {
      const rate = (transmission * (locked ? LOCKDOWN_TRANSMISSION : 1) * sick) / population;
      const infected = binomial(random, susceptible[r]!, 1 - exp(-rate));
      susceptible[r]! -= infected;
      exposed[r]! += infected;
      newlyInfected += infected;
    }
    // 潜伏 → 发病
    const onset = binomial(random, exposed[r]!, incubate);
    exposed[r]! -= onset;
    infectious[r]! += onset;
    // 上报：发病的人里被发现的那部分
    const found = Math.min(1, detection + ((measures[r]! & TESTING) !== 0 ? TESTING_BONUS : 0));
    reported[r]! += binomial(random, onset, found);
    // 发病 → 移出（康复或死亡）
    const leaving = binomial(random, sick, remove);
    const died = binomial(random, leaving, fatality);
    infectious[r]! -= leaving;
    removed[r]! += leaving - died;
    deaths[r]! += died;

    // 外出：带病的人把感染带到相邻地区和航线另一头
    if (sick > 0) {
      const leave = locked ? LOCKDOWN_TRAVEL : 1;
      spread(state, regions[r]!.neighbors, sick * LAND_TRAVEL * leave);
      spread(state, regions[r]!.flights, sick * FLIGHT_TRAVEL * leave);
    }
  }

  state.points += newlyInfected > 0 ? 0.4 + Math.sqrt(newlyInfected) * 0.02 : 0;
  state.budget += BUDGET_PER_DAY;
  state.tick++;
}

/** 往 targets 里的每个地区输出 expected 个（期望值）感染者，落地成对方的潜伏者；封锁中的地区进不去 */
function spread(state: OutbreakState, targets: readonly number[], expected: number) {
  for (const to of targets) {
    if ((state.measures[to]! & LOCKDOWN) !== 0 || state.susceptible[to]! <= 0) continue;
    const whole = Math.floor(expected);
    const arrivals = whole + (chance(state.random, expected - whole) ? 1 : 0);
    const landed = Math.min(arrivals, state.susceptible[to]!);
    if (landed <= 0) continue;
    state.susceptible[to]! -= landed;
    state.exposed[to]! += landed;
  }
}

function hash(state: OutbreakState): number {
  let h = hashNumbers([
    state.tick,
    state.random.a,
    state.random.b,
    state.random.c,
    state.random.d,
    state.points,
    state.budget,
    state.traits.transmission,
    state.traits.severity,
    state.traits.stealth,
  ]);
  for (const part of [
    state.susceptible,
    state.exposed,
    state.infectious,
    state.removed,
    state.deaths,
    state.reported,
    state.measures,
  ]) {
    h = fnv1a(part, h);
  }
  return h;
}

function observe(state: OutbreakState, player: PlayerId): OutbreakView {
  const attacker = player === ATTACKER;
  const { regions } = state.config;
  const intensity = new Float32Array(regions.length);
  let cases = 0;
  let deaths = 0;
  let population = 0;
  let reached = 0;
  for (let r = 0; r < regions.length; r++) {
    const people = regions[r]!.population;
    // 攻方看真实的发病比例；守方只有累计上报，按它估一个程度（开方让小数字也看得出来）
    const seen = attacker ? state.infectious[r]! + state.exposed[r]! : state.reported[r]!;
    const share = people > 0 ? seen / people : 0;
    intensity[r] = Math.min(1, Math.sqrt(share * (attacker ? 4 : 12)));
    cases += attacker ? state.infectious[r]! : state.reported[r]!;
    deaths += state.deaths[r]!;
    population += people;
    if (seen > 0) reached++;
  }
  const traits: Record<Trait, number> = { ...state.traits };
  return {
    tick: state.tick,
    date: dateToText(dateAtTick(dateFromText(state.config.startDate), state.tick)),
    attacker,
    intensity,
    measures: state.measures.slice(),
    totals: { cases, deaths, population, regions: reached },
    resource: attacker ? state.points : state.budget,
    traits,
  };
}

export const outbreak: Simulation<OutbreakConfig, OutbreakState, Command, OutbreakView> = {
  create,
  step,
  hash,
  observe,
};
