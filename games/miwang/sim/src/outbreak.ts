/**
 * 《迷惘》的模拟：把各条规则按一天的顺序串起来。规则本身在 rules/ 里，一条规则一个文件。
 */
import { fnv1a, hashNumbers, type Simulation, type Stamped } from '@rune-engine/core';
import { applyCommand, type Command } from './commands.ts';
import type { OutbreakConfig } from './config.ts';
import { compliance, settleEconomy, updateTrust } from './rules/defense.ts';
import { progress, type DayTally } from './rules/epidemic.ts';
import { rollEvents } from './rules/events.ts';
import { recordHistory } from './rules/history.ts';
import { judge } from './rules/outcome.ts';
import { pathogenStats } from './rules/pathogen.ts';
import { advanceResearch, defenseStats, vaccinate } from './rules/research.ts';
import { travel } from './rules/travel.ts';
import { createState, type OutbreakState } from './state.ts';
import { observe, type OutbreakView } from './view.ts';

/** 四次方根：变异点跟着新增感染走，但感染翻一万倍点数只翻十倍，后期不至于点数泛滥 */
const fourthRoot = (value: number) => Math.sqrt(Math.sqrt(value));

/**
 * 一天。顺序是有讲究的：先执行命令（今天的决定今天生效），再发生事件，然后人沿路线出行、各地区的病情发展，
 * 接着是守方的接种与研究、收支与信任，最后攻方按今天的“战果”拿变异点，看分没分出胜负。
 * 每天一开始先把当时的态势记一笔（隔几天才真的记，见 rules/history.ts）。
 * 分出胜负之后状态不再变化（步数也不再走）。
 */
function step(state: OutbreakState, commands: readonly Stamped<Command>[]) {
  for (const { player, command } of commands) applyCommand(state, player, command);
  if (state.outcome) return;

  const { rules } = state.config;
  const pathogen = pathogenStats(state);
  const defense = defenseStats(state);
  const comply = compliance(state);
  const tally: DayTally = { infections: 0, deaths: 0, newRegions: 0 };

  recordHistory(state);
  rollEvents(state);
  travel(state, pathogen, comply, tally);
  progress(state, pathogen, defense, comply, tally);
  vaccinate(state, defense, comply);
  advanceResearch(state, pathogen);
  settleEconomy(state);
  updateTrust(state, defense, tally);

  state.points +=
    rules.pointsPerInfectionRoot * fourthRoot(tally.infections) +
    rules.pointsPerDeathRoot * fourthRoot(tally.deaths) +
    rules.pointsPerRegion * tally.newRegions;

  judge(state);
  state.tick++;
}

/** 状态的哈希：所有会变的东西都算进去（配置和从配置算出来的不算） */
function hash(state: OutbreakState): number {
  let h = hashNumbers([
    state.tick,
    state.random.a,
    state.random.b,
    state.random.c,
    state.random.d,
    state.points,
    state.budget,
    state.trust,
    state.funding,
    state.economyLost,
    state.infectedTotal,
    state.clearStreak,
    state.news.length,
    state.hops.length,
    state.history.cases.length,
    state.history.cases.at(-1) ?? 0,
    state.reportedHistory.deaths.at(-1) ?? 0,
    state.outcome ? state.outcome.winner + 1 : 0,
  ]);
  for (const part of [
    state.susceptible,
    state.exposed,
    state.infectious,
    state.recovered,
    state.immune,
    state.deaths,
    state.reported,
    state.reportedDeaths,
    state.visible,
    state.reached,
    state.measures,
    state.gatheringUntil,
    state.disasterUntil,
    state.traits,
    state.techs,
    state.techRemaining,
  ]) {
    h = fnv1a(part, h);
  }
  return h;
}

export const outbreak: Simulation<OutbreakConfig, OutbreakState, Command, OutbreakView> = {
  create: createState,
  step,
  hash,
  observe,
};
