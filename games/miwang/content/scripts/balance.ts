/**
 * 批量对局：让电脑的攻方和守方自己对打很多局，看胜率、时长、死亡，用来调规则里的数值。
 *
 *   node scripts/balance.ts [局数=20] [攻方难度=1] [守方难度=1]
 * 难度是 0、1、2；写 -1 表示这一方什么都不做（看另一方单独的效果）。
 * 想试某个规则数值时不用改代码：环境变量 RULES 里写要覆盖的项，比如 RULES='{"budgetPerDay":4}'。
 * 环境变量 PATHOGEN 选病原体档案（默认 novel）；写 all 就把每个档案各跑一遍、每个只打一行总结。
 */
import {
  ATTACKER,
  decide,
  DEFENDER,
  outbreak,
  type AiLevel,
  type Command,
  type OutbreakView,
  type PathogenProfile,
  type Rules,
} from '@miwang/sim';
import { createConfig } from '../src/config.ts';
import { PATHOGENS } from '../src/tables/pathogens.ts';
import { regionName } from '../src/world.ts';

const [games = 20, attackerLevel = 1, defenderLevel = 1] = process.argv.slice(2).map(Number);
const overrides = JSON.parse(process.env['RULES'] ?? '{}') as Partial<Rules>;
const chosen = process.env['PATHOGEN'] ?? 'novel';
const pathogens = chosen === 'all' ? PATHOGENS : PATHOGENS.filter((p) => p.id === chosen);
if (pathogens.length === 0) throw new Error(`没有叫 ${chosen} 的病原体档案`);

interface Result {
  seed: number;
  origin: string;
  winner: string;
  reason: string;
  days: number;
  infected: number;
  deaths: number;
  regions: number;
  traits: number;
  techs: number;
  trust: number;
  vaccineDay: number;
}

function play(seed: number, pathogen: PathogenProfile): Result {
  const base = createConfig(seed, '2026-01-01', { pathogen });
  const config = { ...base, rules: { ...base.rules, ...overrides } };
  const state = outbreak.create(config);
  let attacker: OutbreakView = outbreak.observe(state, ATTACKER);
  let vaccineDay = -1;
  while (!state.outcome) {
    const defender = outbreak.observe(state, DEFENDER);
    attacker = outbreak.observe(state, ATTACKER);
    if (vaccineDay < 0 && defender.defense.vaccinating) vaccineDay = state.tick;
    const commands: { tick: number; player: number; command: Command }[] = [];
    const ask = (view: OutbreakView, player: number, level: number) => {
      if (level < 0) return;
      for (const command of decide(view, config, level as AiLevel)) {
        commands.push({ tick: state.tick, player, command });
      }
    };
    ask(attacker, ATTACKER, attackerLevel);
    ask(defender, DEFENDER, defenderLevel);
    outbreak.step(state, commands);
  }
  attacker = outbreak.observe(state, ATTACKER);
  return {
    seed,
    origin: regionName(config.origin, 'zh'),
    winner: state.outcome.winner === ATTACKER ? '攻' : '守',
    reason: state.outcome.reason,
    days: state.outcome.tick,
    infected: attacker.totals.infected,
    deaths: attacker.totals.deaths,
    regions: attacker.totals.regions,
    traits: attacker.pathogen.owned.length,
    techs: attacker.defense.done.length,
    trust: attacker.defense.trust,
    vaccineDay,
  };
}

const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });

for (const pathogen of pathogens) {
  const started = performance.now();
  const results = Array.from({ length: games }, (_, index) => play(1000 + index * 7919, pathogen));
  const elapsed = performance.now() - started;

  if (pathogens.length === 1) {
    for (const r of results) {
      console.log(
        `${String(r.seed).padStart(6)} ${r.origin.padEnd(8, '　')} ${r.winner} ${r.reason.padEnd(10)} ` +
          `${String(r.days).padStart(4)} 天  感染 ${compact.format(r.infected).padStart(7)}  死亡 ${compact.format(r.deaths).padStart(7)}  ` +
          `地区 ${String(r.regions).padStart(3)}  性状 ${String(r.traits).padStart(2)}  科技 ${String(r.techs).padStart(2)}  ` +
          `信任 ${r.trust.toFixed(2)}  接种始于 ${r.vaccineDay}`,
      );
    }
    console.log('');
  }
  const wins = results.filter((r) => r.winner === '攻').length;
  const average = (pick: (r: Result) => number) =>
    results.reduce((sum, r) => sum + pick(r), 0) / results.length;
  const count = (reason: string) => results.filter((r) => r.reason === reason).length;
  console.log(
    `${pathogen.id.padEnd(13)} ${games} 局（攻 ${attackerLevel} 守 ${defenderLevel}）：攻方赢 ${String(wins).padStart(2)} 局（${((wins / games) * 100).toFixed(0).padStart(3)}%）；` +
      `灾厄 ${count('calamity')}、清除 ${count('eradicated')}、守到期限 ${count('timeout')}；` +
      `平均 ${average((r) => r.days).toFixed(0)} 天，感染 ${compact.format(average((r) => r.infected))}，死亡 ${compact.format(average((r) => r.deaths))}；` +
      `用时 ${(elapsed / 1000).toFixed(1)} 秒`,
  );
}
