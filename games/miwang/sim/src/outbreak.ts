/**
 * 《迷惘》的模拟：把各条规则按一天的顺序串起来。规则本身在 rules/ 里，一条规则一个文件。
 */
import { fnv1a, hashNumbers, type Simulation, type Stamped } from '@rune-engine/core';
import { applyCommand, type Command } from './commands.ts';
import type { OutbreakConfig } from './config.ts';
import { trackCrises } from './rules/crises.ts';
import { rollCalendar } from './rules/calendar.ts';
import { arriveTeams, compliance, settleEconomy, updateTrust } from './rules/defense.ts';
import { progress, type DayTally } from './rules/epidemic.ts';
import { rollDecisions } from './rules/decisions.ts';
import { rollEvents } from './rules/events.ts';
import { recordHistory } from './rules/history.ts';
import { expireModifiers } from './rules/modifiers.ts';
import { judge } from './rules/outcome.ts';
import { pathogenStats } from './rules/pathogen.ts';
import { advanceResearch, defenseStats, vaccinate } from './rules/research.ts';
import { recordMilestones } from './rules/review.ts';
import { updateTasks } from './rules/tasks.ts';
import { travel } from './rules/travel.ts';
import { createState, type OutbreakState } from './state.ts';
import { observe, type OutbreakView } from './view.ts';

/** 四次方根：变异点跟着新增感染走，但感染翻一万倍点数只翻十倍，后期不至于点数泛滥 */
const fourthRoot = (value: number) => Math.sqrt(Math.sqrt(value));

/**
 * 一天。顺序是有讲究的：先执行命令（今天的决定今天生效；主机在线上是收到就执行，这里是重放时补上），再发生事件、到日子的日程、冒出要拿主意的事，然后人沿路线出行、各地区的病情发展，
 * 接着是守方的接种与研究、收支与信任，最后攻方按今天的“战果”拿变异点，记里程碑、判短期任务，看分没分出胜负。
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
  expireModifiers(state);
  arriveTeams(state);
  rollEvents(state);
  rollCalendar(state);
  trackCrises(state);
  rollDecisions(state, defense);
  travel(state, pathogen, comply, tally);
  progress(state, pathogen, defense, comply, tally);
  vaccinate(state, defense, comply);
  advanceResearch(state, pathogen);
  settleEconomy(state);
  updateTrust(state, defense, tally);

  state.points +=
    rules.pointsPerDay +
    rules.pointsPerInfectionRoot * fourthRoot(tally.infections) +
    rules.pointsPerDeathRoot * fourthRoot(tally.deaths) +
    rules.pointsPerRegion * tally.newRegions;

  recordMilestones(state);
  updateTasks(state);
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
    state.priority,
    state.briefingReadyAt,
    state.news.length,
    state.chronicle.length,
    state.milestones,
    state.hops.length,
    state.modifiers.length,
    state.modifiers.reduce((sum, item) => sum + item.amount * item.until, 0),
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
    state.unnoticed,
    state.measures,
    state.gatheringUntil,
    state.disasterUntil,
    state.teamRegion,
    state.teamArrives,
    state.surgeUntil,
    state.skillReadyAt,
    state.pendingDecision,
    state.decisionExpires,
    state.decisionSeen,
    state.decisionLast,
    state.decisionRegion,
    state.crisisReadyAt,
    state.lockedDays,
    state.sealedDays,
    state.unrestUntil,
    state.reliefUntil,
    state.leakUntil,
    state.aidUntil,
    state.deployReadyAt,
    state.task,
    state.taskStart,
    state.taskExpires,
    state.taskNext,
    state.tasksDone,
    state.taskSeen,
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
  // 命令收到就生效（时间停着的时候下的命令马上看得到结果）；step 开头做的也是同一件事
  apply: (state, { player, command }) => applyCommand(state, player, command),
  hash,
  observe,
};
