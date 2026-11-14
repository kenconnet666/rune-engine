import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { measuresOf } from '../config.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, TECH_DONE, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { compliance, dailyBalance, setupCost, upkeepOf } from './defense.ts';
import { pathogenStats, traitCost } from './pathogen.ts';
import { defenseStats } from './research.ts';
import { winter } from './regional.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
const traitAt = (state: OutbreakState, id: string) => state.traitIndex.get(id)!;

describe('病原体', () => {
  it('数值是档案的底数加上已有性状的效果', () => {
    const state = createState(testConfig());
    expect(pathogenStats(state).air).toBeCloseTo(0.24);
    state.points = 100;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'air1' });
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'air2' });
    const stats = pathogenStats(state);
    expect(stats.air).toBeCloseTo(0.24 + 0.08 + 0.1);
    expect(stats.aviation).toBeCloseTo(0.5);
  });

  it('每多一个性状，之后的都贵一点；点数不够换不了', () => {
    const state = createState(testConfig({ costGrowth: 0.5 }));
    const stealth = traitAt(state, 'stealth');
    expect(traitCost(state, stealth)).toBe(6);
    state.points = 6;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'air1' });
    expect(state.points).toBe(0);
    expect(traitCost(state, stealth)).toBe(9);
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'stealth' });
    expect(state.traits[stealth]).toBe(0);
  });

  it('前置是“已有其中任意一个”', () => {
    const state = createState(testConfig());
    state.points = 100;
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'failure' });
    expect(state.traits[traitAt(state, 'failure')]).toBe(0);
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'water1' });
    applyCommand(state, ATTACKER, { type: 'evolve', trait: 'failure' });
    expect(state.traits[traitAt(state, 'failure')]).toBe(1);
  });
});

describe('研究', () => {
  it('前置要全部做完；同时进行的研究有上限', () => {
    const state = createState(testConfig({ labs: 2 }));
    state.budget = 100;
    applyCommand(state, DEFENDER, { type: 'research', tech: 'origin' });
    expect(state.budget).toBe(100);
    applyCommand(state, DEFENDER, { type: 'research', tech: 'identify' });
    applyCommand(state, DEFENDER, { type: 'research', tech: 'tracing' });
    expect(state.budget).toBe(80);
    // 实验室占满了
    applyCommand(state, DEFENDER, { type: 'research', tech: 'vaccine1' });
    expect(state.budget).toBe(80);
  });

  it('做完之后效果生效，溯源让守方知道起源地', () => {
    const state = createState(testConfig({ eventChance: 0 }));
    state.budget = 100;
    applyCommand(state, DEFENDER, { type: 'research', tech: 'identify' });
    applyCommand(state, DEFENDER, { type: 'research', tech: 'tracing' });
    run(state, 10);
    expect(defenseStats(state)).toMatchObject({ identify: 1, isolation: 0.4 });
    applyCommand(state, DEFENDER, { type: 'research', tech: 'origin' });
    run(state, 10);
    expect(outbreak.observe(state, DEFENDER).origin).toBe(0);
    expect(state.news.some((item) => item.kind === 'traced')).toBe(true);
  });

  it('抗原漂移把疫苗拖慢', () => {
    const days = (drift: boolean) => {
      const state = createState(testConfig({ eventChance: 0, driftVaccineDelay: 0.5 }));
      state.budget = 100;
      state.points = 100;
      if (drift) applyCommand(state, ATTACKER, { type: 'evolve', trait: 'drift' });
      state.techs[state.techIndex.get('identify')!] = TECH_DONE;
      applyCommand(state, DEFENDER, { type: 'research', tech: 'vaccine1' });
      const index = state.techIndex.get('vaccine1')!;
      let elapsed = 0;
      while (state.techs[index] !== TECH_DONE && elapsed < 200) {
        outbreak.step(state, []);
        elapsed++;
      }
      return elapsed;
    };
    expect(days(false)).toBe(20);
    // drift 是 2：每天的进度除以 1 + 0.5 × 2
    expect(days(true)).toBe(40);
  });

  it('疫苗三步都做完之后开始接种，易感者变成免疫者', () => {
    const state = createState(testConfig({ eventChance: 0 }));
    for (const id of ['identify', 'vaccine1', 'vaccine2', 'vaccine3']) {
      state.techs[state.techIndex.get(id)!] = TECH_DONE;
    }
    run(state, 30);
    expect(state.immune[5]).toBeGreaterThan(0);
    expect(outbreak.observe(state, ATTACKER).defense.vaccinating).toBe(true);
  });
});

describe('措施与经济', () => {
  it('开措施要预付几天的维持费，付不起就开不了；关不要钱', () => {
    const config = testConfig({ setupDays: 3 });
    const state = createState(config);
    const cost = setupCost(config, 2, 'lockdown');
    expect(cost).toBeCloseTo(upkeepOf(config, 2, 'lockdown') * 3);
    state.budget = cost / 2;
    applyCommand(state, DEFENDER, { type: 'measure', region: 2, measure: 'lockdown', level: 3 });
    expect(state.measures[2]).toBe(0);
    state.budget = cost;
    applyCommand(state, DEFENDER, { type: 'measure', region: 2, measure: 'lockdown', level: 3 });
    expect(state.measures[2]).toBe(measuresOf({ lockdown: 3 }));
    expect(state.budget).toBeCloseTo(0);
    applyCommand(state, DEFENDER, { type: 'measure', region: 2, measure: 'lockdown', level: 0 });
    expect(state.measures[2]).toBe(0);
  });

  it('封锁让这个地区贡献的预算变少', () => {
    const state = createState(testConfig());
    const open = dailyBalance(state);
    state.measures[2] = measuresOf({ lockdown: 3 });
    const locked = dailyBalance(state);
    expect(locked.income).toBeLessThan(open.income);
    expect(locked.upkeep).toBeGreaterThan(0);
    expect(open.upkeep).toBe(0);
  });

  it('维持费付不起时，措施的效果按付得起的比例打折', () => {
    const state = createState(testConfig({ eventChance: 0, budgetPerDay: 0.01 }));
    state.budget = 0;
    state.measures.fill(measuresOf({ lockdown: 3 }));
    const before = compliance(state);
    outbreak.step(state, []);
    expect(state.funding).toBeLessThan(0.5);
    expect(compliance(state)).toBeLessThan(before * 0.5);
  });

  it('长期封锁消耗信任', () => {
    const state = createState(testConfig({ eventChance: 0 }));
    state.budget = 1e6;
    state.measures.fill(measuresOf({ lockdown: 3 }));
    run(state, 30);
    expect(state.trust).toBeLessThan(0.6);
  });
});

describe('季节', () => {
  it('南北半球相反，热带没有四季', () => {
    // 开局是 11 月 13 日，60 天之后是一月中：北半球的隆冬
    const state = createState(testConfig());
    state.tick = 63;
    expect(winter(state, 2)).toBeCloseTo(1, 1);
    expect(winter(state, 6)).toBeCloseTo(-1, 1);
    expect(winter(state, 0)).toBe(0);
    // 再过半年
    state.tick = 63 + 182;
    expect(winter(state, 2)).toBeCloseTo(-1, 1);
  });
});

describe('出行', () => {
  it('停飞之后感染不再沿航线跳到另一头', () => {
    // 把陆路和海运关掉，只看 0 号到 7 号的那条航线
    const reaches = (grounded: boolean) => {
      const state = createState(
        testConfig({
          eventChance: 0,
          landRate: 0,
          seaRate: 0,
          airRate: 0.05,
          airportsEffect: 1,
          // 信任保持满格：措施不打折，停飞就是完全停飞
          trustBaseline: 1,
          startTrust: 1,
          trustDeaths: 0,
        }),
      );
      state.budget = 1e6;
      if (grounded) state.measures[0] = measuresOf({ airports: 3 });
      run(state, 120);
      return state.reached[7] !== 0;
    };
    expect(reaches(false)).toBe(true);
    expect(reaches(true)).toBe(false);
  });
});
