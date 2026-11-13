/**
 * 游戏里每样东西用哪个图标。大多数来自 lucide，它没有的几个（蚊子、口罩、肺、停飞）是组件库里自己画的。
 * 表里没有的 id（以后内容加了新东西、这里还没配）用各自的默认图标顶上。
 */
import type { ChapterId } from '@miwang/content';
import type { Measure, NewsKind, TraitGroup } from '@miwang/sim';
import { FaceMask, Lungs, Mosquito, PlaneOff, type IconData } from '@rune-engine/ui';
import {
  AirVent,
  Anchor,
  Annoyed,
  Baby,
  Bandage,
  Banknote,
  BatteryLow,
  BedSingle,
  Beef,
  Biohazard,
  Brain,
  Bug,
  CircleDotDashed,
  ClipboardCheck,
  ClipboardPlus,
  CloudFog,
  CloudRainWind,
  Dna,
  Droplet,
  DropletOff,
  Droplets,
  EyeOff,
  Factory,
  Fence,
  FlaskConical,
  Footprints,
  Ghost,
  GlassWater,
  Hand,
  HandHeart,
  Hourglass,
  Lock,
  MapPin,
  Megaphone,
  MessageCircleWarning,
  Microscope,
  Mountain,
  MountainSnow,
  Package,
  PartyPopper,
  PawPrint,
  Pill,
  PillBottle,
  Plane,
  Radar,
  ScanLine,
  SearchX,
  ShieldOff,
  ShowerHead,
  Shuffle,
  Skull,
  Snowflake,
  Sparkles,
  SprayCan,
  Sprout,
  Sun,
  Syringe,
  Tablets,
  TestTubeDiagonal,
  Thermometer,
  Timer,
  Toilet,
  TreePalm,
  Trophy,
  Truck,
  Utensils,
  Volume2,
  Waypoints,
  Wind,
  Zap,
} from 'lucide';

const TRAITS: Readonly<Record<string, IconData>> = {
  air1: Wind,
  air2: AirVent,
  air3: CloudFog,
  contact1: Hand,
  contact2: Package,
  water1: GlassWater,
  water2: Utensils,
  vector1: Mosquito,
  vector2: Bug,
  blood1: Droplet,
  blood2: Baby,
  animal1: PawPrint,
  animal2: Beef,

  cough: Volume2,
  sneeze: SprayCan,
  fever: Thermometer,
  pneumonia: Lungs,
  respiratoryFailure: AirVent,
  nausea: Annoyed,
  diarrhea: Toilet,
  dehydration: DropletOff,
  rash: CircleDotDashed,
  lesions: Bandage,
  hemorrhage: Droplets,
  fatigue: BatteryLow,
  immunosuppression: ShieldOff,
  encephalitis: Brain,
  organFailure: Skull,

  cold1: Snowflake,
  cold2: MountainSnow,
  heat1: Sun,
  heat2: TreePalm,
  resistance1: PillBottle,
  resistance2: Tablets,
  drift1: Shuffle,
  drift2: Dna,
  latency: Hourglass,
  presymptomatic: Timer,
  stealth1: EyeOff,
  stealth2: SearchX,
  carrier: Ghost,
};

const TECHS: Readonly<Record<string, IconData>> = {
  identify: Microscope,
  rapidTest: TestTubeDiagonal,
  tracing: Waypoints,
  origin: Radar,
  treatment1: ClipboardPlus,
  treatment2: Pill,
  communication: Megaphone,
  aid: HandHeart,
  vaccine1: FlaskConical,
  vaccine2: ClipboardCheck,
  vaccine3: Factory,
  logistics: Truck,
};

const EVENTS: Readonly<Record<string, IconData>> = {
  festival: PartyPopper,
  sports: Trophy,
  flood: CloudRainWind,
  earthquake: Mountain,
  rumor: MessageCircleWarning,
  breakthrough: Sparkles,
  funding: Banknote,
  mutation: Zap,
};

export const MEASURE_ICONS: Readonly<Record<Measure, IconData>> = {
  testing: TestTubeDiagonal,
  isolation: BedSingle,
  masks: FaceMask,
  lockdown: Lock,
  borders: Fence,
  airports: PlaneOff,
  ports: Anchor,
  sanitation: ShowerHead,
  vectorControl: SprayCan,
  screening: ScanLine,
};

export const GROUP_ICONS: Readonly<Record<TraitGroup, IconData>> = {
  route: Wind,
  symptom: Thermometer,
  ability: Dna,
};

/** 新闻的种类各用什么图标；事件类的再按事件的 id 细分 */
const NEWS: Readonly<Record<NewsKind, IconData>> = {
  spread: MapPin,
  report: MapPin,
  evolve: Dna,
  research: FlaskConical,
  vaccine: Syringe,
  event: Zap,
  traced: Radar,
  outcome: Trophy,
};

const PATHOGENS: Readonly<Record<string, IconData>> = {
  novel: Biohazard,
  influenza: Wind,
  measles: CircleDotDashed,
  cholera: GlassWater,
  dengue: Mosquito,
  malaria: Bug,
  tuberculosis: Lungs,
  norovirus: Utensils,
  ebola: Droplets,
  pertussis: Volume2,
};

export const pathogenIcon = (id: string): IconData => PATHOGENS[id] ?? Biohazard;
export const traitIcon = (id: string): IconData => TRAITS[id] ?? Dna;
export const techIcon = (id: string): IconData => TECHS[id] ?? FlaskConical;
export const newsIcon = (kind: NewsKind, subject: string): IconData =>
  (kind === 'event' ? EVENTS[subject] : undefined) ?? NEWS[kind];

/** 每章一个图标：萌芽、变异、脚印、山、飞机 */
export const CHAPTER_ICONS: Readonly<Record<ChapterId, IconData>> = {
  bewilderment: Sprout,
  malice: Dna,
  wilds: Footprints,
  hills: Mountain,
  sky: Plane,
};
