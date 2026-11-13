import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import type { Scenario } from '../config.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days && !state.outcome; day++) outbreak.step(state, []);
};
/** 不出事件的小世界，加上一个剧本 */
const withScenario = (scenario: Scenario, rules = {}) =>
  createState(testConfig({ eventChance: 0, ...rules }, { scenario }));

describe('剧本（章节）', () => {
  it('攻方在期限内把目标都做到就赢，原因是 goal', () => {
    const state = withScenario({
      id: 'test',
      goals: [
        { metric: 'traits', target: 2 },
        { metric: 'regions', target: 1 },
      ],
      days: 60,
    });
    run(state, 3);
    expect(state.outcome).toBeNull();
    state.points = 100;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'air1' });
    run(state, 1);
    // 只做到一半不算
    expect(state.outcome).toBeNull();
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'stealth' });
    run(state, 1);
    expect(state.outcome).toMatchObject({ winner: ATTACKER, reason: 'goal' });
  });

  it('到期没做到，守方守住了，原因是 held', () => {
    const state = withScenario({ id: 'test', goals: [{ metric: 'traits', target: 9 }], days: 20 });
    run(state, 100);
    expect(state.outcome).toEqual({ winner: DEFENDER, reason: 'held', tick: 19 });
  });

  it('有目标的剧本不看灾厄线；没列目标的剧本照普通对局分胜负，只是期限换成剧本的', () => {
    // 灾厄线压得极低：普通对局里死一个人攻方就赢了
    const deadly = { calamityShare: 1e-9 };
    const plain = createState(testConfig({ eventChance: 0, ...deadly }));
    plain.deaths[0] = 100;
    run(plain, 1);
    expect(plain.outcome).toMatchObject({ winner: ATTACKER, reason: 'calamity' });

    const chapter = withScenario(
      { id: 'test', goals: [{ metric: 'traits', target: 9 }], days: 30 },
      deadly,
    );
    chapter.deaths[0] = 100;
    run(chapter, 5);
    expect(chapter.outcome).toBeNull();

    const open = withScenario({ id: 'test', goals: [], days: 25 });
    run(open, 100);
    expect(open.outcome).toEqual({ winner: DEFENDER, reason: 'timeout', tick: 24 });
  });

  it('各个目标数的是什么：感染人次、死亡、地区、最富裕的地区', () => {
    const state = withScenario({
      id: 'test',
      goals: [
        { metric: 'infected', target: 1e12 },
        { metric: 'deaths', target: 1e12 },
        { metric: 'regions', target: 99 },
        { metric: 'wealthy', target: 99 },
      ],
      days: 400,
    });
    run(state, 200);
    const goals = outbreak.observe(state, ATTACKER).scenario?.goals ?? [];
    const value = (metric: string) => goals.find((goal) => goal.metric === metric)?.value;
    expect(value('infected')).toBe(state.infectedTotal);
    expect(value('deaths')).toBe(state.deaths.reduce((sum, n) => sum + n, 0));
    const reached = [...state.reached].flatMap((bits, region) =>
      (bits & 1) !== 0 ? [region] : [],
    );
    expect(value('regions')).toBe(reached.length);
    expect(reached.length).toBeGreaterThan(1);
    // 测试世界里富裕程度是下标除以 4 的余数：最富裕的是 3 号和 7 号
    expect(value('wealthy')).toBe(reached.filter((region) => region % 4 === 3).length);
  });

  it('守方看到的进度是按上报算的；对手换了几个性状，做完病原鉴定才知道', () => {
    const state = withScenario({
      id: 'test',
      goals: [
        { metric: 'infected', target: 1e12 },
        { metric: 'traits', target: 9 },
      ],
      days: 400,
    });
    state.points = 100;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'air1' });
    run(state, 60);
    const attacker = outbreak.observe(state, ATTACKER).scenario;
    const defender = outbreak.observe(state, DEFENDER).scenario;
    expect(attacker).toMatchObject({ id: 'test', days: 400 });
    expect(attacker?.goals[0]?.value).toBe(state.infectedTotal);
    expect(defender?.goals[0]?.value).toBe(state.reported.reduce((sum, n) => sum + n, 0));
    expect(defender?.goals[0]?.value).toBeLessThan(state.infectedTotal);
    expect(attacker?.goals[1]?.value).toBe(1);
    expect(defender?.goals[1]?.value).toBeNull();

    state.budget = 1000;
    applyCommand(state, DEFENDER, { type: 'research', tech: 'identify' });
    run(state, 15);
    expect(outbreak.observe(state, DEFENDER).scenario?.goals[1]?.value).toBe(1);
  });

  it('普通对局没有剧本', () => {
    const state = createState(testConfig());
    expect(outbreak.observe(state, ATTACKER).scenario).toBeNull();
  });
});
