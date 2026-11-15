/**
 * 自己画的界面的约定：主线程把界面排好版，每帧把“要画的东西”列成一张表（显示列表）交给渲染线程，渲染线程照着画。
 * 界面不是网页元素：节点树、排版、命中都是我们自己的（主线程那头是 view 包），所以它不依赖浏览器怎么排版、怎么画，
 * 只用到画布和 WebGPU。
 *
 * 显示列表是一个 Float32Array，一项占 VIEW_ITEM_FLOATS 个数，按**画的先后**排（后面的盖在前面的上面）。
 * 位置、大小的单位都是 CSS 像素（和排版一个单位），渲染线程乘上设备像素比、对齐到整像素。
 * 每一项带着自己的裁剪框（祖先里“超出不显示”的盒子交出来的那一块）：不用为裁剪打断批次，整张表一次画完。
 *
 * 文字不在表里：表里只有“第几号文字段”。一段文字（同一个字体、同一行里的一串字）整段交给浏览器的文字引擎
 * 画进一张图集（渲染线程里的 2D 画布），所以字距、中文、字体回退都是浏览器的；主线程只在一段文字头一回出现时
 * 把它的内容和字体告诉渲染线程一次（view-runs）。
 * 这个文件不碰显卡的类型，主线程那头也用它。
 */

/** 显示列表里一项占几个数 */
export const VIEW_ITEM_FLOATS = 20;

/**
 * 一项里各个数的位置。前 13 个两种东西一样：
 *   kind, x, y, width, height, clipLeft, clipTop, clipRight, clipBottom, r, g, b, a
 * 颜色是没预乘过的 RGBA（各 0–1），已经乘进了祖先的不透明度。后面的看 kind：
 *   矩形：radius（圆角）, borderWidth, 边线的 r, g, b, a
 *   文字：run（第几号文字段；颜色就是字的颜色，width、height 不用——段有多大渲染线程自己知道）
 */
export const VIEW_ITEM = {
  kind: 0,
  x: 1,
  y: 2,
  width: 3,
  height: 4,
  clipLeft: 5,
  clipTop: 6,
  clipRight: 7,
  clipBottom: 8,
  color: 9,
  radius: 13,
  borderWidth: 14,
  borderColor: 15,
  run: 13,
} as const;

export const VIEW_KIND_RECT = 0;
export const VIEW_KIND_TEXT = 1;

/** 一段文字用的字体 */
export interface ViewFont {
  /** 字体族，就是 CSS 里 font-family 的写法 */
  readonly family: string;
  /** 字号（CSS 像素） */
  readonly size: number;
  /** 字重：400、600，或者 'bold' 这样的词 */
  readonly weight: number | string;
  readonly italic: boolean;
}

/** 一段文字：一行里同一个字体的一串字。lineHeight 是这一行占多高（CSS 像素），字在里面竖着居中 */
export interface ViewRun {
  readonly id: number;
  readonly text: string;
  readonly font: ViewFont;
  readonly lineHeight: number;
}

/** 主线程 → 渲染线程 */
export type ViewMessage =
  /** 一个 CSS 像素合几个设备像素（变了的话图集里的字都要重画） */
  | { readonly type: 'view-scale'; readonly pixelRatio: number }
  /** 新出现的文字段（之后的显示列表里用 id 指它） */
  | { readonly type: 'view-runs'; readonly runs: readonly ViewRun[] }
  /** 这些文字段不会再用了：渲染线程可以忘掉 */
  | { readonly type: 'view-drop-runs'; readonly ids: readonly number[] }
  /** 这一帧要画的东西：items 里前 count 项有效（数组是转移过去的） */
  | { readonly type: 'view-frame'; readonly items: Float32Array; readonly count: number };

/** 把字体拼成 2D 画布认的写法；scale 是放大几倍（渲染线程按设备像素画） */
export const viewFontString = (font: ViewFont, scale = 1): string =>
  `${font.italic ? 'italic ' : ''}${font.weight} ${font.size * scale}px ${font.family}`;
