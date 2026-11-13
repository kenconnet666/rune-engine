/**
 * 界面的中文文案。固定的话是字符串，带变量的话是函数。
 * 英文在 en.ts，形状必须和这里一样（它的类型就是这里的 ClientText）。
 */
export const zh = {
  /** 把几个名字连成一句 */
  list: (names: readonly string[]) => names.join('、'),

  app: {
    mapLabel: '世界地图：拖动平移，滚轮或双指缩放，点一个地区看详情',
    guest: (room: string) => `已加入房间 ${room}，主机在另一位玩家那边。`,
    resumed: (days: number, ms: string) =>
      `这一局是照着记录重放接上的：${days} 天，用了 ${ms} 毫秒。`,
    disclaimer: '数值还在调：航线是模型估的，病原体不对应任何真实疾病。',
    renderLost: (reason: string) => `画面断了，正在恢复：${reason}`,
    infection: '感染程度',
    reported: '上报程度',
  },

  status: {
    waiting: '正在等主机…',
    attacker: '攻方 · 真实态势',
    defender: '守方 · 上报态势',
    day: (day: number) => `第 ${day} 天`,
    infections: '现有感染',
    cases: '现有病例（估）',
    deaths: '死亡',
    regions: '波及地区',
    points: '变异点',
    budget: '预算',
    perDay: (net: string) => `每天 ${net}`,
    calamityAttacker: '灾厄（到头就赢）',
    calamityDefender: '灾厄（到头就输；按上报的死亡算）',
    trust: '公众信任',
    compliance: (share: string) => `措施见效 ${share}`,
  },

  news: {
    title: '新闻',
    empty: '还没有什么消息。',
    day: (day: number) => `第 ${day} 天`,
    spread: (place: string) => `${place}出现了感染`,
    report: (place: string) => `${place}上报了第一例`,
    evolved: (name: string) => `获得性状：${name}`,
    evolvedSeen: (name: string) => `病原体出现新的性状：${name}`,
    research: (name: string) => `研究完成：${name}`,
    vaccine: '疫苗开始在各地接种',
    traced: (place: string) => `溯源完成：起源地是${place}`,
    eventAt: (place: string, name: string) => `${place}：${name}`,
  },

  region: {
    deselect: '取消选中',
    population: (year: number) => `人口（${year} 年）`,
    immune: '已接种',
    conditions: '条件',
    routes: '路线',
    routeCounts: (land: number, air: number, sea: number) =>
      `陆路 ${land} · 航线 ${air} · 海运 ${sea}`,
    gathering: '这里正有大型集会。',
    disaster: '这里正遭受自然灾害。',
    measures: '措施',
    measuresOn: (count: number) => `${count} 项开着`,
    defenderHere: (names: string) => `守方在这里：${names}`,
    defenderNone: '守方还没有在这里采取措施。',
    daily: (cost: string) => `每天 ${cost}`,
    setup: (cost: string) => `开启 ${cost}`,
    measureHint: (name: string, detail: string, setup: string, daily: string) =>
      `${name}：${detail}（开启 ${setup}，之后每天 ${daily}）`,
  },

  pathogen: {
    title: '病原体',
    traits: (count: number) => `${count} 个性状`,
    unknown: '还不知道对手的底细：做完“病原鉴定”才看得到它的传播途径和每一次变异。',
    owned: (names: string) => `已有：${names}`,
    none: '还没有任何性状。',
    evolve: '进化',
    affordable: (count: number) => `${count} 个换得起`,
    points: (count: number) => `${count} 点`,
  },

  research: {
    title: '研究',
    progress: (done: number, total: number) => `完成 ${done} / ${total}`,
    vaccinating: '疫苗已经量产，各地正在接种。',
    remaining: (days: number) => `还要 ${days} 天`,
    none: '还没有开始任何研究。',
    done: (names: string) => `已完成：${names}`,
    open: '安排研究',
    busy: '实验室都占着',
    free: (count: number) => `${count} 个实验室空着`,
  },

  workbench: {
    evolveTitle: '进化',
    researchTitle: '研究',
    pick: '点一个图块看它是什么。',
    owned: '已经有了',
    done: '已经完成',
    inProgress: (days: number) => `正在进行，还要 ${days} 天`,
    locked: '前置还没满足',
    requiresAny: (names: string) => `需要先有其中一个：${names}`,
    requiresAll: (names: string) => `需要先完成：${names}`,
    effects: '效果',
    cost: '代价',
    points: (count: number) => `${count} 点`,
    budget: (cost: number, days: number) => `预算 ${cost} · ${days} 天`,
    evolve: '换这个性状',
    research: '开始研究',
    cannotAfford: '还不够',
    labsBusy: '实验室都占着：等一项做完再开新的。',
    days: (count: number) => `${count} 天`,
    yes: '是',
  },

  opponent: {
    human: '对手 · 另一位玩家',
    ai: '对手 · 电脑',
    room: (room: string) => `房间 ${room}：两位玩家都在。`,
    level: '电脑的难度',
    levels: ['简单', '普通', '困难'],
    invite: '邀请另一位玩家',
    inviteHelp:
      '在这台电脑的另一个标签页打开下面的地址（现在只能连同一个浏览器，网络直连还没做）：',
  },

  controls: {
    time: '时间',
    pause: '暂停',
    speed: (times: number) => `${times} 倍速`,
    zoomIn: '放大',
    zoomOut: '缩小',
    fit: '回到整张地图',
    role: '扮演',
    attacker: '攻方',
    defender: '守方',
    restart: '新开一局',
    language: '语言',
  },

  setup: {
    title: '新开一局',
    pathogen: '病原体',
    side: '你扮演',
    level: '电脑对手的难度',
    facts: '关于它的原型',
    play: '在这局游戏里',
    sources: '资料来源',
    note: '游戏里的数值是照着原型的“性格”定的，不是这种病的真实参数。',
    start: '开始',
  },

  outcome: {
    title: (day: number) => `第 ${day} 天 · 对局结束`,
    won: '你赢了',
    lost: '你输了',
    infected: '累计感染',
    reported: '累计上报',
    deaths: '死亡',
    regions: '波及地区',
    traits: '病原体的性状',
    unknown: '未知',
    techs: '完成的研究',
    trust: '公众信任',
    economy: '经济损失',
    restart: '新开一局',
  },
};

export type ClientText = typeof zh;
