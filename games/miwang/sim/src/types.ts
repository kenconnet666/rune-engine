import type { RandomState } from '@rune-engine/core';

/** 一个地区：人口、和谁相邻（陆路）、和谁有航线 */
export interface RegionConfig {
  readonly population: number;
  /** 陆路相邻的地区（下标） */
  readonly neighbors: readonly number[];
  /** 有航线直达的地区（下标） */
  readonly flights: readonly number[];
}

export interface OutbreakConfig {
  readonly seed: number;
  /** 这一局从哪天开始（'YYYY-MM-DD'）；一步是一天 */
  readonly startDate: string;
  readonly regions: readonly RegionConfig[];
  /** 最先出现病例的地区 */
  readonly origin: number;
}

/** 攻方能强化的三个方向：传得更快、病得更重、更难被发现 */
export type Trait = 'transmission' | 'severity' | 'stealth';

/** 守方在一个地区里能采取的措施：封锁（切断进出、压低本地传播）、加强检测（看得更清楚） */
export type Measure = 'lockdown' | 'testing';

export type Command =
  | { readonly type: 'evolve'; readonly trait: Trait }
  | {
      readonly type: 'measure';
      readonly region: number;
      readonly measure: Measure;
      readonly on: boolean;
    };

export interface OutbreakState {
  tick: number;
  random: RandomState;
  /** 各地区的四个人群，都是整数人数 */
  susceptible: Float64Array;
  exposed: Float64Array;
  infectious: Float64Array;
  removed: Float64Array;
  /** 各地区累计死亡 */
  deaths: Float64Array;
  /** 各地区累计上报的病例：守方只看得到它 */
  reported: Float64Array;
  /** 各地区的措施，按位：1 封锁、2 加强检测 */
  measures: Uint8Array;
  /** 攻方三个方向各强化了几级 */
  traits: Record<Trait, number>;
  /** 攻方的点数（随新增感染增长）、守方的预算（随时间增长） */
  points: number;
  budget: number;
  readonly config: OutbreakConfig;
}

/** 一方能看到的部分 */
export interface OutbreakView {
  readonly tick: number;
  /** 这一步是哪天（'YYYY-MM-DD'）：过线程边界用文本，界面按语言格式化 */
  readonly date: string;
  /** 这一方是攻方（看得到真实感染）还是守方（只看得到上报） */
  readonly attacker: boolean;
  /** 各地区的“感染程度”（0–1）：攻方是真实的发病比例，守方是按上报估出来的 */
  readonly intensity: Float32Array;
  /** 各地区的措施（同 OutbreakState.measures），双方都看得到 */
  readonly measures: Uint8Array;
  readonly totals: {
    /** 攻方：当前真实的发病人数；守方：累计上报病例 */
    readonly cases: number;
    readonly deaths: number;
    readonly population: number;
    /** 已经出现病例（攻方：真实；守方：上报）的地区数 */
    readonly regions: number;
  };
  /** 这一方的资源：攻方的点数或守方的预算 */
  readonly resource: number;
  readonly traits: Readonly<Record<Trait, number>>;
}
