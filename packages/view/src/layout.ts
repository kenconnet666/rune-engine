/**
 * 排版：给每个节点算出位置和大小。弹性盒子的一小套——横排 / 竖排（不换行）、定宽定高、按份数伸缩、
 * 内外边距、间隔、交叉轴对齐、主轴对齐；一段字（text）宽度定了就在里面折行，没定就一行到底。
 *
 * 只重排变了的：一个节点自己和子孙都没变（layoutDirty 是 false）、父节点给的大小和传下来的文字样式也和上回一样，
 * 就整棵子树跳过。所以改一个格子的字，重排的只有它到根的那一条线上的节点。
 */
import type { ViewNode, ViewTree } from './node.ts';
import { breakLines } from './text.ts';
import {
  DEFAULT_TEXT,
  inheritText,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  paddingBottom,
  paddingLeft,
  paddingRight,
  paddingTop,
  type TextStyle,
  type ViewStyle,
} from './style.ts';

/** 整棵树排一遍：根节点就是整个视口那么大 */
export function layoutTree(tree: ViewTree, width: number, height: number): void {
  resized.length = 0;
  layoutNode(tree.root, width, height, DEFAULT_TEXT);
  tree.root.x = 0;
  tree.root.y = 0;
  tree.needsLayout = false;
  // 排完了再告诉使用方哪些盒子的大小变了：处理函数里改了东西也不会搅进正在排的这一趟
  for (const node of resized.splice(0)) {
    (node.props!.onLayout as (node: ViewNode) => void)(node);
  }
}

/** 这一趟里大小（或者内容的大小）变了、又写了 onLayout 的节点 */
const resized: ViewNode[] = [];

const clamp = (value: number, min: number | undefined, max: number | undefined) =>
  Math.max(min ?? 0, max === undefined ? value : Math.min(max, value));

/** 参与排版的子节点（Vue 的文字节点、注释节点不算） */
const isElement = (node: ViewNode) => node.type === 'view' || node.type === 'text';
/** 排着队的子节点：绝对定位的不排队 */
const isBox = (node: ViewNode) => isElement(node) && node.look.position !== 'absolute';

/**
 * 排一个节点。width、height 是父节点定下来的大小（含内边距和边线）；没定（undefined）就由内容撑出来。
 * 排完 node.width / height 和它子孙的位置都是新的；它自己的 x、y 由父节点来放。
 */
function layoutNode(
  node: ViewNode,
  width: number | undefined,
  height: number | undefined,
  inherited: TextStyle,
): void {
  if (
    !node.layoutDirty &&
    node.givenWidth === width &&
    node.givenHeight === height &&
    node.textIn === inherited
  ) {
    return;
  }
  const style = node.look;
  // 往下传的文字样式：传进来的和自己的样式都没变就还是上回那一份（同一个对象，子孙才认得出“没变”）
  let text = node.textOut;
  if (!text || node.textIn !== inherited || node.textLook !== style) {
    text = inheritText(inherited, style);
    node.textOut = text;
    node.textLook = style;
  }
  node.textIn = inherited;
  node.givenWidth = width;
  node.givenHeight = height;
  node.layoutDirty = false;

  if (node.type === 'text') {
    node.text = node.textContent;
    node.textStyle = text;
    // 宽度定了（父节点给的、自己写的）就在这个宽度里折行；没定就一行到底，宽度是最宽的那一行
    const limit = width ?? style.width;
    node.lines = breakLines(node.tree.measurer, text.font, node.text, {
      maxWidth: limit,
      whiteSpace: style.whiteSpace,
      maxLines: style.maxLines,
      ellipsis: style.textOverflow === 'ellipsis',
    });
    let widest = 0;
    for (const each of node.lines) widest = Math.max(widest, each.width);
    node.width = clamp(limit ?? widest, style.minWidth, style.maxWidth);
    node.height = clamp(
      height ?? style.height ?? node.lines.length * text.lineHeight,
      style.minHeight,
      style.maxHeight,
    );
    node.contentWidth = Math.max(node.width, widest);
    node.contentHeight = node.lines.length * text.lineHeight;
    return;
  }
  const before = node.props?.onLayout
    ? [node.width, node.height, node.contentWidth, node.contentHeight]
    : undefined;
  layoutContainer(node, style, width, height, text);
  if (
    before &&
    (before[0] !== node.width ||
      before[1] !== node.height ||
      before[2] !== node.contentWidth ||
      before[3] !== node.contentHeight)
  ) {
    resized.push(node);
  }
}

function layoutContainer(
  node: ViewNode,
  style: ViewStyle,
  width: number | undefined,
  height: number | undefined,
  text: TextStyle,
): void {
  const row = style.flexDirection === 'row';
  const border = style.borderWidth ?? 0;
  const insetLeft = paddingLeft(style) + border;
  const insetRight = paddingRight(style) + border;
  const insetTop = paddingTop(style) + border;
  const insetBottom = paddingBottom(style) + border;
  const innerWidth = width === undefined ? undefined : Math.max(0, width - insetLeft - insetRight);
  const innerHeight =
    height === undefined ? undefined : Math.max(0, height - insetTop - insetBottom);
  const mainSpace = row ? innerWidth : innerHeight;
  const crossSpace = row ? innerHeight : innerWidth;
  const gap = style.gap ?? 0;
  const { children } = node;

  // —— 头一趟：每个子节点在主轴上原来想占多大
  const bases: number[] = [];
  /** 这个子节点已经按“主轴不定”排过了（内容定大小的），第二趟大小没变就不用再排 */
  const measured: boolean[] = [];
  let used = 0;
  let grow = 0;
  let shrink = 0;
  let count = 0;
  for (const child of children) {
    if (!isBox(child)) continue;
    const look = child.look;
    let basis = look.flexBasis ?? (look.flex === undefined ? (row ? look.width : look.height) : 0);
    const natural = basis === undefined;
    if (natural) {
      const cross = crossGiven(look, style, row, crossSpace);
      layoutNode(child, row ? undefined : cross, row ? cross : undefined, text);
      basis = row ? child.width : child.height;
    }
    bases.push(basis!);
    measured.push(natural);
    used += basis! + mainMargins(look, row);
    grow += growOf(look);
    shrink += shrinkOf(look) * basis!;
    count++;
  }
  if (count > 1) used += gap * (count - 1);

  // —— 第二趟：空出来的分掉（或者放不下的缩掉），定下主轴的大小，排好每个子节点
  const free = mainSpace === undefined ? 0 : mainSpace - used;
  let index = 0;
  let cross = 0;
  let taken = 0;
  for (const child of children) {
    if (!isBox(child)) continue;
    const look = child.look;
    const basis = bases[index]!;
    let main = basis;
    if (free > 0 && grow > 0) main += (free * growOf(look)) / grow;
    else if (free < 0 && shrink > 0) main += (free * shrinkOf(look) * basis) / shrink;
    main = row
      ? clamp(main, look.minWidth, look.maxWidth)
      : clamp(main, look.minHeight, look.maxHeight);
    if (!measured[index] || main !== basis) {
      const given = crossGiven(look, style, row, crossSpace);
      layoutNode(child, row ? main : given, row ? given : main, text);
    }
    taken += main + mainMargins(look, row);
    cross = Math.max(cross, (row ? child.height : child.width) + crossMargins(look, row));
    index++;
  }
  if (count > 1) taken += gap * (count - 1);

  // —— 自己的大小：定了的用定的，没定的由内容撑
  const mainSize = mainSpace ?? taken;
  const crossSize = crossSpace ?? cross;
  node.width = clamp(
    width ?? (row ? mainSize : crossSize) + insetLeft + insetRight,
    style.minWidth,
    style.maxWidth,
  );
  node.height = clamp(
    height ?? (row ? crossSize : mainSize) + insetTop + insetBottom,
    style.minHeight,
    style.maxHeight,
  );
  const mainInner = row
    ? node.width - insetLeft - insetRight
    : node.height - insetTop - insetBottom;
  const crossInner = row
    ? node.height - insetTop - insetBottom
    : node.width - insetLeft - insetRight;

  // —— 第三趟：放位置
  const left = Math.max(0, mainInner - taken);
  const justify = style.justifyContent ?? 'flex-start';
  let at = justify === 'center' ? left / 2 : justify === 'flex-end' ? left : 0;
  const between = justify === 'space-between' && count > 1 ? left / (count - 1) : 0;
  for (const child of children) {
    if (!isBox(child)) {
      // Vue 的占位节点（文字、注释）不占地方，但位置跟着排：按位置二分找子节点时整列才是递增的
      if (!isElement(child)) {
        if (row) child.x = insetLeft + at;
        else child.y = insetTop + at;
      }
      continue;
    }
    const look = child.look;
    const align = look.alignSelf ?? style.alignItems ?? 'stretch';
    const size = row ? child.height : child.width;
    const room = crossInner - size - crossMargins(look, row);
    const offset = align === 'center' ? room / 2 : align === 'flex-end' ? room : 0;
    if (row) {
      child.x = insetLeft + at + marginLeft(look);
      child.y = insetTop + offset + marginTop(look);
      at += child.width;
    } else {
      child.x = insetLeft + offset + marginLeft(look);
      child.y = insetTop + at + marginTop(look);
      at += child.height;
    }
    at += mainMargins(look, row) + gap + between;
  }
  // —— 绝对定位的子节点：自己的大小定下来之后，贴着（边线以内的）边放
  let floating = false;
  for (const child of children) {
    if (!isElement(child) || child.look.position !== 'absolute') continue;
    floating = true;
    const { left, top, right, bottom } = child.look;
    const span = (near: number | undefined, far: number | undefined, size: number) =>
      near !== undefined && far !== undefined
        ? Math.max(0, size - border * 2 - near - far)
        : undefined;
    layoutNode(
      child,
      child.look.width ?? span(left, right, node.width),
      child.look.height ?? span(top, bottom, node.height),
      text,
    );
    child.x =
      left !== undefined
        ? border + left
        : right !== undefined
          ? node.width - border - right - child.width
          : insetLeft;
    child.y =
      top !== undefined
        ? border + top
        : bottom !== undefined
          ? node.height - border - bottom - child.height
          : insetTop;
  }
  // 有绝对定位的子节点时位置不再是递增的，找子节点不能二分
  node.flowAxis = floating ? null : row ? 'x' : 'y';
  node.contentWidth = (row ? taken : cross) + insetLeft + insetRight;
  node.contentHeight = (row ? cross : taken) + insetTop + insetBottom;
  // 内容变短了：滚过头的收回来
  node.scrollTop = Math.min(node.scrollTop, node.maxScrollTop);
  node.scrollLeft = Math.min(node.scrollLeft, node.maxScrollLeft);
}

/** 子节点在交叉轴上该有多大：自己写了就用自己的；没写、又是“撑满”、容器那一边定了大小，就撑满；不然由内容定 */
function crossGiven(
  look: ViewStyle,
  container: ViewStyle,
  row: boolean,
  crossSpace: number | undefined,
): number | undefined {
  const own = row ? look.height : look.width;
  if (own !== undefined) return own;
  if (crossSpace === undefined) return undefined;
  const align = look.alignSelf ?? container.alignItems ?? 'stretch';
  return align === 'stretch' ? Math.max(0, crossSpace - crossMargins(look, row)) : undefined;
}

/** 伸、缩各几份（flex 简写的意思见 style.ts） */
const growOf = (look: ViewStyle) => look.flexGrow ?? look.flex ?? 0;
const shrinkOf = (look: ViewStyle) => look.flexShrink ?? (look.flex === undefined ? 0 : 1);

const mainMargins = (look: ViewStyle, row: boolean) =>
  row ? marginLeft(look) + marginRight(look) : marginTop(look) + marginBottom(look);
const crossMargins = (look: ViewStyle, row: boolean) =>
  row ? marginTop(look) + marginBottom(look) : marginLeft(look) + marginRight(look);
