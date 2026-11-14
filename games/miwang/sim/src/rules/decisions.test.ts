/** 抉择：什么时候冒出来、选了怎么生效、到期怎么办 */
import { describe, expect, it } from 'vitest';
import { decide } from '../ai/index.ts';
import { applyCommand } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
/** 每天必出抉择、别的随机事件不出 */
const eager = { eventChance: 0, decisionChance: 1, decisionAfter: 0 };
/** 让一方手里等着表里的某一件事 */
function pend(state: OutbreakState, player: number, id: string, days = 5) {
  state.pendingDecision[player] = state.config.decisions.findIndex((it) => it.id === id);
  state.decisionExpires[player] = state.tick + days;
}

describe('抉择', () => {
  it('双方各自碰上自己的事，只看得到自己的；头几天不出', () => {
    const state = createState(testConfig({ ...eager, decisionAfter: 3 }));
    run(state, 3);
    expect(outbreak.observe(state, ATTACKER).decision).toBeNull();
    run(state, 1);
    expect(outbreak.observe(state, ATTACKER).decision).toEqual({ id: 'variant', daysLeft: 4 });
    // 守方这时没有研究在做：要研究在进行才出的那件不会出
    expect(outbreak.observe(state, DEFENDER).decision?.id).toBe('aid');
  });

  it('选了就生效：立刻的得失、持续几天的修正；守方的决定双方都看得到', () => {
    const state = createState(testConfig({ eventChance: 0, startTrust: 0.6 }));
    state.budget = 10;
    pend(state, DEFENDER, 'aid');
    // 不是这一方的事、没有的选项：不生效
    applyCommand(state, ATTACKER, { type: 'decide', decision: 'aid', option: 'accept' });
    applyCommand(state, DEFENDER, { type: 'decide', decision: 'aid', option: 'nonsense' });
    applyCommand(state, DEFENDER, { type: 'decide', decision: 'variant', option: 'bank' });
    expect(state.budget).toBe(10);

    applyCommand(state, DEFENDER, { type: 'decide', decision: 'aid', option: 'accept' });
    expect(state.budget).toBe(35);
    expect(state.trust).toBeCloseTo(0.57);
    expect(outbreak.observe(state, DEFENDER).decision).toBeNull();
    expect(outbreak.observe(state, ATTACKER).news.at(-1)).toMatchObject({
      kind: 'decision',
      subject: 'aid.accept',
    });

    state.points = 5;
    pend(state, ATTACKER, 'variant');
    const before = outbreak.observe(state, ATTACKER).reproduction[0]!;
    applyCommand(state, ATTACKER, { type: 'decide', decision: 'variant', option: 'adapt' });
    const view = outbreak.observe(state, ATTACKER);
    expect(state.points).toBe(3);
    expect(view.reproduction[0]).toBeCloseTo(before * 1.2, 4);
    expect(view.modifiers).toEqual([{ key: 'spread', amount: 0.2, daysLeft: 10 }]);
    // 攻方那边的事守方不知道
    const defender = outbreak.observe(state, DEFENDER);
    expect(defender.modifiers).toEqual([]);
    expect(defender.news.some((item) => item.subject.startsWith('variant'))).toBe(false);
  });

  it('研究类的选项：进行中的研究按比例提前', () => {
    const state = createState(testConfig({ eventChance: 0 }));
    state.budget = 100;
    applyCommand(state, DEFENDER, { type: 'research', tech: 'identify' });
    const index = state.techIndex.get('identify')!;
    pend(state, DEFENDER, 'overtime');
    applyCommand(state, DEFENDER, { type: 'decide', decision: 'overtime', option: 'push' });
    expect(state.techRemaining[index]).toBe(5);
    expect(state.budget).toBe(85);
  });

  it('到期没选按第一个选项办', () => {
    const state = createState(testConfig({ eventChance: 0 }));
    state.points = 0;
    pend(state, ATTACKER, 'variant', 2);
    run(state, 2);
    expect(state.pendingDecision[ATTACKER]).not.toBe(-1);
    const banked = state.points;
    run(state, 1);
    expect(state.pendingDecision[ATTACKER]).toBe(-1);
    // 第一个选项给 3 点（另外还有这一天正常攒的）
    expect(state.points).toBeGreaterThanOrEqual(banked + 3);
    expect(state.news.some((item) => item.subject === 'variant.bank')).toBe(true);
  });

  it('电脑对手：简单档不管，普通档会挑；钱紧时守方接受援助', () => {
    const config = testConfig({ eventChance: 0 });
    const state = createState(config);
    state.budget = 4;
    pend(state, DEFENDER, 'aid');
    const view = outbreak.observe(state, DEFENDER);
    expect(decide(view, config, 0).some((command) => command.type === 'decide')).toBe(false);
    expect(decide(view, config, 1)).toContainEqual({
      type: 'decide',
      decision: 'aid',
      option: 'accept',
    });
  });
});
