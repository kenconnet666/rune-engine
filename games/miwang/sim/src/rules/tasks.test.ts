/** 短期任务：什么时候发、怎么判、给什么；和结算时的回顾（大事记、评分） */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days && !state.outcome; day++) outbreak.step(state, []);
};
/** 任务开着，从第一天就发；别的随机的事不出 */
const tasked = { eventChance: 0, taskGap: 3, taskAfter: 0 };
/** 让一方手里拿着表里的某一件任务（像是昨天结算时发的），接到时那个数是 start，还有 days 天 */
function assign(state: OutbreakState, player: number, id: string, start: number, days: number) {
  state.task[player] = state.config.tasks.findIndex((task) => task.id === id);
  state.taskStart[player] = start;
  state.taskExpires[player] = state.tick + days;
}

describe('短期任务', () => {
  it('双方各自拿到自己的任务，只看得到自己的；不够格的不发', () => {
    // 信任从 0.5 起：要信任高于 0.55 才发的那件发不下来，守方拿到的是“完成一项研究”
    const state = createState(testConfig({ ...tasked, startTrust: 0.5 }));
    run(state, 1);
    expect(outbreak.observe(state, ATTACKER).task).toMatchObject({ id: 'reach', have: 0, need: 1 });
    expect(outbreak.observe(state, DEFENDER).task).toMatchObject({ id: 'labwork', daysLeft: 15 });
  });

  it('gain：比接到时多了那么多就算做到，奖励到手，隔几天发下一件', () => {
    const state = createState(testConfig(tasked));
    assign(state, DEFENDER, 'labwork', 0, 15);
    state.budget = 100;
    applyCommand(state, DEFENDER, { type: 'research', tech: 'identify' });
    run(state, 9);
    expect(outbreak.observe(state, DEFENDER).task?.id).toBe('labwork');
    const budget = state.budget;
    const trust = state.trust;
    run(state, 1);
    // 研究做完的那天任务也完成：预算 +12，信任 +0.02（另外还有这一天正常的收支和信任变化）
    expect(state.budget).toBeGreaterThan(budget + 12);
    expect(state.trust).toBeGreaterThan(trust);
    expect(state.task[DEFENDER]).toBe(-1);
    expect(outbreak.observe(state, DEFENDER).tasksDone).toBe(1);
    expect(state.news.at(-1)).toMatchObject({ kind: 'task', subject: 'labwork.done' });
    // 对面不知道
    expect(
      outbreak.observe(state, ATTACKER).news.some((item) => item.subject.startsWith('labwork')),
    ).toBe(false);
    run(state, 2);
    expect(state.task[DEFENDER]).toBe(-1);
    run(state, 2);
    expect(state.task[DEFENDER]).not.toBe(-1);
  });

  it('gain 到期没做到：没有奖励，也不罚', () => {
    const state = createState(testConfig({ ...tasked, landRate: 0, airRate: 0, seaRate: 0 }));
    assign(state, ATTACKER, 'reach', 1, 3);
    const news = () => state.news.filter((item) => item.kind === 'task').map((it) => it.subject);
    run(state, 2);
    expect(news()).toEqual([]);
    run(state, 1);
    expect(news()).toEqual(['reach.failed']);
    expect(state.tasksDone[ATTACKER]).toBe(0);
  });

  it('hold：撑到期限算做到；中途掉下去当天就算没做到', () => {
    const held = createState(testConfig({ ...tasked, startTrust: 0.9, trustBaseline: 0.9 }));
    assign(held, DEFENDER, 'steady', 0.9, 4);
    run(held, 4);
    expect(held.tasksDone[DEFENDER]).toBe(1);

    const dropped = createState(testConfig({ ...tasked, startTrust: 0.9, trustBaseline: 0.9 }));
    assign(dropped, DEFENDER, 'steady', 0.9, 4);
    dropped.trust = 0.3;
    run(dropped, 1);
    expect(dropped.task[DEFENDER]).toBe(-1);
    expect(dropped.tasksDone[DEFENDER]).toBe(0);
  });
});

describe('回顾', () => {
  it('里程碑按真实的数记进大事记；对局中守方看不到，分出胜负之后双方都拿到整份', () => {
    const state = createState(testConfig({ eventChance: 0, maxDays: 120 }));
    state.points = 50;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'fever' });
    run(state, 60);
    expect(state.chronicle.map((item) => item.kind)).toContain('milestone');
    expect(outbreak.observe(state, DEFENDER).review).toBeNull();
    expect(outbreak.observe(state, DEFENDER).news.some((item) => item.kind === 'milestone')).toBe(
      false,
    );

    run(state, 200);
    expect(state.outcome).not.toBeNull();
    const review = outbreak.observe(state, DEFENDER).review!;
    expect(review.chronicle.map((item) => item.subject)).toEqual(
      expect.arrayContaining(['fever', 'firstDeath', state.outcome!.reason]),
    );
    // 大事记按先后排
    const ticks = review.chronicle.map((item) => item.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    // 真实的数：守方平时只看得到上报的，这里是实际的
    expect(review.truth.infected).toBe(state.infectedTotal);
    expect(review.truth.infected).toBeGreaterThan(
      outbreak.observe(state, DEFENDER).totals.infected,
    );
  });

  it('评分：各部分加起来是总分；赢的一方比输的一方高', () => {
    const state = createState(testConfig({ eventChance: 0, maxDays: 60 }));
    run(state, 100);
    expect(state.outcome?.winner).toBe(DEFENDER);
    const winner = outbreak.observe(state, DEFENDER).review!;
    const loser = outbreak.observe(state, ATTACKER).review!;
    for (const review of [winner, loser]) {
      expect(review.parts.reduce((sum, part) => sum + part.points, 0)).toBe(review.score);
      expect(review.score).toBeGreaterThanOrEqual(0);
      expect(review.score).toBeLessThanOrEqual(100);
    }
    expect(winner.parts[0]).toEqual({ key: 'victory', points: 50 });
    expect(winner.score).toBeGreaterThan(loser.score);
    expect('SABCD').toContain(winner.grade);
    expect(loser.parts.map((part) => part.key)).toEqual(['victory', 'progress', 'reach', 'tasks']);
  });
});
