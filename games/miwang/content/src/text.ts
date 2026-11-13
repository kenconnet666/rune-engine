/**
 * 各张表里的东西在界面上叫什么、一句话说明是什么。现在只有中文；
 * 中英文可切换的文案系统是路线图阶段 2 的事，到时这里的内容搬过去。
 */
import type { Measure, TraitGroup } from '@miwang/sim';

export interface Label {
  readonly name: string;
  readonly detail: string;
}

const label = (name: string, detail: string): Label => ({ name, detail });

export const GROUP_TEXT: Readonly<Record<TraitGroup, string>> = {
  route: '传播途径',
  symptom: '症状',
  ability: '能力',
};

export const TRAIT_TEXT: Readonly<Record<string, Label>> = {
  air1: label('飞沫传播', '咳嗽、说话时的飞沫带着病原体。人多、天冷的地方传得快。'),
  air2: label('空气传播', '更小的颗粒能在空气里停留更久，也更容易跟着航班扩散。'),
  air3: label('气溶胶', '在密闭的空间里长时间悬浮，一个人能传给一屋子人。'),
  contact1: label('接触传播', '通过握手、共用物品传播。人口稠密的地方更有利。'),
  contact2: label('环境存活', '在物体表面存活更久，也能跟着货物走海运。'),
  water1: label('水源传播', '污染饮用水和食物。卫生条件差的地区首当其冲。'),
  water2: label('食源扩散', '在食物里繁殖，沿着贸易和航运走得更远。'),
  vector1: label('蚊媒传播', '由蚊子叮咬传播。热带全年有效，温带只在夏天。'),
  vector2: label('媒介适应', '适应更多种类的蚊虫，叮一次就能传上。'),
  blood1: label('血液传播', '通过血液和体液传播，病程拖得更长。封锁对它几乎没用。'),
  blood2: label('母婴与医源', '经由不安全的医疗操作和母婴途径传播。'),
  animal1: label('动物宿主', '在野生动物中存续：清除了的地方还会再冒出病例。'),
  animal2: label('家畜宿主', '进入家畜群体，人和它们朝夕相处。'),

  cough: label('咳嗽', '轻微，但每一声都在帮它传播。'),
  sneeze: label('打喷嚏', '飞沫喷得更远。'),
  fever: label('发热', '身体在抵抗。病人开始察觉自己病了。'),
  pneumonia: label('肺炎', '感染深入肺部，需要住院。'),
  respiratoryFailure: label('呼吸衰竭', '没有呼吸支持就会致命。'),
  nausea: label('恶心', '轻微的消化道症状。'),
  diarrhea: label('腹泻', '排泄物污染水源，同时让病人脱水。'),
  dehydration: label('严重脱水', '得不到补液的病人会在几天内死亡。'),
  rash: label('皮疹', '看得见的症状，也让接触传播更容易。'),
  lesions: label('皮肤溃破', '破损的皮肤渗出带病原体的体液。'),
  hemorrhage: label('出血', '内外出血。致命，也触目惊心——很难不被发现。'),
  fatigue: label('乏力', '病人恢复得更慢。'),
  immunosuppression: label('免疫抑制', '免疫系统被削弱，病程拖长，并发症增多。'),
  encephalitis: label('脑炎', '侵入中枢神经系统。'),
  organFailure: label('多器官衰竭', '终末期。'),

  cold1: label('耐寒', '在寒冷的地区也能传播。'),
  cold2: label('极地适应', '完全不怕冷。'),
  heat1: label('耐热', '在炎热的地区也能传播。'),
  heat2: label('热带适应', '完全不怕热。'),
  resistance1: label('耐药', '现有药物的效果打折扣，医疗能挽回的人变少。'),
  resistance2: label('多重耐药', '大多数药物失效。'),
  drift1: label('抗原漂移', '表面蛋白不断变化：疫苗研发变慢，康复的人会再次感染。'),
  drift2: label('抗原转变', '变化得更快，免疫很快失效。'),
  latency: label('延长潜伏', '潜伏期更长，感染者在不知情时带着它走得更远。'),
  presymptomatic: label('症状前传播', '还没出现症状就有传染性。'),
  stealth1: label('症状不典型', '容易被当成普通的小病，更难被发现。'),
  stealth2: label('检测逃逸', '常规检测查不出来。'),
  carrier: label('无症状携带', '许多感染者完全没有症状——病得轻了，但几乎无从发现。'),
};

export const TECH_TEXT: Readonly<Record<string, Label>> = {
  identify: label('病原鉴定', '分离并测序病原体。之后才看得到它的传播途径和每一次变异。'),
  rapidTest: label('快速检测', '便宜、快速的检测试剂，各地的发现率都提高。'),
  tracing: label('流行病学调查', '追踪密切接触者，隔离的效果更好。'),
  origin: label('溯源', '找到最初的源头。之后动物宿主造成的反复会减少。'),
  treatment1: label('诊疗方案', '总结出有效的对症治疗，病死率下降。'),
  treatment2: label('特效药', '针对性的药物，病死率进一步下降（耐药会削弱它）。'),
  communication: label('风险沟通', '及时、透明地告诉公众发生了什么。信任的基准线提高。'),
  aid: label('国际援助', '向低收入地区提供医疗和检测支持，把它们拉到中等水平。'),
  vaccine1: label('候选疫苗', '疫苗的第一步：设计并筛选候选。'),
  vaccine2: label('临床试验', '疫苗的第二步：验证安全和有效。'),
  vaccine3: label('疫苗量产', '疫苗的第三步：做完就开始在各地接种。'),
  logistics: label('接种后勤', '冷链、接种点、人手——接种速度提高。'),
};

export const MEASURE_TEXT: Readonly<Record<Measure, Label>> = {
  testing: label('加强检测', '发现更多病例。'),
  isolation: label('隔离病例', '把发现的病人隔离起来；发现得越多越有用。'),
  masks: label('口罩与距离', '压低飞沫传播。轻微消耗信任。'),
  lockdown: label('封锁', '大幅压低传播和进出。经济和信任的代价都很高。'),
  borders: label('关闭陆路口岸', '切断和邻国的陆路往来。'),
  airports: label('停飞', '切断航线。'),
  ports: label('封港', '切断海运。'),
  sanitation: label('净水与消毒', '压低水源和食物传播。'),
  vectorControl: label('灭蚊', '压低蚊媒传播。'),
  screening: label('入境筛查', '拦下一部分输入的感染者。'),
};

export const EVENT_TEXT: Readonly<Record<string, Label>> = {
  festival: label('节庆', '人群聚集，这里的传播在一段时间里加强。'),
  sports: label('体育赛事', '看台坐满了人，这里的传播在一段时间里加强。'),
  flood: label('洪水', '水源被污染，医疗和检测一度瘫痪。'),
  earthquake: label('地震', '医院受损，医疗和检测一度瘫痪。'),
  rumor: label('谣言四起', '公众信任下降。'),
  breakthrough: label('科研突破', '进行中的研究提前了。'),
  funding: label('紧急拨款', '预算增加。'),
  mutation: label('自发变异', '病原体得到额外的变异点。'),
};

export const OUTCOME_TEXT: Readonly<Record<string, string>> = {
  calamity: '死亡越过了灾厄线。',
  eradicated: '病原体被清除了。',
  timeout: '防线守到了最后。',
};
