/**
 * 舞台里的组件和舞台之间的约定（舞台本身见 Stage.tsx）。
 * 弹出类的组件（对话框、下拉、提示）不靠浏览器的“顶层”：那一层画不进画布。它们各自在舞台上占一层，
 * 上下遮挡由层的先后决定；模态、点外面关、Esc 这些由舞台的弹层宿主统一管（overlays.ts）。
 */
import type { UiMaterial } from '@rune-engine/render/ui-types';
import { inject, type InjectionKey, type ShallowRef } from 'vue';
import type { OverlayHost } from './overlays.ts';

/**
 * 舞台自带的几层和它们的次序（次序大的在上面）：
 *   world  跟着世界走的东西（地名、地图上的标记）
 *   hud    一直在的界面
 *   tips   最上面的小东西（提示气泡）
 * hud 和 tips 之间空着的地方是给弹层的：它们从 2 起按打开的先后往上排（见 overlays.ts 的 OVERLAY_ORDER）
 */
export const STAGE_LAYER_ORDER = { world: 0, hud: 1, tips: 3 } as const;
export type StageLayerName = keyof typeof STAGE_LAYER_ORDER;
export const STAGE_LAYERS = Object.keys(STAGE_LAYER_ORDER) as StageLayerName[];

/** 舞台上的一层：改它的贴法、挪它的位置、把它拿掉 */
export interface StageLayerHandle {
  set(material: Partial<UiMaterial>, durationMs?: number): void;
  /** 只有内容那么大的层：把左上角放到舞台上的 (x, y)（CSS 像素）。界面画在画布里时这不用重拍 */
  moveTo(x: number, y: number): void;
  /**
   * 把这一层当滚动层（见 StageScroll.tsx）：它的元素是整份内容，舞台上只露出 width×height 这么大的一块，
   * 左上角在 moveTo 说的地方
   */
  view(width: number, height: number): void;
  /** 滚动层滚到哪：露出来的那块的左上角在内容里的位置。smooth 时缓着滚过去（界面画在画布里时才缓） */
  scrollTo(x: number, y: number, smooth?: boolean): void;
  remove(): void;
}

export interface StageContext {
  /** 舞台最外面的元素；舞台挂上之前是 null。自己加的层传送到它下面 */
  readonly root: ShallowRef<HTMLElement | null>;
  /**
   * 登记自己加的一层（见 StageLayer.tsx）：element 是舞台下面的一个元素，order 定上下。
   * fill 是 false 时这一层只有内容那么大，位置用把手的 moveTo 说
   */
  addLayer(element: HTMLElement, order: number, options?: { fill?: boolean }): StageLayerHandle;
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
  /** 弹层的宿主：打开着的弹层在这里登记（一般经 StageLayer 的 overlay 属性，不直接用） */
  readonly overlays: OverlayHost;
}

export const STAGE: InjectionKey<StageContext> = Symbol('stage');

/** 组件所在的舞台；不在舞台里是 undefined */
export const useStage = (): StageContext | undefined => inject(STAGE, undefined);
