/**
 * 提示：对局里值得打断你说一声的事。三类——
 *   里程碑  头一回越过某条线：第一例死亡、波及第 10 / 50 / 100 个地区、灾厄线过了几成、信任跌破、预算快见底
 *   警报    某个地方出了状况：医疗被挤兑
 *   回应    你做的事起了什么作用（换了性状、开了措施之后那里的传播被压掉了多少、应急队到了、发布会涨了多少信任）；
 *           对面做了什么要紧的事
 * 都是从“上一份状态”和“这一份状态”的差别里看出来的，看的只是这一方自己看得到的东西。
 * 每条留几秒就走；带地区的同时在地图上闪一下（pings）。文字怎么写在面板那头（panels/AlertStack.tsx）。
 */
import { DECISIONS } from '@miwang/content';
import { measureLevel, type Measure, type OutbreakView, type VaccinePolicy } from '@miwang/sim';
import { shallowRef, watchEffect, type ShallowRef } from 'vue';

export type AlertTone = 'signal' | 'danger' | 'calm';

export type AlertData =
  | { readonly kind: 'firstDeath' }
  | { readonly kind: 'regions'; readonly count: number }
  | { readonly kind: 'infected'; readonly count: number }
  | { readonly kind: 'calamity'; readonly share: number }
  /** 头一个地区的医疗被挤兑了 / 被挤兑的地区到了多少个 */
  | { readonly kind: 'strain'; readonly region: number }
  | { readonly kind: 'strainCount'; readonly count: number }
  | { readonly kind: 'trust'; readonly level: number }
  | { readonly kind: 'runway'; readonly days: number }
  | { readonly kind: 'vaccine' }
  | { readonly kind: 'identified' }
  | { readonly kind: 'goal'; readonly share: number }
  | { readonly kind: 'deadline'; readonly days: number }
  /** 这一方换到了一个性状 / 对面换了一个性状（守方知道底细时才看得到） */
  | { readonly kind: 'trait'; readonly trait: string; readonly own: boolean }
  /** 这一方完成了一项研究 / 对面完成了一项研究 */
  | { readonly kind: 'research'; readonly tech: string; readonly own: boolean }
  /** 自己在一个地区改了措施：那里被压掉的传播从多少变成多少（不知道底细时是 -1） */
  | {
      readonly kind: 'measure';
      readonly region: number;
      readonly from: number;
      readonly to: number;
    }
  /** 自己一次在好几个地区改了措施 */
  | { readonly kind: 'measures'; readonly count: number }
  /** 守方在几个地区开始封锁或者切断往来（region 是其中一个，点了飞过去） */
  | { readonly kind: 'crackdown'; readonly count: number; readonly region: number }
  /** 自己派出了一支应急队（region 是 -1 时是召回） / 一支应急队到了 */
  | { readonly kind: 'teamSent'; readonly region: number; readonly days: number }
  | { readonly kind: 'teamArrived'; readonly region: number; readonly own: boolean }
  /** 开了发布会：信任从多少到多少 */
  | { readonly kind: 'briefing'; readonly from: number; readonly to: number; readonly own: boolean }
  /** 自己改了疫苗先给谁 */
  | { readonly kind: 'priority'; readonly policy: VaccinePolicy }
  /** 有一件事等这一方拿主意 */
  | { readonly kind: 'decisionPending'; readonly decision: string }
  /** 一件事定了（自己选的、到期默认的，或者守方公开的决定）：subject 是“事.选项” */
  | { readonly kind: 'decided'; readonly subject: string; readonly own: boolean }
  /** 自己用了一个技能（region 是 -1 时不对着地区） */
  | { readonly kind: 'skill'; readonly skill: string; readonly region: number }
  /** 退掉了一个性状（守方知道底细时也看得到） */
  | { readonly kind: 'devolve'; readonly trait: string; readonly own: boolean };

export interface Alert {
  readonly id: number;
  readonly tone: AlertTone;
  readonly data: AlertData;
}

export interface Ping {
  readonly id: number;
  readonly region: number;
  readonly tone: AlertTone;
}

export interface Alerts {
  /** 现在该显示的几条，旧的在前 */
  readonly list: ShallowRef<readonly Alert[]>;
  /** 地图上正在闪的几处 */
  readonly pings: ShallowRef<readonly Ping[]>;
  readonly dismiss: (id: number) => void;
  /** 在地图上的一个地区闪一下（点了地区榜、新闻时也用） */
  readonly ping: (region: number, tone?: AlertTone) => void;
}

/** 一条提示留多久、地图上闪多久（毫秒） */
const ALERT_MS = 7000;
const PING_MS = 2400;
/** 同时最多显示几条：再多就挤掉最旧的 */
const SHOWN = 4;

const REGION_STEPS = [10, 50, 100, 150];
const INFECTED_STEPS = [1e4, 1e6, 1e8, 1e9];
const CALAMITY_STEPS = [0.25, 0.5, 0.75];
const TRUST_STEPS = [0.6, 0.4, 0.25];
const STRAIN_STEPS = [5, 20, 50, 100];
const GOAL_STEPS = [0.5, 0.9];
const DEADLINE_STEPS = [60, 30, 10];
/** 守方的这几样措施一加码，攻方就该知道：封锁和切断往来 */
const CRACKDOWN: readonly Measure[] = ['lockdown', 'borders', 'airports', 'ports'];
const tightened = (before: number, now: number) =>
  CRACKDOWN.some((measure) => measureLevel(now, measure) > measureLevel(before, measure));

/** 一条“事.选项”是不是守方的事 */
const defenderDecided = (subject: string) =>
  DECISIONS.find((decision) => subject.startsWith(`${decision.id}.`))?.side === 'defender';

/** 盯着这一方的状态出提示。要在组件的 setup 里调（它用了 watchEffect） */
export function watchAlerts(view: () => OutbreakView | null): Alerts {
  const list = shallowRef<readonly Alert[]>([]);
  const pings = shallowRef<readonly Ping[]>([]);
  let nextId = 1;
  let previous: OutbreakView | null = null;
  /** 已经说过的里程碑：一局里每个只说一次 */
  let fired = new Set<string>();

  const dismiss = (id: number) => (list.value = list.value.filter((alert) => alert.id !== id));

  function ping(region: number, tone: AlertTone = 'signal') {
    if (region < 0) return;
    const id = nextId++;
    pings.value = [...pings.value, { id, region, tone }];
    setTimeout(() => (pings.value = pings.value.filter((it) => it.id !== id)), PING_MS);
  }

  function push(tone: AlertTone, data: AlertData) {
    const id = nextId++;
    // 同一种“对面在动”的提示只留最新的一条：电脑一天动一次，不合并就成了刷屏
    const kept =
      data.kind === 'crackdown'
        ? list.value.filter((it) => it.data.kind !== data.kind)
        : list.value;
    list.value = [...kept, { id, tone, data }].slice(-SHOWN);
    setTimeout(() => dismiss(id), ALERT_MS);
    if ('region' in data) ping(data.region, tone);
  }

  /**
   * 里程碑：条件成立、而且没说过，就说一次。quiet 是接着一局打的时候（读档、刷新）——
   * 早就越过的线只记下、不再翻出来说。
   */
  function milestones(now: OutbreakView, quiet: boolean) {
    const once = (key: string, reached: boolean, tone: AlertTone, data: AlertData) => {
      if (!reached || fired.has(key)) return;
      fired.add(key);
      if (!quiet) push(tone, data);
    };
    /** 一方的好消息是另一方的坏消息 */
    const forAttacker: AlertTone = now.attacker ? 'calm' : 'danger';
    const forDefender: AlertTone = now.attacker ? 'danger' : 'calm';

    once('firstDeath', now.totals.deaths > 0, forAttacker, { kind: 'firstDeath' });
    for (const count of REGION_STEPS) {
      once(`regions:${count}`, now.totals.regions >= count, forAttacker, {
        kind: 'regions',
        count,
      });
    }
    for (const count of INFECTED_STEPS) {
      once(`infected:${count}`, now.totals.infected >= count, forAttacker, {
        kind: 'infected',
        count,
      });
    }
    for (const share of CALAMITY_STEPS) {
      once(`calamity:${share}`, now.calamity >= share, forAttacker, { kind: 'calamity', share });
    }
    for (const level of TRUST_STEPS) {
      once(`trust:${level}`, now.defense.trust < level, forAttacker, { kind: 'trust', level });
    }
    once('vaccine', now.defense.vaccinating, forDefender, { kind: 'vaccine' });
    if (!now.attacker) {
      once('identified', now.pathogen.known, 'calm', { kind: 'identified' });
      // 预算快见底：照现在的收支撑不过两周
      const burn = now.defense.upkeep - now.defense.income;
      const days = burn > 0 ? now.resource / burn : Infinity;
      if (days > 30) fired.delete('runway');
      once('runway', days < 14, 'danger', { kind: 'runway', days: Math.max(0, Math.floor(days)) });
    }
    // 医疗挤兑：头一个地区说是哪里，之后只按个数说（疫情大了以后几十个地区同时挤兑，逐个说就成了刷屏）
    const strained = now.strain.reduce((count, level) => count + (level >= 1 ? 1 : 0), 0);
    once('strain', strained > 0, forAttacker, {
      kind: 'strain',
      region: now.strain.findIndex((level) => level >= 1),
    });
    for (const count of STRAIN_STEPS) {
      once(`strain:${count}`, strained >= count, forAttacker, { kind: 'strainCount', count });
    }

    const { scenario } = now;
    if (scenario && scenario.goals.length > 0) {
      // 离目标最远的那一项到了几成
      const share = Math.min(...scenario.goals.map((goal) => (goal.value ?? 0) / goal.target));
      for (const step of GOAL_STEPS) {
        once(`goal:${step}`, share >= step, forAttacker, { kind: 'goal', share: step });
      }
      for (const days of DEADLINE_STEPS) {
        once(`deadline:${days}`, scenario.days - now.tick <= days, 'signal', {
          kind: 'deadline',
          days,
        });
      }
    }
  }

  /** 上一份和这一份之间变了什么：自己做的事的回应，和对面做的要紧事 */
  function changes(before: OutbreakView, now: OutbreakView) {
    for (const trait of now.pathogen.owned) {
      if (before.pathogen.known && !before.pathogen.owned.includes(trait)) {
        push(now.attacker ? 'calm' : 'danger', { kind: 'trait', trait, own: now.attacker });
      }
    }
    for (const tech of now.defense.done) {
      if (!before.defense.done.includes(tech)) {
        push(now.attacker ? 'danger' : 'calm', { kind: 'research', tech, own: !now.attacker });
      }
    }

    const changed: number[] = [];
    const cracked: number[] = [];
    now.measures.forEach((bits, region) => {
      const old = before.measures[region]!;
      if (bits === old) return;
      changed.push(region);
      if (tightened(old, bits)) cracked.push(region);
    });
    if (!now.attacker) {
      const [only] = changed;
      if (changed.length === 1 && only !== undefined) {
        push('calm', {
          kind: 'measure',
          region: only,
          from: before.suppression[only]!,
          to: now.suppression[only]!,
        });
      } else if (changed.length > 1) {
        push('calm', { kind: 'measures', count: changed.length });
        for (const region of changed.slice(0, 12)) ping(region, 'calm');
      }
    } else if (cracked.length > 0) {
      push('danger', { kind: 'crackdown', count: cracked.length, region: cracked[0]! });
      for (const region of cracked.slice(1, 12)) ping(region, 'danger');
    }

    const own = !now.attacker;
    now.defense.teams.forEach((team, index) => {
      const old = before.defense.teams[index];
      if (!old) return;
      if (team.region !== old.region) {
        // 派出去、召回：只有下命令的那一方要听回音
        if (own) push('calm', { kind: 'teamSent', region: team.region, days: team.arrivesIn });
      } else if (team.region >= 0 && old.arrivesIn > 0 && team.arrivesIn === 0) {
        push(own ? 'calm' : 'danger', { kind: 'teamArrived', region: team.region, own });
      }
    });
    if (now.defense.briefingIn > before.defense.briefingIn) {
      push(own ? 'calm' : 'danger', {
        kind: 'briefing',
        from: before.defense.trust,
        to: now.defense.trust,
        own,
      });
    }
    if (own && now.defense.priority !== before.defense.priority) {
      push('calm', { kind: 'priority', policy: now.defense.priority });
    }

    if (now.decision && now.decision.id !== before.decision?.id) {
      push('signal', { kind: 'decisionPending', decision: now.decision.id });
    }
    // 这几样在模拟里都记成了新闻：上一份状态之后新出的那几条各说一声
    for (const item of now.news) {
      if (item.tick < before.tick) continue;
      if (item.kind === 'skill') {
        push('calm', { kind: 'skill', skill: item.subject, region: item.region });
      } else if (item.kind === 'devolve') {
        push(now.attacker ? 'calm' : 'danger', {
          kind: 'devolve',
          trait: item.subject,
          own: now.attacker,
        });
      } else if (item.kind === 'decision') {
        // 攻方那边的事只有攻方看得到；守方的决定是公开的
        const mine = now.attacker ? !defenderDecided(item.subject) : true;
        push(mine ? 'calm' : 'danger', { kind: 'decided', subject: item.subject, own: mine });
      }
    }
  }

  watchEffect(() => {
    const now = view();
    if (!now || now === previous) return;
    const before = previous;
    previous = now;
    // 新的一局、换了一方、回放时往回跳：从头来，早就成立的事不再说
    if (!before || now.tick < before.tick || now.player !== before.player) {
      fired = new Set();
      list.value = [];
      milestones(now, now.tick > 1);
      return;
    }
    if (now.outcome) return;
    changes(before, now);
    milestones(now, false);
  });

  return { list, pings, dismiss, ping };
}
