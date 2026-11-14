/**
 * 回顾：一局打完之后回头看的东西——大事记（这一局的要紧时刻，按先后）和给每一方的评分。
 * 里程碑（第一例死亡、波及多少个地区、灾厄线过了几成）在对局中按真实的数记进大事记；
 * 对局中只有攻方在新闻里看得到它们，分出胜负之后大事记对双方全部公开。
 */
import { clamp, type PlayerId } from '@rune-engine/core';
import {
  ATTACKER,
  FOR_ATTACKER,
  REACHED,
  report,
  type NewsItem,
  type OutbreakState,
} from '../state.ts';
import { calamity, goalValue, totalDeaths } from './outcome.ts';

/** 波及的地区数到这些个、灾厄线过这几成，各记一笔 */
const REGION_MARKS = [10, 50, 100, 150];
const CALAMITY_MARKS = [0.25, 0.5, 0.75];

const reachedCount = (state: OutbreakState) => {
  let count = 0;
  for (const bits of state.reached) if ((bits & REACHED) !== 0) count++;
  return count;
};

/** 每天结算之后：头一回越过哪条线就记一笔（milestones 的每一位记着一条线过没过） */
export function recordMilestones(state: OutbreakState) {
  let bit = 1;
  const once = (reached: boolean, subject: string) => {
    if (reached && (state.milestones & bit) === 0) {
      state.milestones |= bit;
      report(state, 'milestone', FOR_ATTACKER, -1, subject);
    }
    bit <<= 1;
  };
  once(totalDeaths(state) > 0, 'firstDeath');
  const regions = reachedCount(state);
  for (const mark of REGION_MARKS) once(regions >= mark, `regions.${mark}`);
  const line = calamity(state);
  for (const mark of CALAMITY_MARKS) once(line >= mark, `calamity.${mark * 100}`);
}

/** 评分的各个部分：victory 赢了，pace 赢得快，progress 没赢但推进了多少，reach 铺得多开，
 *  lives 灾厄线离得多远，trust 信任，economy 经济保住了多少，endurance 没守住但撑了多久，tasks 做到的短期任务 */
export type ReviewPart =
  'victory' | 'pace' | 'progress' | 'reach' | 'lives' | 'trust' | 'economy' | 'endurance' | 'tasks';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Review {
  /** 0–100 */
  readonly score: number;
  readonly grade: Grade;
  readonly parts: readonly { readonly key: ReviewPart; readonly points: number }[];
  /** 真实的数：对局结束了，守方也该知道实际发生了什么 */
  readonly truth: {
    readonly infected: number;
    readonly deaths: number;
    readonly regions: number;
    /** 双方各做到了几件短期任务（下标是玩家） */
    readonly tasks: readonly [number, number];
  };
  readonly chronicle: readonly NewsItem[];
}

const GRADES: readonly (readonly [number, Grade])[] = [
  [85, 'S'],
  [70, 'A'],
  [55, 'B'],
  [35, 'C'],
];

/** 攻方离赢还有多远（0–1）：剧本看离目标最远的那一项，普通对局看灾厄线 */
function attackerProgress(state: OutbreakState): number {
  const goals = state.config.scenario?.goals ?? [];
  if (goals.length === 0) return calamity(state);
  return Math.min(
    ...goals.map((goal) => clamp((goalValue(state, goal.metric, true) ?? 0) / goal.target, 0, 1)),
  );
}

/** 分出胜负之后给一方的回顾；还没分出胜负是 null */
export function reviewOf(state: OutbreakState, player: PlayerId): Review | null {
  const { outcome } = state;
  if (!outcome) return null;
  const { rules, scenario, regions } = state.config;
  const won = outcome.winner === player;
  const elapsed = clamp((outcome.tick + 1) / (scenario?.days ?? rules.maxDays), 0, 1);
  const progress = attackerProgress(state);
  const tasks = Math.min(10, 2 * state.tasksDone[player]!);

  const parts: { key: ReviewPart; points: number }[] =
    player === ATTACKER
      ? [
          { key: 'victory', points: won ? 50 : 0 },
          won
            ? { key: 'pace', points: 25 * (1 - elapsed) }
            : { key: 'progress', points: 35 * progress },
          { key: 'reach', points: (15 * reachedCount(state)) / regions.length },
          { key: 'tasks', points: tasks },
        ]
      : [
          { key: 'victory', points: won ? 50 : 0 },
          { key: 'lives', points: 20 * (1 - progress) },
          { key: 'trust', points: 10 * state.trust },
          {
            key: 'economy',
            points:
              10 * clamp(1 - state.economyLost / (rules.budgetPerDay * (outcome.tick + 1)), 0, 1),
          },
          ...(won ? [] : [{ key: 'endurance' as const, points: 20 * elapsed }]),
          { key: 'tasks', points: tasks },
        ];
  const rounded = parts.map((part) => ({ ...part, points: Math.round(part.points) }));
  const score = rounded.reduce((sum, part) => sum + part.points, 0);
  return {
    score,
    grade: GRADES.find(([floor]) => score >= floor)?.[1] ?? 'D',
    parts: rounded,
    truth: {
      infected: state.infectedTotal,
      deaths: totalDeaths(state),
      regions: reachedCount(state),
      tasks: [state.tasksDone[0]!, state.tasksDone[1]!],
    },
    chronicle: state.chronicle,
  };
}
