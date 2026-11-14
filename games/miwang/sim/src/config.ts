/**
 * 一局的配置：世界（地区和路线）、病原体档案、性状表、科技表、事件表、规则里的数值。
 * 规则代码只解释这些数据——换一种病、调一个数都只改配置。配置跟着对局记录一起存，所以调过数值之后旧记录照样能重放。
 */

// ───── 病原体的数值 ─────

/** 传播途径：每条途径各有一个强度，在不同地区的适宜程度不同、被不同的措施克制 */
export const ROUTES = ['air', 'contact', 'water', 'vector', 'blood'] as const;
export type Route = (typeof ROUTES)[number];

/**
 * 病原体的一组数值，性状的效果也用同一组键（效果是加到底数上的增量）：
 *   air contact water vector blood  各传播途径的强度（一个发病者一天在适宜条件下传给几个人）
 *   animal          动物宿主：让疾病在到过的地区重新冒出来
 *   severity        严重度：越高越容易被发现，病人越走不远
 *   lethality       致死性：没有任何医疗时发病者的病死率
 *   stealth         隐匿：压低发现率
 *   cold heat       耐寒、耐热（0–1）：把病原体在寒带、热带的不适应补回来
 *   resistance      耐药（0–1）：削弱药物和医疗的效果
 *   drift           抗原漂移：拖慢疫苗，让康复者和接种者重新变得易感
 *   presymptomatic  症状前传播（0–1）：潜伏者按这个比例算作有传染性
 *   incubation duration  潜伏期、病程各延长几天
 *   aviation maritime    沿航线、海运扩散的加成
 */
export const EFFECT_KEYS = [
  ...ROUTES,
  'animal',
  'severity',
  'lethality',
  'stealth',
  'cold',
  'heat',
  'resistance',
  'drift',
  'presymptomatic',
  'incubation',
  'duration',
  'aviation',
  'maritime',
] as const;
export type EffectKey = (typeof EFFECT_KEYS)[number];
export type Effects = Readonly<Partial<Record<EffectKey, number>>>;
export type PathogenStats = Record<EffectKey, number>;

export type TraitGroup = 'route' | 'symptom' | 'ability';

/** 一种病原体的底子 */
export interface PathogenProfile {
  readonly id: string;
  /** 各项数值的底数 */
  readonly base: Effects;
  /** 潜伏期、病程（天） */
  readonly incubationDays: number;
  readonly infectiousDays: number;
  /** 在热带、温带、寒带的适宜程度（0–1，下标是气候） */
  readonly climate: readonly [tropical: number, temperate: number, cold: number];
  /** 各组性状的价格倍数（没写的是 1）：有的病原体变异得快，有的换症状贵 */
  readonly costScale?: Readonly<Partial<Record<TraitGroup, number>>>;
  /**
   * 性状、协同给的传播途径强度乘这个数（没写的是 1）。强度是“一个病人一天传给几个人”：
   * 病程很长的病（一个病人要传几个月），同样加 0.07 就是别的病的十几倍——这样的档案把它调小
   */
  readonly routeScale?: number;
}

/** 攻方能换的一个性状 */
export interface TraitDef {
  readonly id: string;
  readonly group: TraitGroup;
  readonly cost: number;
  /** 前置：已有其中任意一个就能换；空的是起点 */
  readonly requires: readonly string[];
  readonly effects: Effects;
}

/**
 * 协同：requires 里的性状都有了，再额外得到 effects（退掉其中一个就没有了）。
 * 让“换哪几个”不只是各算各的：有的搭配比单个加起来强。
 */
export interface SynergyDef {
  readonly id: string;
  readonly requires: readonly string[];
  readonly effects: Effects;
}

// ───── 临时的全局修正 ─────

/**
 * 在一段时间里改一个数（技能“蛰伏”、双方的抉择用）：
 *   detect  各地的发现率加多少（负的是更难发现）
 *   spread  本地传播的倍数加多少（0.1 是强一成，负的是弱）
 *   income  守方每天收入的倍数加多少
 *   rollout 接种速度的倍数加多少
 */
export const MODIFIER_KEYS = ['detect', 'spread', 'income', 'rollout'] as const;
export type ModifierKey = (typeof MODIFIER_KEYS)[number];
export type Modifiers = Readonly<Partial<Record<ModifierKey, number>>>;

// ───── 攻方的技能 ─────

/**
 * 技能的种类（规则认识的就这几种，技能表决定各自多贵、冷却多久、幅度多大）：
 *   spillover 外溢：在一个还没到过的地区凭空落脚，冒出 amount 个感染者（不管它和别处通不通）
 *   surge     激增：一个到过的地区在 days 天里传播加强（倍数是规则里的 surgeBoost）
 *   veil      蛰伏：全世界在 days 天里按 modifiers 改（更难被发现，也传得慢一些）
 */
export type SkillKind = 'spillover' | 'surge' | 'veil';

export interface SkillDef {
  readonly id: string;
  readonly kind: SkillKind;
  /** 用一次要多少变异点，之后要等几天才能再用 */
  readonly cost: number;
  readonly cooldown: number;
  readonly days?: number;
  readonly amount?: number;
  readonly modifiers?: Modifiers;
}

// ───── 抉择 ─────

/**
 * 抉择的一个选项：立刻生效的几样，加上持续 days 天的修正。
 * 冲着某个地区来的事（危机）还可以带落在那个地区的效果：闹事、放松封锁、医疗支援、口子漏风。
 */
export interface DecisionOption {
  readonly id: string;
  /** 变异点、预算、信任各加多少（可以是负的） */
  readonly points?: number;
  readonly budget?: number;
  readonly trust?: number;
  /** 进行中的研究剩下的天数减掉这个比例（负的是拖慢） */
  readonly research?: number;
  readonly modifiers?: Modifiers;
  readonly days?: number;
  /** 那个地区闹事几天：这期间那里的措施效果打折（Rules.unrestCompliance） */
  readonly unrest?: number;
  /** 那个地区的封锁降几档 */
  readonly relax?: number;
  /** 那个地区得到几天的医疗支援：救得回来的人多一些（Rules.reliefCare） */
  readonly relief?: number;
  /** 那个地区的口岸、机场、港口漏风几天：关着也拦不住多少（Rules.leakGate） */
  readonly leak?: number;
}

/**
 * 危机的起因（局面到了这一步才出，不靠运气；见 rules/crises.ts）：
 *   fatigue 封锁太久   overload 医疗挤兑   sealed 口子关得太久（攻方的事）
 *   hesitancy 疫苗开打而信任不高   identified 守方做完了病原鉴定（攻方的事）
 */
export type CrisisCause = 'fatigue' | 'overload' | 'sealed' | 'hesitancy' | 'identified';

/**
 * 一件要某一方拿主意的事。到期没选按第一个选项办，所以第一个放“照旧、什么都不做”的那个。
 * when 是它出现的条件：research 守方有研究在进行，spread 疾病已经到过好几个地区；不写是什么时候都可能。
 */
export interface DecisionDef {
  readonly id: string;
  readonly side: 'attacker' | 'defender';
  /** 相对的常见程度 */
  readonly weight: number;
  /** 要在几天之内选 */
  readonly days: number;
  readonly when?: 'research' | 'spread';
  /** 只在这种病原体（档案的 id）的局里出：各种病自己的事 */
  readonly pathogen?: string;
  /** 写了就是一件“危机”：不参加平时的随机，局面到了这一步才出；weight 用不上 */
  readonly crisis?: CrisisCause;
  readonly options: readonly DecisionOption[];
}

// ───── 防控的数值 ─────

/**
 * 守方的地区措施。每项有档位（0 没开，1 轻，2 中，3 全力），各占 measures 里的两位：
 *   testing 加强检测   isolation 隔离病例   masks 口罩与距离   lockdown 封锁
 *   borders 关闭陆路口岸   airports 停飞   ports 封港
 *   sanitation 净水与消毒   vectorControl 灭蚊   screening 入境筛查
 */
export const MEASURES = [
  'testing',
  'isolation',
  'masks',
  'lockdown',
  'borders',
  'airports',
  'ports',
  'sanitation',
  'vectorControl',
  'screening',
] as const;
export type Measure = (typeof MEASURES)[number];

/** 一项措施的档位：0 没开，1 轻，2 中，3 全力。档位越高效果越大、越贵（各档是全力的几成见 Rules 的 levelEffect、levelCost） */
export type MeasureLevel = 0 | 1 | 2 | 3;
export const MAX_LEVEL = 3;
export const LEVELS: readonly MeasureLevel[] = [0, 1, 2, 3];

/** 各项措施在一个地区的“措施”那个数里从第几位开始（每项两位） */
const MEASURE_SHIFT = Object.fromEntries(
  MEASURES.map((measure, index) => [measure, index * 2]),
) as Readonly<Record<Measure, number>>;

/** 一个地区的措施（那个数）里，某一项开到了第几档 */
export const measureLevel = (bits: number, measure: Measure): MeasureLevel =>
  ((bits >>> MEASURE_SHIFT[measure]) & 3) as MeasureLevel;

/** 把某一项改成 level 档之后的那个数 */
export const withMeasure = (bits: number, measure: Measure, level: MeasureLevel): number =>
  ((bits & ~(3 << MEASURE_SHIFT[measure])) | (level << MEASURE_SHIFT[measure])) >>> 0;

/** 把几项措施各自的档位拼成那个数（没写的是没开） */
export const measuresOf = (levels: Readonly<Partial<Record<Measure, MeasureLevel>>>): number =>
  MEASURES.reduce((bits, measure) => withMeasure(bits, measure, levels[measure] ?? 0), 0);

/**
 * 疫苗先给谁：
 *   even       各地区按自己的接种能力打，不偏向谁
 *   hotspots   上报病例多的地方优先
 *   vulnerable 医疗弱的（穷的）地方优先
 *   productive 经济贡献大的地方优先（保住预算）
 * 一天能打的总量大致不变，变的是分给谁。
 */
export const VACCINE_POLICIES = ['even', 'hotspots', 'vulnerable', 'productive'] as const;
export type VaccinePolicy = (typeof VACCINE_POLICIES)[number];

/**
 * 科技的效果（做完的科技的效果相加）：
 *   detection  各地的发现率加多少       isolation  隔离的效果加多少（比例）
 *   treatment  药物把病死率压掉的比例   trust      信任的基准线加多少
 *   aid        国际援助（0–1）：把穷地区的医疗和检测往中等水平拉
 *   identify   ≥1 时守方看得到对手的性状   trace  ≥1 时守方知道起源地，动物宿主的外溢减弱
 *   vaccine    疫苗的进度，攒到 rules.vaccineStages 就开始接种   rollout  接种速度加多少（比例）
 */
export const DEFENSE_KEYS = [
  'detection',
  'isolation',
  'treatment',
  'trust',
  'aid',
  'identify',
  'trace',
  'vaccine',
  'rollout',
] as const;
export type DefenseKey = (typeof DEFENSE_KEYS)[number];
export type DefenseEffects = Readonly<Partial<Record<DefenseKey, number>>>;
export type DefenseStats = Record<DefenseKey, number>;

/** 守方能做的一项研究 */
export interface TechDef {
  readonly id: string;
  readonly cost: number;
  /** 要做多少天 */
  readonly days: number;
  /** 前置：全部做完才能开始 */
  readonly requires: readonly string[];
  readonly effects: DefenseEffects;
}

// ───── 事件 ─────

/**
 * 事件的种类（规则认识的就这几种，事件表决定各自多常见、持续多久、幅度多大）：
 *   gathering 大型集会：一个地区在 days 天里传播加强
 *   disaster  自然灾害：一个地区在 days 天里医疗和检测瘫痪
 *   rumor     谣言：信任下降 amount
 *   breakthrough 科研突破：进行中的研究剩余天数减少 amount（比例）
 *   funding   紧急拨款：预算增加 amount
 *   mutation  自发变异：变异点增加 amount
 */
export type EventKind =
  'gathering' | 'disaster' | 'rumor' | 'breakthrough' | 'funding' | 'mutation';

export interface EventDef {
  readonly id: string;
  readonly kind: EventKind;
  /** 相对的常见程度 */
  readonly weight: number;
  readonly days?: number;
  readonly amount?: number;
}

// ───── 日程 ─────

/**
 * 日程的种类（规则见 rules/calendar.ts）：
 *   travel 出行高峰：各条路线上的出行量加 amount（0.4 是多四成）
 *   rains  雨季：热带地区的水源、蚊媒传播加 amount
 *   games  国际赛事：一个经济大国办赛，那里有一场集会，全世界坐飞机的出行量加 amount
 */
export type CalendarKind = 'travel' | 'rains' | 'games';

/** 每年固定日子到来的一件事：提前 notice 天预告，从一年里的第 day 天（0 起）开始，持续 days 天 */
export interface CalendarDef {
  readonly id: string;
  readonly kind: CalendarKind;
  readonly day: number;
  readonly days: number;
  readonly notice: number;
  readonly amount: number;
}

// ───── 世界 ─────

export const TROPICAL = 0;
export const TEMPERATE = 1;
export const COLD = 2;
export type Climate = typeof TROPICAL | typeof TEMPERATE | typeof COLD;

/** 从一个地区出发的一种路线：去哪些地区，各占这个地区出行量的多少（权重之和不超过 1） */
export interface Links {
  readonly to: readonly number[];
  readonly weight: readonly number[];
}

export interface RegionConfig {
  readonly population: number;
  readonly climate: Climate;
  /** 富裕程度：0 低收入 … 3 高收入 */
  readonly wealth: number;
  /** 人口密度：0 稀疏、1 一般、2 稠密 */
  readonly density: number;
  /** 经济占世界的份额（所有地区加起来是 1） */
  readonly economy: number;
  /** 在南半球（季节和北半球相反） */
  readonly south: boolean;
  /** 陆路相邻的地区（下标） */
  readonly neighbors: readonly number[];
  readonly air: Links;
  readonly sea: Links;
}

/** 规则里所有能调的数。按用到它们的规则分组；“按富裕程度”的数组下标是 0–3，“按气候”的是热带、温带、寒带 */
export interface Rules {
  // 开局与胜负
  /** 开局时起源地有几个发病者 */
  readonly seedCases: number;
  /**
   * 开局的头 seedDays 天，起源地每天再冒出 seedDaily 个感染者（源头还没断）。
   * 起始的病例只有十来个，碰上运气不好会自己熄灭——那样的一局对谁都没意思；有了这一条，头一个月它熄不了
   */
  readonly seedDays: number;
  readonly seedDaily: number;
  /** 灾厄线：累计死亡达到开局世界人口的这个比例，攻方赢 */
  readonly calamityShare: number;
  /** 任何地方都没有潜伏者和发病者，连续这么多天，守方赢 */
  readonly clearDays: number;
  /** 期限（天）：到期还没分出胜负算守方守住了 */
  readonly maxDays: number;

  // 本地传播
  /** 飞沫、接触传播随密度的倍数（下标是密度 0–2） */
  readonly densityAir: readonly number[];
  readonly densityContact: readonly number[];
  /** 水源传播随富裕程度的倍数（越穷卫生条件越差） */
  readonly waterByWealth: readonly number[];
  /** 蚊媒传播随气候的倍数；温带、寒带的还要再乘夏季的程度 */
  readonly vectorByClimate: readonly number[];
  /** 血液传播随富裕程度的倍数 */
  readonly bloodByWealth: readonly number[];
  /** 冬季让飞沫传播增强的幅度（冬至 +这么多，夏至 −这么多） */
  readonly seasonAir: number;
  /** 康复者、接种者每天重新变得易感的比例，再乘抗原漂移 */
  readonly waningRate: number;
  /** 动物宿主：到过的地区每天重新冒出病例的概率，再乘 animal */
  readonly spilloverRate: number;
  /** 溯源完成后外溢概率剩下的比例 */
  readonly tracedSpillover: number;

  // 医疗与发现
  /** 医疗能挽回的病死比例，按富裕程度 */
  readonly careByWealth: readonly number[];
  /** 发病者占人口到这个比例时医疗被完全挤兑 */
  readonly careCapacity: number;
  /** 完全挤兑时医疗效果损失的比例 */
  readonly overloadLoss: number;
  /** 不采取任何措施时的发现率，按富裕程度 */
  readonly detectByWealth: readonly number[];
  readonly detectPerSeverity: number;
  readonly detectPerStealth: number;
  readonly detectMin: number;
  readonly detectMax: number;
  /** 死亡比发病更容易被上报：发现率加这么多 */
  readonly deathDetectBonus: number;
  /**
   * 一个地区要零星发现这么多例，才认得出“这是一种病在传”、开始上报：
   * 全世界都还不知道有这种病时要一小簇（First）；别处报过之后有了戒心，几例就够（Later）；
   * 做完病原鉴定有了检测手段，一例就认得出。认出来之前守方在那里什么都看不到。
   */
  readonly recognizeFirst: number;
  readonly recognizeLater: number;

  // 措施的效果（都是“压掉的比例”，实际效果还要乘配合程度）
  readonly testingDetect: number;
  /** 隔离压掉的传播 = 这个数 × 当地的发现率 */
  readonly isolationEffect: number;
  readonly masksAir: number;
  readonly lockdownAir: number;
  readonly lockdownContact: number;
  /** 封锁对其余途径（水源、蚊媒、血液）的效果 */
  readonly lockdownOther: number;
  /** 封锁压掉的进出 */
  readonly lockdownTravel: number;
  readonly bordersEffect: number;
  readonly airportsEffect: number;
  readonly portsEffect: number;
  readonly sanitationWater: number;
  readonly vectorControlEffect: number;
  /** 入境筛查拦下的输入感染者比例 */
  readonly screeningEffect: number;

  // 出行
  /** 一个带病的人一天沿陆路去到每个相邻地区的概率 */
  readonly landRate: number;
  /** 一个带病的人一天坐飞机、坐船出行的概率（再按路线的权重分给各目的地） */
  readonly airRate: number;
  readonly seaRate: number;
  /** 严重度让发病者走不动：出行量 ÷ (1 + 这个数 × 严重度) */
  readonly severityImmobility: number;

  // 事件
  /** 每天发生一件事的概率 */
  readonly eventChance: number;
  /** 大型集会期间传播的倍数 */
  readonly gatheringBoost: number;
  /** 灾害期间医疗、检测剩下的比例，和水源传播的倍数 */
  readonly disasterCare: number;
  readonly disasterWater: number;
  /** 灾害期间沿陆路离开那个地区的人是平时的几倍（逃难的人） */
  readonly refugeeLand: number;
  /** 日程的幅度乘这个数（表里写的是 1 倍时的）；0 是没有日程 */
  readonly calendarStrength: number;
  /** 每天每一方碰上一件要拿主意的事的概率（手里没有等着的事时）；开局的头几天不出 */
  readonly decisionChance: number;
  readonly decisionAfter: number;
  /** 一件事定下来之后，至少隔这么多天才出下一件 */
  readonly decisionGap: number;
  /** 危机：同一种至少隔这么多天才再出；写负数是不出危机 */
  readonly crisisGap: number;
  /** 一个地区的封锁（中档以上）连着这么多天，那里的人受不了了 */
  readonly fatigueDays: number;
  /** 一个有感染的地区口子（中档以上）连着关这么多天，开始有人走私 */
  readonly sealedDays: number;
  /** 闹事期间那个地区措施的配合程度剩下的比例 */
  readonly unrestCompliance: number;
  /** 医疗支援期间，医疗没能挽回的那部分再挽回多少 */
  readonly reliefCare: number;
  /** 漏风期间那个地区口子的效果剩下的比例 */
  readonly leakGate: number;
  /** 疫苗开打时信任低于这个数，会出“不肯打”的事 */
  readonly hesitancyTrust: number;
  /** 短期任务：开局第几天起发，一件完了隔几天发下一件；间隔写负数是不发任务 */
  readonly taskAfter: number;
  readonly taskGap: number;

  // 攻方的经济
  readonly startPoints: number;
  /** 每天固定给的变异点：开局感染还少、别的来源几乎没有的时候，靠它隔一两个月能换一个性状 */
  readonly pointsPerDay: number;
  /** 每天的变异点 = 这个数 × 新增感染的四次方根 */
  readonly pointsPerInfectionRoot: number;
  readonly pointsPerDeathRoot: number;
  /** 每波及一个新地区 */
  readonly pointsPerRegion: number;
  /** 每换一个性状，之后的性状贵这么多（比例） */
  readonly costGrowth: number;
  /** 退掉一个性状返还它底价的多少 */
  readonly devolveRefund: number;
  /** 技能“激增”期间那个地区传播的倍数 */
  readonly surgeBoost: number;

  // 守方的经济
  readonly startBudget: number;
  /**
   * 全世界都正常运转时每天的预算。应急的钱是出了事才拨的：头一个地区上报之前不拨
   * （那之前守方也没有什么要花钱的地方，白攒着只会让后面花钱没有压力）
   */
  readonly budgetPerDay: number;
  /** 各措施开到全力时每天的维持费（人口 5000 万的地区；别的地区按人口开方折算） */
  readonly upkeep: Readonly<Record<Measure, number>>;
  /** 各档的效果、花费各是全力的几成（下标是档位，0 档是 0）。轻的那一档花得少、效果打折没那么狠：铺得开 */
  readonly levelEffect: readonly number[];
  readonly levelCost: readonly number[];
  /** 把一项措施往上加档要预付几天的维持费（加出来的那部分） */
  readonly setupDays: number;
  /** 各措施让这个地区的经济贡献损失的比例 */
  readonly economyLoss: Readonly<Partial<Record<Measure, number>>>;
  /** 同时进行的研究上限 */
  readonly labs: number;
  /** 疫苗进度攒到这个数开始接种 */
  readonly vaccineStages: number;
  /** 抗原漂移让带疫苗进度的研究变慢：每天的进度 ÷ (1 + 这个数 × drift) */
  readonly driftVaccineDelay: number;
  /** 每天接种的人口比例，按富裕程度 */
  readonly rolloutByWealth: readonly number[];
  /** 优先的地区接种速度是别处的几倍（疫苗分配） */
  readonly priorityBoost: number;

  // 应急队：数量有限，派到一个地区要走几天，到了以后那里发现得多、救得回来的多
  readonly teams: number;
  readonly teamTravelDays: number;
  /** 应急队驻着的地区：发现率加多少；医疗没能挽回的那部分再挽回多少 */
  readonly teamDetect: number;
  readonly teamCare: number;

  // 发布会：花预算换信任，开过之后要隔一阵
  readonly briefingCost: number;
  readonly briefingTrust: number;
  readonly briefingCooldown: number;

  // 信任
  readonly startTrust: number;
  /** 没有任何压力时信任回到的基准线，和每天回去的比例 */
  readonly trustBaseline: number;
  readonly trustRecovery: number;
  /** 全世界都在封锁、都戴口罩时信任每天掉多少 */
  readonly trustLockdown: number;
  readonly trustMasks: number;
  /** 一天的死亡占世界人口到这个比例时，信任每天因此掉 trustDeaths */
  readonly trustDeathScale: number;
  readonly trustDeaths: number;
  /** 信任为 0 时措施还剩多少效果（配合程度的下限） */
  readonly complianceFloor: number;
}

/** 富裕程度最高的那一档（地区的 wealth 是 0–3） */
export const WEALTHIEST = 3;

/** 剧本里攻方要做到的一件事，按哪个数算 */
export type GoalMetric =
  /** 累计感染过的人次 */
  | 'infected'
  /** 出现过感染的地区数 */
  | 'regions'
  /** 出现过感染的最富裕地区数（WEALTHIEST 那一档） */
  | 'wealthy'
  /** 换到的性状数 */
  | 'traits'
  /** 累计死亡 */
  | 'deaths';

export interface Goal {
  readonly metric: GoalMetric;
  readonly target: number;
}

// ───── 短期任务 ─────

/** 任务看哪个数：剧本目标的那几个，加上 techs 完成的研究数、trust 公众信任、cases 现在的病例 */
export type TaskMetric = GoalMetric | 'techs' | 'trust' | 'cases';

/**
 * 一件短期任务（规则见 rules/tasks.ts）。看的是这一方自己看得到的数：攻方按真实的，守方按上报的。
 * mode 是怎么判：gain 比接到时多 target；grow 涨到接到时的 target 倍；cap 到期时多出来的不超过 target；
 * hold 到期前一直不低于 target；shrink 到期时不超过接到时的 target 倍。
 */
export interface TaskDef {
  readonly id: string;
  readonly side: 'attacker' | 'defender';
  /** 相对的常见程度 */
  readonly weight: number;
  /** 期限（天） */
  readonly days: number;
  readonly metric: TaskMetric;
  readonly mode: 'gain' | 'grow' | 'cap' | 'hold' | 'shrink';
  readonly target: number;
  /** 那个数到了这么多才发这件任务（比如“把病例压下来”要先有病例） */
  readonly from?: number;
  /** 开局第几天之后才发（开局做不到的任务别一上来就发） */
  readonly after?: number;
  /** 做到了给什么：变异点、预算、信任 */
  readonly reward: {
    readonly points?: number;
    readonly budget?: number;
    readonly trust?: number;
  };
}

/**
 * 剧本（章节）：给这一局另定胜负——攻方在期限内把几件事全做到就赢，到期没做到算守方守住了；
 * 病原体被清除照旧是守方赢。一件事都没列的剧本按普通对局的灾厄线分胜负，只是期限换成剧本的。
 * 没有剧本的就是普通对局。
 */
export interface Scenario {
  /** 哪个剧本（界面按它找名字和引导的文字） */
  readonly id: string;
  readonly goals: readonly Goal[];
  /** 期限（天） */
  readonly days: number;
}

export interface OutbreakConfig {
  readonly seed: number;
  /** 这一局从哪天开始（'YYYY-MM-DD'）；一步是一天 */
  readonly startDate: string;
  readonly regions: readonly RegionConfig[];
  /** 最先出现病例的地区 */
  readonly origin: number;
  readonly pathogen: PathogenProfile;
  readonly traits: readonly TraitDef[];
  readonly synergies: readonly SynergyDef[];
  readonly techs: readonly TechDef[];
  readonly events: readonly EventDef[];
  readonly calendar: readonly CalendarDef[];
  readonly skills: readonly SkillDef[];
  readonly decisions: readonly DecisionDef[];
  readonly tasks: readonly TaskDef[];
  readonly rules: Rules;
  readonly scenario?: Scenario;
  /**
   * 这一局的世界条件（内容的条件表里的 id）。它们怎么改规则在生成配置时已经算进 rules 了，
   * 模拟自己用不着；记在这里是为了告诉双方这一局有什么不一样。章节没有这一项
   */
  readonly conditions?: readonly string[];
}
