/** 性状协同；只在某种病原体的局里出的抉择 */
import { describe, expect, it } from 'vitest';
import { decide } from '../ai/index.ts';
import { applyCommand } from '../commands.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, TECH_DONE, type OutbreakState } from '../state.ts';
import { TEST_DECISIONS, TEST_SYNERGIES, testConfig } from '../testing/world.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
const withSynergy = () =>
  createState(testConfig({ eventChance: 0 }, { synergies: TEST_SYNERGIES }));
const evolve = (state: OutbreakState, trait: string) =>
  applyCommand(state, ATTACKER, { type: 'evolve', trait });

describe('性状协同', () => {
  it('要的性状凑齐了才有额外的效果；退掉一个就没有了', () => {
    const state = withSynergy();
    state.points = 100;
    const air = () => outbreak.observe(state, ATTACKER).pathogen.stats!.air;
    const base = air();
    evolve(state, 'air1');
    const one = air();
    expect(outbreak.observe(state, ATTACKER).pathogen.synergies).toEqual([]);
    evolve(state, 'fever');
    // 发热本身不加飞沫：多出来的 0.05 是协同给的
    expect(air()).toBeCloseTo(one + 0.05);
    expect(one).toBeGreaterThan(base);
    expect(outbreak.observe(state, ATTACKER).pathogen.synergies).toEqual(['feverCough']);
    applyCommand(state, ATTACKER, { type: 'devolve', trait: 'fever' });
    expect(air()).toBeCloseTo(one);
    expect(outbreak.observe(state, ATTACKER).pathogen.synergies).toEqual([]);
  });

  it('凑齐的那一下记一条新闻；守方做完病原鉴定才看得到', () => {
    const state = withSynergy();
    state.points = 100;
    evolve(state, 'air1');
    evolve(state, 'fever');
    expect(outbreak.observe(state, ATTACKER).news.at(-1)).toMatchObject({
      kind: 'synergy',
      subject: 'feverCough',
    });
    expect(outbreak.observe(state, DEFENDER).news.some((item) => item.kind === 'synergy')).toBe(
      false,
    );
    expect(outbreak.observe(state, DEFENDER).pathogen.synergies).toEqual([]);

    const seen = withSynergy();
    seen.points = 100;
    seen.techs[seen.techIndex.get('identify')!] = TECH_DONE;
    evolve(seen, 'air1');
    evolve(seen, 'fever');
    expect(outbreak.observe(seen, DEFENDER).news.at(-1)).toMatchObject({ kind: 'synergy' });
    expect(outbreak.observe(seen, DEFENDER).pathogen.synergies).toEqual(['feverCough']);
  });

  it('电脑攻方：就差一个就凑齐的时候，会优先换那一个', () => {
    // 发热在铺开阶段本来不招它喜欢（加严重度、加致死），有了协同就值得了
    const pick = (synergies: typeof TEST_SYNERGIES) => {
      const config = testConfig({ eventChance: 0 }, { synergies });
      const state = createState(config);
      state.points = 100;
      evolve(state, 'air1');
      evolve(state, 'air2');
      evolve(state, 'water1');
      state.points = 6;
      const [command] = decide(outbreak.observe(state, ATTACKER), config, 2, 'steady');
      return command?.type === 'evolve' ? command.trait : undefined;
    };
    expect(pick([])).not.toBe('fever');
    expect(pick([{ id: 'big', requires: ['air1', 'fever'], effects: { air: 0.3 } }])).toBe('fever');
  });
});

describe('病程长的病原体', () => {
  it('性状、协同给的传播强度按档案的 routeScale 折算；底数和别的效果不折', () => {
    const config = testConfig({ eventChance: 0 }, { synergies: TEST_SYNERGIES });
    const slow = createState({ ...config, pathogen: { ...config.pathogen, routeScale: 0.25 } });
    const plain = createState(config);
    for (const state of [slow, plain]) {
      state.points = 100;
      evolve(state, 'air1');
      evolve(state, 'fever');
    }
    const stats = (state: OutbreakState) => outbreak.observe(state, ATTACKER).pathogen.stats!;
    const base = config.pathogen.base.air ?? 0;
    // air1 加的和协同加的都只剩四分之一
    expect(stats(slow).air - base).toBeCloseTo((stats(plain).air - base) * 0.25);
    // 发热加的严重度不是传播途径：照常
    expect(stats(slow).severity).toBeCloseTo(stats(plain).severity);
  });
});

describe('病原体自己的事', () => {
  it('只在那种病原体的局里出', () => {
    const decisions = [
      ...TEST_DECISIONS,
      {
        id: 'ownThing',
        side: 'attacker',
        weight: 1000,
        days: 5,
        pathogen: 'other',
        options: [{ id: 'a' }, { id: 'b' }],
      } as const,
    ];
    const eager = { eventChance: 0, decisionChance: 1, decisionAfter: 0 };
    const state = createState(testConfig(eager, { decisions }));
    run(state, 2);
    // 测试配置的病原体是 test：那件事再常见也不出
    expect(outbreak.observe(state, ATTACKER).decision?.id).toBe('variant');

    const config = testConfig(eager, { decisions });
    const own = createState({ ...config, pathogen: { ...config.pathogen, id: 'other' } });
    run(own, 2);
    expect(outbreak.observe(own, ATTACKER).decision?.id).toBe('ownThing');
  });
});
