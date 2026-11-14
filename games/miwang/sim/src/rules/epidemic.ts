/** 疾病在一个地区里的一天：感染、发病与上报、康复或死亡、免疫消退、动物宿主的外溢 */
import { binomial, chance, clamp, exp, nextInt } from '@rune-engine/core';
import { TROPICAL, type DefenseStats, type PathogenStats } from '../config.ts';
import {
  alive,
  FOR_ATTACKER,
  FOR_BOTH,
  REACHED,
  report,
  REPORTED,
  type OutbreakState,
} from '../state.ts';
import { after, climateFit, detectionIn, effectiveWealth, winter } from './regional.ts';

/** 这一天全世界的合计：攻方的变异点、信任、胜负都要用 */
export interface DayTally {
  infections: number;
  deaths: number;
  newRegions: number;
}

/**
 * 让一个地区的 count 个易感者被感染（变成潜伏者）。本地传播、外来输入、动物外溢都走这里：
 * 这个地区第一次出现感染时记下来，并告诉攻方。
 */
export function expose(state: OutbreakState, region: number, count: number, tally: DayTally) {
  const landed = Math.min(count, state.susceptible[region]!);
  if (landed <= 0) return;
  state.susceptible[region]! -= landed;
  state.exposed[region]! += landed;
  state.infectedTotal += landed;
  tally.infections += landed;
  if ((state.reached[region]! & REACHED) === 0) {
    state.reached[region]! |= REACHED;
    tally.newRegions++;
    report(state, 'spread', FOR_ATTACKER, region);
  }
}

/**
 * 本地传播强度：一个发病者一天在这个地区能传给几个人（所有人都易感时）。
 * 各途径的强度 × 这个地区对它的适宜程度 × 措施打的折扣，加起来再乘气候的适应、集会、隔离。
 */
export function transmissionIn(
  state: OutbreakState,
  r: number,
  pathogen: PathogenStats,
  defense: DefenseStats,
  comply: number,
  detection: number,
  bits: number = state.measures[r]!,
): number {
  const { rules, regions } = state.config;
  const region = regions[r]!;
  const cold = winter(state, r);
  const struck = state.disasterUntil[r]! > state.tick;

  const air =
    pathogen.air *
    (rules.densityAir[region.density] ?? 1) *
    (1 + rules.seasonAir * cold) *
    after(bits, 'masks', rules.masksAir, comply) *
    after(bits, 'lockdown', rules.lockdownAir, comply);
  const contact =
    pathogen.contact *
    (rules.densityContact[region.density] ?? 1) *
    after(bits, 'lockdown', rules.lockdownContact, comply);
  // 蚊子：热带全年，温带、寒带只在夏天（冬天的程度是负数时才有）
  const mosquitoSeason = region.climate === TROPICAL ? 1 : Math.max(0, -cold);
  const others =
    (pathogen.water *
      effectiveWealth(rules.waterByWealth, region.wealth, 0) *
      (struck ? rules.disasterWater : 1) *
      after(bits, 'sanitation', rules.sanitationWater, comply) +
      pathogen.vector *
        (rules.vectorByClimate[region.climate] ?? 0) *
        mosquitoSeason *
        after(bits, 'vectorControl', rules.vectorControlEffect, comply) +
      pathogen.blood * (rules.bloodByWealth[region.wealth] ?? 1)) *
    after(bits, 'lockdown', rules.lockdownOther, comply);

  const gathering = state.gatheringUntil[r]! > state.tick ? rules.gatheringBoost : 1;
  // 隔离只对被发现的病人有用：效果跟着发现率走
  const isolation = after(
    bits,
    'isolation',
    Math.min(1, rules.isolationEffect * detection * (1 + defense.isolation)),
    comply,
  );
  return (air + contact + others) * climateFit(state, r, pathogen) * gathering * isolation;
}

/**
 * 一个地区的有效传播数：一个发病者在这里平均传给几个人（大于 1 在涨，小于 1 在退）。
 * now 是照现在的措施算的；unchecked 是假如一项措施都没开——两者一比就是措施压掉了多少。
 * 只读状态，不动随机数：给界面看的，也给短期任务判定用。
 */
export function reproductionIn(
  state: OutbreakState,
  r: number,
  pathogen: PathogenStats,
  defense: DefenseStats,
  comply: number,
): { now: number; unchecked: number } {
  const people = alive(state, r);
  if (people <= 0) return { now: 0, unchecked: 0 };
  const profile = state.config.pathogen;
  // 一个人能传给别人的天数：病程，加上发病前就能传的那一段潜伏期
  const days =
    Math.max(1, profile.infectiousDays + pathogen.duration) +
    pathogen.presymptomatic * Math.max(1, profile.incubationDays + pathogen.incubation);
  const reach = (days * state.susceptible[r]!) / people;
  const strength = (bits: number) =>
    transmissionIn(
      state,
      r,
      pathogen,
      defense,
      comply,
      detectionIn(state, r, pathogen, defense, comply, bits),
      bits,
    );
  const bits = state.measures[r]!;
  const now = strength(bits) * reach;
  // 大多数地区一项措施都没开：两个数是同一个，不用算两遍
  return { now, unchecked: bits === 0 ? now : strength(0) * reach };
}

/** 医疗被挤兑的程度（0–1）：发病的人占人口的比例到 careCapacity 就是完全挤兑 */
export function strainIn(state: OutbreakState, sick: number, people: number): number {
  return people > 0 ? clamp(sick / people / state.config.rules.careCapacity, 0, 1) : 0;
}

/** 这个地区的发病者最终死亡的概率：致死性 × 医疗没能挽回的部分 × 药物没能挽回的部分 */
function fatalityIn(
  state: OutbreakState,
  r: number,
  pathogen: PathogenStats,
  defense: DefenseStats,
  people: number,
): number {
  const { rules, regions } = state.config;
  // 病人太多时医疗被挤兑；灾害期间医疗瘫痪
  const overload = strainIn(state, state.infectious[r]!, people);
  const care =
    effectiveWealth(rules.careByWealth, regions[r]!.wealth, defense.aid) *
    (1 - rules.overloadLoss * overload) *
    (state.disasterUntil[r]! > state.tick ? rules.disasterCare : 1);
  // 耐药对药物是全额抵消，对一般的医疗（补液、吸氧、护理）只抵消一半
  const untreated = 1 - clamp(defense.treatment, 0, 0.95) * (1 - pathogen.resistance);
  return clamp(pathogen.lethality * (1 - care * (1 - 0.5 * pathogen.resistance)) * untreated, 0, 1);
}

/** 所有地区过一天 */
export function progress(
  state: OutbreakState,
  pathogen: PathogenStats,
  defense: DefenseStats,
  comply: number,
  tally: DayTally,
) {
  const { regions, rules, pathogen: profile } = state.config;
  const { random, susceptible, exposed, infectious, recovered, immune } = state;
  const onsetShare = 1 - exp(-1 / Math.max(1, profile.incubationDays + pathogen.incubation));
  const leaveShare = 1 - exp(-1 / Math.max(1, profile.infectiousDays + pathogen.duration));
  const waneShare = clamp(pathogen.drift * rules.waningRate, 0, 1);
  const spillover =
    pathogen.animal * rules.spilloverRate * (defense.trace >= 1 ? rules.tracedSpillover : 1);

  for (let r = 0; r < regions.length; r++) {
    // 没到过的地区什么都不会发生（输入的感染由出行那一步带来）
    if ((state.reached[r]! & REACHED) === 0) continue;
    const people = alive(state, r);
    if (people <= 0) continue;
    // 这一天的各个环节都按早上的人数算，先后顺序不影响结果
    const sick = infectious[r]!;
    const incubating = exposed[r]!;
    const detection = detectionIn(state, r, pathogen, defense, comply);

    // 感染
    const sources = sick + pathogen.presymptomatic * incubating;
    if (sources > 0 && susceptible[r]! > 0) {
      const strength = transmissionIn(state, r, pathogen, defense, comply, detection);
      const infected = binomial(random, susceptible[r]!, 1 - exp((-strength * sources) / people));
      expose(state, r, infected, tally);
    }

    // 发病，其中一部分被发现
    const onset = binomial(random, incubating, onsetShare);
    exposed[r]! -= onset;
    infectious[r]! += onset;
    const found = binomial(random, onset, detection);
    state.reported[r]! += found;
    state.visible[r] = state.visible[r]! * (1 - leaveShare) + found;
    if (found > 0 && (state.reached[r]! & REPORTED) === 0) {
      state.reached[r]! |= REPORTED;
      report(state, 'report', FOR_BOTH, r);
    }

    // 康复或死亡
    const leaving = binomial(random, sick, leaveShare);
    const died = binomial(random, leaving, fatalityIn(state, r, pathogen, defense, people));
    infectious[r]! -= leaving;
    recovered[r]! += leaving - died;
    state.deaths[r]! += died;
    state.reportedDeaths[r]! += binomial(
      random,
      died,
      Math.min(1, detection + rules.deathDetectBonus),
    );
    tally.deaths += died;

    // 抗原漂移：康复者、接种者重新变得易感
    if (waneShare > 0) {
      const again = binomial(random, recovered[r]!, waneShare);
      const lapsed = binomial(random, immune[r]!, waneShare);
      recovered[r]! -= again;
      immune[r]! -= lapsed;
      susceptible[r]! += again + lapsed;
    }

    // 动物宿主：到过的地区偶尔重新冒出几个病例
    if (spillover > 0 && susceptible[r]! > 0 && chance(random, spillover)) {
      expose(state, r, 1 + nextInt(random, 3), tally);
    }
  }
}
