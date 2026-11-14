/** 守方的几样操作：措施的档位与批量、应急队、疫苗分配、发布会 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { measureLevel, measuresOf } from '../config.ts';
import { outbreak } from '../outbreak.ts';
import { ATTACKER, createState, DEFENDER, REPORTED, type OutbreakState } from '../state.ts';
import { testConfig } from '../testing/world.ts';
import { dailyBalance, setupCost, upkeepOf } from './defense.ts';

const run = (state: OutbreakState, days: number) => {
  for (let day = 0; day < days; day++) outbreak.step(state, []);
};
/** 信任满格、不出事件：措施不打折，数好核对 */
const steady = { eventChance: 0, trustBaseline: 1, startTrust: 1, trustDeaths: 0 };

describe('措施的档位', () => {
  it('轻的那一档花得少、压得也少；全力那一档和原来的“开”一样', () => {
    const config = testConfig(steady);
    const { levelCost, levelEffect } = config.rules;
    const full = upkeepOf(config, 2, 'lockdown');
    expect(upkeepOf(config, 2, 'lockdown', 1)).toBeCloseTo(full * levelCost[1]!);
    expect(upkeepOf(config, 2, 'lockdown', 0)).toBe(0);

    const state = createState(config);
    const unchecked = outbreak.observe(state, ATTACKER).reproduction[2]!;
    const cut = [1, 2, 3].map((level) => {
      state.measures[2] = measuresOf({ lockdown: level as 1 | 2 | 3 });
      return 1 - outbreak.observe(state, ATTACKER).reproduction[2]! / unchecked;
    });
    // 一档比一档压得多，而且正好是全力的那几成
    expect(cut[0]).toBeGreaterThan(0);
    expect(cut[1]).toBeGreaterThan(cut[0]!);
    expect(cut[2]).toBeGreaterThan(cut[1]!);
    expect(cut[0]! / cut[2]!).toBeCloseTo(levelEffect[1]!, 5);
  });

  it('往上加档只付加出来的那部分，往下降不要钱；付不起就不生效', () => {
    const config = testConfig(steady);
    const state = createState(config);
    state.budget = 100;
    applyCommand(state, DEFENDER, { type: 'measure', region: 2, measure: 'lockdown', level: 1 });
    expect(measureLevel(state.measures[2]!, 'lockdown')).toBe(1);
    expect(state.budget).toBeCloseTo(100 - setupCost(config, 2, 'lockdown', 1));

    const before = state.budget;
    applyCommand(state, DEFENDER, { type: 'measure', region: 2, measure: 'lockdown', level: 3 });
    expect(state.budget).toBeCloseTo(before - setupCost(config, 2, 'lockdown', 3, 1));
    // 分两次加和一次加到底花的一样多
    expect(100 - state.budget).toBeCloseTo(setupCost(config, 2, 'lockdown', 3));

    applyCommand(state, DEFENDER, { type: 'measure', region: 2, measure: 'lockdown', level: 2 });
    expect(measureLevel(state.measures[2]!, 'lockdown')).toBe(2);
    expect(100 - state.budget).toBeCloseTo(setupCost(config, 2, 'lockdown', 3));

    state.budget = 0;
    applyCommand(state, DEFENDER, { type: 'measure', region: 3, measure: 'lockdown', level: 1 });
    expect(state.measures[3]).toBe(0);
    // 档位写得不对的命令不生效
    applyCommand(state, DEFENDER, {
      type: 'measure',
      region: 2,
      measure: 'lockdown',
      level: 7 as never,
    });
    expect(measureLevel(state.measures[2]!, 'lockdown')).toBe(2);
  });

  it('各项措施的档位互不相干；维持费、经济损失都按档位算', () => {
    const state = createState(testConfig(steady));
    state.budget = 1e6;
    // 有地区上报过，预算才开始拨
    state.reached[0]! |= REPORTED;
    applyCommand(state, DEFENDER, { type: 'measure', region: 1, measure: 'masks', level: 2 });
    applyCommand(state, DEFENDER, { type: 'measure', region: 1, measure: 'lockdown', level: 1 });
    expect(measureLevel(state.measures[1]!, 'masks')).toBe(2);
    expect(measureLevel(state.measures[1]!, 'lockdown')).toBe(1);
    expect(measureLevel(state.measures[1]!, 'testing')).toBe(0);

    const light = dailyBalance(state);
    applyCommand(state, DEFENDER, { type: 'measure', region: 1, measure: 'lockdown', level: 3 });
    const full = dailyBalance(state);
    expect(full.upkeep).toBeGreaterThan(light.upkeep);
    expect(full.income).toBeLessThan(light.income);
  });

  it('批量：一条命令给好几个地区设同一项措施，钱不够了后面的不生效', () => {
    const config = testConfig(steady);
    const state = createState(config);
    state.budget = 1e6;
    applyCommand(state, DEFENDER, {
      type: 'measures',
      regions: [0, 2, 4, 99, -1],
      measure: 'testing',
      level: 2,
    });
    expect([0, 1, 2, 3, 4].map((r) => measureLevel(state.measures[r]!, 'testing'))).toEqual([
      2, 0, 2, 0, 2,
    ]);

    // 只够开头两个地区
    state.budget = setupCost(config, 5, 'masks') + setupCost(config, 6, 'masks') + 1e-6;
    applyCommand(state, DEFENDER, {
      type: 'measures',
      regions: [5, 6, 7],
      measure: 'masks',
      level: 3,
    });
    expect([5, 6, 7].map((r) => measureLevel(state.measures[r]!, 'masks'))).toEqual([3, 3, 0]);
    // 攻方下这条命令没有用
    applyCommand(state, ATTACKER, { type: 'measures', regions: [1], measure: 'masks', level: 3 });
    expect(measureLevel(state.measures[1]!, 'masks')).toBe(0);
  });
});

describe('应急队', () => {
  it('派出去要走几天，到了才起作用；到的那天双方都得到消息', () => {
    const state = createState(testConfig({ ...steady, teamTravelDays: 4 }));
    applyCommand(state, DEFENDER, { type: 'team', team: 0, region: 3 });
    const sent = outbreak.observe(state, DEFENDER).defense.teams;
    expect(sent[0]).toEqual({ region: 3, arrivesIn: 4 });
    expect(sent[1]).toEqual({ region: -1, arrivesIn: 0 });

    run(state, 3);
    expect(state.news.some((item) => item.kind === 'team')).toBe(false);
    run(state, 2);
    expect(outbreak.observe(state, ATTACKER).defense.teams[0]).toEqual({ region: 3, arrivesIn: 0 });
    expect(state.news.filter((item) => item.kind === 'team').map((item) => item.region)).toEqual([
      3,
    ]);
  });

  it('驻着的地区发现得更多、压得更狠；召回之后就没有了', () => {
    const state = createState(testConfig({ ...steady, teamTravelDays: 0 }));
    state.measures[0] = measuresOf({ isolation: 3 });
    const alone = outbreak.observe(state, ATTACKER).reproduction[0]!;
    applyCommand(state, DEFENDER, { type: 'team', team: 1, region: 0 });
    // 隔离的效果跟着发现率走：队伍让发现率上去，传播数就下来
    expect(outbreak.observe(state, ATTACKER).reproduction[0]).toBeLessThan(alone);
    applyCommand(state, DEFENDER, { type: 'team', team: 1, region: -1 });
    expect(outbreak.observe(state, ATTACKER).reproduction[0]).toBe(alone);
    // 没有的队伍、没有的地区：不生效
    applyCommand(state, DEFENDER, { type: 'team', team: 9, region: 0 });
    applyCommand(state, DEFENDER, { type: 'team', team: 0, region: 999 });
    expect([...state.teamRegion]).toEqual([-1, -1, -1]);
  });
});

describe('疫苗分配', () => {
  /** 疫苗已经做完、每个地区都有一半人易感：接种 20 天，看各地区打了多少 */
  const immunised = (policy: 'even' | 'vulnerable' | 'productive') => {
    const state = createState(testConfig({ ...steady, landRate: 0, airRate: 0, seaRate: 0 }));
    for (const id of ['identify', 'vaccine1', 'vaccine2', 'vaccine3']) {
      state.techs[state.techIndex.get(id)!] = 2;
    }
    applyCommand(state, DEFENDER, { type: 'priority', policy });
    run(state, 20);
    return [...state.immune];
  };

  it('优先给医疗弱的地方：穷的地区打得比不偏向时多，富的少；总量差不多', () => {
    const even = immunised('even');
    const vulnerable = immunised('vulnerable');
    const total = (doses: number[]) => doses.reduce((sum, n) => sum + n, 0);
    // 测试世界里富裕程度是下标除以 4 的余数：0、1 号穷，2、3 号富
    expect(vulnerable[0]).toBeGreaterThan(even[0]!);
    expect(vulnerable[1]).toBeGreaterThan(even[1]!);
    expect(vulnerable[3]).toBeLessThan(even[3]!);
    expect(total(vulnerable) / total(even)).toBeGreaterThan(0.9);
    expect(total(vulnerable) / total(even)).toBeLessThan(1.1);
  });

  it('没有这种分配办法的命令不生效', () => {
    const state = createState(testConfig(steady));
    applyCommand(state, DEFENDER, { type: 'priority', policy: 'hotspots' });
    expect(outbreak.observe(state, DEFENDER).defense.priority).toBe('hotspots');
    applyCommand(state, DEFENDER, { type: 'priority', policy: 'nonsense' as never });
    expect(outbreak.observe(state, DEFENDER).defense.priority).toBe('hotspots');
  });
});

describe('发布会', () => {
  it('花预算换信任，开过之后要隔一阵；钱不够开不了', () => {
    const rules = {
      eventChance: 0,
      startTrust: 0.5,
      briefingCost: 12,
      briefingTrust: 0.06,
      briefingCooldown: 30,
    };
    const state = createState(testConfig(rules));
    state.budget = 5;
    applyCommand(state, DEFENDER, { type: 'briefing' });
    expect(state.trust).toBe(0.5);

    state.budget = 30;
    applyCommand(state, DEFENDER, { type: 'briefing' });
    expect(state.trust).toBeCloseTo(0.56);
    expect(state.budget).toBe(18);
    expect(outbreak.observe(state, DEFENDER).defense.briefingIn).toBe(30);
    expect(state.news.at(-1)?.kind).toBe('briefing');

    // 冷却没过：再开没有用
    applyCommand(state, DEFENDER, { type: 'briefing' });
    expect(state.budget).toBe(18);
    run(state, 30);
    expect(outbreak.observe(state, DEFENDER).defense.briefingIn).toBe(0);
  });
});

describe('命令立刻生效', () => {
  it('先逐条生效再走一天，和把命令交给这一天一起走，结果逐位相同', () => {
    const commands = [
      { tick: 0, player: ATTACKER, command: { type: 'evolve', trait: 'fever' } },
      { tick: 0, player: DEFENDER, command: { type: 'research', tech: 'identify' } },
      { tick: 0, player: DEFENDER, command: { type: 'team', team: 0, region: 0 } },
      {
        tick: 0,
        player: DEFENDER,
        command: { type: 'measure', region: 0, measure: 'masks', level: 2 },
      },
    ] as const;
    const together = createState(testConfig());
    const oneByOne = createState(testConfig());
    for (const state of [together, oneByOne]) {
      state.points = 50;
      state.budget = 50;
    }
    outbreak.step(together, commands);
    for (const command of commands) outbreak.apply?.(oneByOne, command);
    // 时间还没走，命令已经看得到结果
    expect(outbreak.observe(oneByOne, ATTACKER).pathogen.owned).toEqual(['fever']);
    expect(outbreak.observe(oneByOne, DEFENDER).defense.active).toHaveLength(1);
    expect(oneByOne.tick).toBe(0);
    outbreak.step(oneByOne, []);
    expect(outbreak.hash(oneByOne)).toBe(outbreak.hash(together));
  });
});
