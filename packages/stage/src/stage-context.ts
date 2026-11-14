/**
 * 舞台里的组件和舞台之间的约定（舞台本身见 Stage.tsx）。
 * 弹出类的组件（对话框、提示）不靠浏览器的“顶层”：那一层画不进画布。它们把自己传送到舞台的某一层里，
 * 上下遮挡由层的先后决定，位置自己算。
 */
import type { UiMaterial } from '@rune-engine/render/ui-types';
import { inject, type InjectionKey, type ShallowRef } from 'vue';

/**
 * 舞台自带的几层，从下往上：
 *   world    跟着世界走的东西（地名、地图上的标记）
 *   hud      一直在的界面
 *   overlay  盖住画面的东西（对话框）
 *   tips     最上面的小东西（提示气泡）
 */
export const STAGE_LAYERS = ['world', 'hud', 'overlay', 'tips'] as const;
export type StageLayerName = (typeof STAGE_LAYERS)[number];

/** 舞台上的一层：改它的贴法、把它拿掉 */
export interface StageLayerHandle {
  set(material: Partial<UiMaterial>, durationMs?: number): void;
  remove(): void;
}

export interface StageContext {
  /** 舞台最外面的元素；舞台挂上之前是 null。自己加的层传送到它下面 */
  readonly root: ShallowRef<HTMLElement | null>;
  /** 登记自己加的一层（见 StageLayer.tsx）：element 是舞台下面一个铺满的元素，order 定上下 */
  addLayer(element: HTMLElement, order: number): StageLayerHandle;
  /** 这个浏览器能不能把界面画进画布：不能的话贴法、效果都不起作用（相关的设置项可以不给） */
  readonly supported: boolean;
  /** 界面现在是不是画在画布里（渲染线程的画面接上之后才是；之前、之后断了的时候都叠在画布上面） */
  readonly inCanvas: boolean;
  /** 各层的元素；舞台挂上之前是 null */
  readonly layers: Readonly<Record<StageLayerName, ShallowRef<HTMLElement | null>>>;
  /**
   * 改一层的贴法：透明度、位移缩放、效果（见 UiMaterial）。durationMs 大于 0 时过渡过去，
   * 过渡在渲染线程里跑。界面没画在画布里时什么都不做——所以只拿它做锦上添花的事。
   */
  material(layer: StageLayerName, material: Partial<UiMaterial>, durationMs?: number): void;
  /**
   * 一层“闪一下”：立刻变成 peak 的样子，再用 durationMs 毫秒回到它原来的贴法。
   * 比如出了坏消息 pulse('hud', { glitch: 1 }, 400)。系统设了“减少动态效果”时不闪
   */
  pulse(layer: StageLayerName, peak: Partial<UiMaterial>, durationMs: number): void;
  /** 一个模态的东西打开了：它下面的几层不再响应操作。返回“它关了”时要调的函数 */
  openModal(): () => void;
}

export const STAGE: InjectionKey<StageContext> = Symbol('stage');

/** 组件所在的舞台；不在舞台里是 undefined */
export const useStage = (): StageContext | undefined => inject(STAGE, undefined);
