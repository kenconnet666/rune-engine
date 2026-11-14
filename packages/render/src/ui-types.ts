/**
 * 界面层的约定：主线程把一块块界面“拍”下来交给渲染线程，渲染线程把它们贴在画面上。
 * 用的是浏览器的 HTML-in-Canvas（Chrome 157 起）：界面还是普通的网页元素，照常排版、响应鼠标键盘、能被读屏念到，
 * 只是画到屏幕上的那一步改由我们来做——于是它能和地图在同一帧里合成，能过着色器，能做网页里做不了的过场。
 *
 * 界面层的元素挂在一张 2D 的画布下面（“界面画布”，透明地盖在画面上），这张画布归渲染线程：
 * 拍下来的界面只能画回它所在的那张画布，而只有 2D 的画布能只画其中一块（WebGPU 的画布只能整份画进一张纹理）。
 * 主线程只管拍（只是记下怎么画，很便宜），画成像素在渲染线程里做。
 *
 * 一层（layer）是界面画布里一个带 drawable 属性的元素，画成一张贴图。层按 order 从下往上叠。
 * 层可以和画布一样大（铺满的界面），也可以只有内容那么大、放在画布上的某个位置（一个气泡、一个下拉列表）：
 * 重拍一层的代价跟它的面积走，挪位置不用重拍。
 * 这个文件不碰显卡的类型，主线程那头（运行时的界面采集、组件库）也用它；和显卡有关的在 frame-layer.ts。
 */

/** 主线程拍下来的一块界面：可以转移给 Worker，画进纹理；用完要 close */
export interface ElementImage {
  close(): void;
}

/**
 * 一层怎么贴。位置的单位是 CSS 像素（和排版一个单位），变换都绕这一层自己的中心。
 * 改这些不用重新拍那块界面：只是贴法变了，所以每帧都改也不花主线程的时间。
 */
export interface UiMaterial {
  /** 不透明度，0–1 */
  readonly opacity: number;
  /** 平移 */
  readonly x: number;
  readonly y: number;
  /** 缩放（1 是原样）和旋转（弧度） */
  readonly scale: number;
  readonly rotate: number;
  /** 乘上去的颜色（预乘之前的 RGBA，各 0–1）：整层闪一下红、压暗 */
  readonly tint: readonly [number, number, number, number];
  // 下面三个是效果，各自一个数，可以叠在一起、各自过渡
  /** 全息屏的样子：扫描线、轻微的闪烁和偏色。0 是没有，1 是最重 */
  readonly scan: number;
  /** 横向错位加色散（出事了、信号不好）。0 是没有，1 是最重 */
  readonly glitch: number;
  /** 显现了多少：按噪声一块块出来，刚出来的边缘亮一下。0 是全没有，1 是全出来（原样）；进场、离场用 */
  readonly reveal: number;
}

export const PLAIN_MATERIAL: UiMaterial = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  tint: [1, 1, 1, 1],
  scan: 0,
  glitch: 0,
  reveal: 1,
};

/** 主线程 → 渲染线程 */
/**
 * 渲染线程 → 主线程：界面这条线上要回的话。使用方原样转给舞台（stage.receive）或者界面采集（receive）
 */
export type UiReport =
  /** 贴图都没了（刚接上显卡、设备重建了）：请把各层重新拍一遍 */
  | { readonly type: 'ui-request' }
  /**
   * 这几层新来的画面画上了。采集跟着它走：一层发出去的画面还没画上就先不拍下一张——
   * 渲染线程（显卡）一秒能画几张，界面里的动画就一秒更新几张，不多拍、也不用定死一个上限
   */
  | { readonly type: 'ui-drawn'; readonly layers: readonly number[] };

export type UiMessage =
  /** 界面画布交给渲染线程（只发一次，在所有画面之前） */
  | { readonly type: 'ui-canvas'; readonly canvas: OffscreenCanvas }
  /** 界面画布现在该有多少像素（设备像素；和它在页面上占的地方一样大） */
  | { readonly type: 'ui-resize'; readonly width: number; readonly height: number }
  /** 一层的新画面。width、height 是它的设备像素尺寸，pixelRatio 是一个 CSS 像素合几个设备像素 */
  | {
      readonly type: 'ui-image';
      readonly layer: number;
      readonly order: number;
      readonly image: ElementImage;
      readonly width: number;
      readonly height: number;
      readonly pixelRatio: number;
      /**
       * 这是一层**滚动层**：拍下来的是整份内容（可以很高），画面上只露出这么大的一块（CSS 像素），
       * 露出哪一块看 ui-scroll。渲染线程只把露出来的那块（和上下多备的几格）画成像素——滚动不用重拍，代价跟这一块的面积走
       */
      readonly view?: { readonly width: number; readonly height: number };
    }
  /** 一层的贴法：durationMs 大于 0 时从现在的样子过渡过去（在渲染线程里逐帧插值） */
  | {
      readonly type: 'ui-material';
      readonly layer: number;
      readonly material: UiMaterial;
      readonly durationMs: number;
    }
  /** 一层放在画布上的哪里：它的左上角（CSS 像素）。没说过就是 0,0（铺满的层） */
  | { readonly type: 'ui-place'; readonly layer: number; readonly x: number; readonly y: number }
  /**
   * 滚动层滚到哪：露出来的那块的左上角在内容里的位置（CSS 像素）。smooth 时渲染线程自己缓着滚过去
   * （主线程忙不忙都不影响），不然直接到
   */
  | {
      readonly type: 'ui-scroll';
      readonly layer: number;
      readonly x: number;
      readonly y: number;
      readonly smooth: boolean;
    }
  /** 一层现在没有画面（被藏起来了）：别再画它，贴法留着，等它的新画面 */
  | { readonly type: 'ui-clear'; readonly layer: number }
  | { readonly type: 'ui-remove'; readonly layer: number };
