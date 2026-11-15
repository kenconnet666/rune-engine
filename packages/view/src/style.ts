/**
 * 节点的样式。名字照着 CSS 起（之后给组件库做同一套接口的样式后端时一一对上），现在只有其中一小部分：
 * 弹性盒子的横排 / 竖排、定宽定高、内外边距、底色、圆角、边线、不透明度、文字。
 * 和 CSS 不一样、要知道的：
 *   - 每个盒子都是弹性容器，默认**竖着排**（flexDirection: 'column'）、子节点横向撑满；
 *   - flexShrink 默认是 0（放不下就溢出去，不会自己缩）；
 *   - 长度只有像素（数字）；lineHeight 也是像素，不是倍数；
 *   - 怎么折行、靠哪边（whiteSpace、textAlign……）写在那段字自己身上，不从父节点传下来。
 */
import type { ViewFont } from '@rune-engine/render/view-types';

export interface ViewStyle {
  // —— 排版
  flexDirection?: 'row' | 'column';
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /**
   * 简写，和 CSS 的 flex: n 一个意思：空出来的地方分 n 份给它、放不下时可以缩、原来的大小按 0 算——
   * “占满剩下的地方”就写 flex: 1。下面三个单独写了的以单独写的为准
   */
  flex?: number;
  /** 主轴上空出来的地方分几份给它 */
  flexGrow?: number;
  /** 主轴上放不下时缩几份（按它原来的大小加权） */
  flexShrink?: number;
  /** 主轴上原来想占多大；没写就看 width / height，再没有就看内容 */
  flexBasis?: number;
  /** 子节点在交叉轴上怎么放，默认 stretch（撑满） */
  alignItems?: ViewAlign;
  alignSelf?: ViewAlign;
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  /** 相邻两个子节点之间空多少 */
  gap?: number;
  padding?: number;
  paddingInline?: number;
  paddingBlock?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  margin?: number;
  marginInline?: number;
  marginBlock?: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  /** 超出盒子的内容：照常显示（默认）、不显示、不显示但可以滚 */
  overflow?: 'visible' | 'hidden' | 'scroll';

  // —— 画法
  backgroundColor?: string;
  borderRadius?: number;
  /** 边线占排版的地方（内容在边线里面） */
  borderWidth?: number;
  borderColor?: string;
  /** 连同子节点一起变淡 */
  opacity?: number;

  // —— 文字（往下传给子节点）
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  /** 一行占多高（像素）；没写是字号的 1.4 倍 */
  lineHeight?: number;

  // —— 一段字怎么排（写在 text 上，不往下传）
  /** normal（默认）：放不下就折行；nowrap：一行到底；pre：只在换行符处断（代码） */
  whiteSpace?: 'normal' | 'nowrap' | 'pre';
  /** 每一行在这段字的宽度里靠哪边 */
  textAlign?: 'left' | 'center' | 'right';
  /** 最多几行，多出来的不显示 */
  maxLines?: number;
  /** 被截掉了的话最后一行末尾放省略号（不折行的一行放不下、或者超过了 maxLines） */
  textOverflow?: 'clip' | 'ellipsis';

  // —— 交互
  /** 指针在它上面时的光标（CSS 的 cursor） */
  cursor?: string;
  /** 里面的字能不能被选中（拖选、复制）：默认能；写了 none 的连同子孙都不能，子孙里再写 text 的又能 */
  userSelect?: 'text' | 'none';
  /** 自己不接指针（点到的是它下面的东西）；子节点不受影响 */
  pointerEvents?: 'auto' | 'none';
  /** 指针在它上面、按着它的时候另外加的样式 */
  hover?: ViewStyle;
  active?: ViewStyle;
}

export type ViewAlign = 'stretch' | 'flex-start' | 'center' | 'flex-end';

/** 没写样式的节点共用的那一份 */
export const NO_STYLE: ViewStyle = Object.freeze({});

/** 往下传的文字样式：算好的，子节点没另写就原样用父节点的这一份（同一个对象） */
export interface TextStyle {
  readonly font: ViewFont;
  readonly lineHeight: number;
  /** 没预乘的 RGBA，各 0–1 */
  readonly color: Rgba;
}

export type Rgba = readonly [number, number, number, number];

/** 没写 lineHeight 时一行有多高：字号的 1.4 倍，取整 */
const lineHeightOf = (fontSize: number) => Math.round(fontSize * 1.4);

const fonts = new Map<string, ViewFont>();
/** 同样的字体只有一个对象：量文字、登记文字段都按对象认字体，不用每次拼字符串比 */
function fontOf(family: string, size: number, weight: number | string, italic: boolean): ViewFont {
  const key = `${italic ? 'i' : 'n'}|${weight}|${size}|${family}`;
  let font = fonts.get(key);
  if (!font) fonts.set(key, (font = { family, size, weight, italic }));
  return font;
}

export const DEFAULT_TEXT: TextStyle = {
  font: fontOf('system-ui, sans-serif', 14, 400, false),
  lineHeight: lineHeightOf(14),
  color: [0, 0, 0, 1],
};

/** 这个节点往下传的文字样式：自己没写文字相关的就是父节点传来的那一份 */
export function inheritText(parent: TextStyle, style: ViewStyle): TextStyle {
  const { color, fontFamily, fontSize, fontWeight, fontStyle, lineHeight } = style;
  if (
    color === undefined &&
    fontFamily === undefined &&
    fontSize === undefined &&
    fontWeight === undefined &&
    fontStyle === undefined &&
    lineHeight === undefined
  ) {
    return parent;
  }
  const size = fontSize ?? parent.font.size;
  return {
    font: fontOf(
      fontFamily ?? parent.font.family,
      size,
      fontWeight ?? parent.font.weight,
      fontStyle === undefined ? parent.font.italic : fontStyle === 'italic',
    ),
    // 换了字号没写行高：行高跟着新字号走
    lineHeight: lineHeight ?? (fontSize === undefined ? parent.lineHeight : lineHeightOf(size)),
    color: color === undefined ? parent.color : parseColor(color),
  };
}

const TRANSPARENT: Rgba = [0, 0, 0, 0];
const colors = new Map<string, Rgba>([['transparent', TRANSPARENT]]);

/**
 * 认 #rgb、#rgba、#rrggbb、#rrggbbaa、rgb() / rgba()（逗号或空格隔开，透明度可以写百分比）和 transparent。
 * 认不出来的当成透明（并且记住，不会每帧再认一遍）
 */
export function parseColor(value: string): Rgba {
  let color = colors.get(value);
  if (color) return color;
  color = TRANSPARENT;
  if (value[0] === '#') {
    const hex = value.slice(1);
    const wide = hex.length === 6 || hex.length === 8;
    if (/^[0-9a-f]+$/i.test(hex) && (wide || hex.length === 3 || hex.length === 4)) {
      const channel = (index: number) =>
        wide
          ? parseInt(hex.slice(index * 2, index * 2 + 2), 16) / 255
          : parseInt(hex[index]! + hex[index]!, 16) / 255;
      color = [channel(0), channel(1), channel(2), hex.length % 4 === 0 ? channel(3) : 1];
    }
  } else {
    const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
    const parts = match?.[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts && (parts.length === 3 || parts.length === 4)) {
      const alpha = parts[3];
      color = [
        Number(parts[0]) / 255,
        Number(parts[1]) / 255,
        Number(parts[2]) / 255,
        alpha === undefined ? 1 : alpha.endsWith('%') ? parseFloat(alpha) / 100 : Number(alpha),
      ];
    }
  }
  colors.set(value, color);
  return color;
}

/** 四边的内边距、外边距（没写的那一边看 Inline / Block，再看四边一起的那个） */
export const paddingLeft = (s: ViewStyle) => s.paddingLeft ?? s.paddingInline ?? s.padding ?? 0;
export const paddingRight = (s: ViewStyle) => s.paddingRight ?? s.paddingInline ?? s.padding ?? 0;
export const paddingTop = (s: ViewStyle) => s.paddingTop ?? s.paddingBlock ?? s.padding ?? 0;
export const paddingBottom = (s: ViewStyle) => s.paddingBottom ?? s.paddingBlock ?? s.padding ?? 0;
export const marginLeft = (s: ViewStyle) => s.marginLeft ?? s.marginInline ?? s.margin ?? 0;
export const marginRight = (s: ViewStyle) => s.marginRight ?? s.marginInline ?? s.margin ?? 0;
export const marginTop = (s: ViewStyle) => s.marginTop ?? s.marginBlock ?? s.margin ?? 0;
export const marginBottom = (s: ViewStyle) => s.marginBottom ?? s.marginBlock ?? s.margin ?? 0;

/** 只影响怎么画、不影响排版的那几样：只有它们变了的话不用重排 */
const PAINT_ONLY = new Set<string>([
  'userSelect',
  'textAlign',
  'backgroundColor',
  'borderRadius',
  'borderColor',
  'opacity',
  'cursor',
  'pointerEvents',
  'hover',
  'active',
]);

/** 从 before 换成 after，排版会不会变（文字的颜色也算：它是在排版那一趟里往下传的） */
export function affectsLayout(before: ViewStyle, after: ViewStyle): boolean {
  if (before === after) return false;
  for (const key in after) {
    if (PAINT_ONLY.has(key)) continue;
    if (after[key as keyof ViewStyle] !== before[key as keyof ViewStyle]) return true;
  }
  for (const key in before) {
    if (!PAINT_ONLY.has(key) && !(key in after)) return true;
  }
  return false;
}
