/**
 * 选中文字。画布上的字对浏览器来说只是像素，浏览器自带的拖选、复制认不出它们，所以选区是我们自己的：
 * 从哪段字的第几个字符（anchor，按下的地方）到哪段字的第几个字符（focus，现在指着的地方）。
 *
 * 这里是算的部分（不碰输入和画）：画布上的一个位置落在哪段字的哪个字符上、两个位置谁先谁后、
 * 选区里的字连起来是什么、一段字里被选中的是哪几截。拖选在 events.ts，底色在 display.ts，复制在 host.ts。
 * 之后做输入框时，光标落在哪、选区在哪用的也是这一套。
 */
import { childRange, type ViewNode, type ViewTree } from './node.ts';
import { caretStops, type TextLine } from './text.ts';

/** 文字里的一个位置：哪个 text 节点、它的字里第几个字符之前 */
export interface TextPoint {
  readonly node: ViewNode;
  readonly offset: number;
}

export interface ViewSelection {
  /** 按下的地方 */
  readonly anchor: TextPoint;
  /** 现在指着的地方（可以在 anchor 前面） */
  readonly focus: TextPoint;
}

/** 这段字能不能选：看它和祖先里最近写了 userSelect 的那个；都没写就是能选 */
export function selectable(node: ViewNode): boolean {
  for (let each: ViewNode | null = node; each; each = each.parent) {
    const value = each.look.userSelect;
    if (value !== undefined) return value !== 'none';
  }
  return true;
}

/** 从根到这个节点，每一层是第几个子节点 */
function pathOf(node: ViewNode): number[] {
  const path: number[] = [];
  for (let each = node; each.parent; each = each.parent) {
    path.push(each.parent.children.indexOf(each));
  }
  return path.reverse();
}

const comparePaths = (a: readonly number[], b: readonly number[]): number => {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) return a[index]! - b[index]!;
  }
  return a.length - b.length;
};

/** 选区按文档的先后排好：start 在前、end 在后，各带着它在树里的位置（画的时候拿来比） */
export interface OrderedSelection {
  readonly start: TextPoint;
  readonly end: TextPoint;
  readonly startPath: readonly number[];
  readonly endPath: readonly number[];
}

/** 选区排好先后；一个字都没选中（两头是同一个位置）、或者节点已经不在树上了，是 null */
export function orderSelection(
  tree: ViewTree,
  selection: ViewSelection | null,
): OrderedSelection | null {
  if (!selection) return null;
  const { anchor, focus } = selection;
  if (anchor.node === focus.node && anchor.offset === focus.offset) return null;
  if (!attached(tree, anchor.node) || !attached(tree, focus.node)) return null;
  const anchorPath = pathOf(anchor.node);
  const focusPath = pathOf(focus.node);
  const order = comparePaths(anchorPath, focusPath) || anchor.offset - focus.offset;
  return order <= 0
    ? { start: anchor, end: focus, startPath: anchorPath, endPath: focusPath }
    : { start: focus, end: anchor, startPath: focusPath, endPath: anchorPath };
}

const attached = (tree: ViewTree, node: ViewNode) => {
  let top = node;
  while (top.parent) top = top.parent;
  return top === tree.root;
};

/**
 * 树里位置是 path 的这段字，被选中的是它的第几个字符到第几个字符、选区是不是还接着往后面的字去；没被选中是 null。
 * 画的时候每段露出来的字问一次：path 是画到它时顺手记下的，不用再去数它是第几个子节点
 */
export function selectedRange(
  ordered: OrderedSelection,
  node: ViewNode,
  path: readonly number[],
  depth: number,
): [from: number, to: number, continues: boolean] | null {
  const afterStart =
    node === ordered.start.node ? 0 : comparePrefix(path, depth, ordered.startPath);
  const beforeEnd = node === ordered.end.node ? 0 : comparePrefix(path, depth, ordered.endPath);
  if (afterStart < 0 || beforeEnd > 0) return null;
  const from = node === ordered.start.node ? ordered.start.offset : 0;
  const to = node === ordered.end.node ? ordered.end.offset : node.text.length;
  return to > from ? [from, to, node !== ordered.end.node] : null;
}

/** path 的前 depth 项和 other 比先后 */
function comparePrefix(path: readonly number[], depth: number, other: readonly number[]): number {
  const length = Math.min(depth, other.length);
  for (let index = 0; index < length; index++) {
    if (path[index] !== other[index]) return path[index]! - other[index]!;
  }
  return depth - other.length;
}

/** 一行里第 offset 个字符（相对这一行的字）之前的位置离行首多远 */
export function offsetToX(node: ViewNode, line: TextLine, offset: number): number {
  const stops = caretStops(node.tree.measurer, node.textStyle!.font, line);
  const { offsets, positions } = stops;
  // 选区的两头都是从“能停的位置”来的，正好对得上；对不上（字变过）就取前面最近的一个
  let index = offsets.length - 1;
  while (index > 0 && offsets[index]! > offset) index--;
  return positions[index]!;
}

/** 每一行靠哪边带来的偏移 */
export function lineOffset(node: ViewNode, line: TextLine): number {
  const align = node.look.textAlign;
  return align === 'center'
    ? (node.width - line.width) / 2
    : align === 'right'
      ? node.width - line.width
      : 0;
}

/** 这段字里的 (x, y)（相对它的左上角）落在第几个字符之前：先看在哪一行，再找离得最近的能停的位置 */
export function offsetAt(node: ViewNode, x: number, y: number): number {
  const { lines, textStyle } = node;
  if (!textStyle || lines.length === 0) return 0;
  const index = Math.max(0, Math.min(lines.length - 1, Math.floor(y / textStyle.lineHeight)));
  const line = lines[index]!;
  const { offsets, positions } = caretStops(node.tree.measurer, textStyle.font, line);
  const local = x - lineOffset(node, line);
  let best = 0;
  for (let stop = 1; stop < positions.length; stop++) {
    if (Math.abs(positions[stop]! - local) <= Math.abs(positions[best]! - local)) best = stop;
  }
  // 末尾截短加了省略号的行：省略号不是原文，停在它前面
  return line.start + Math.min(offsets[best]!, line.end - line.start);
}

/**
 * 画布上的 (x, y) 对着哪段字的哪个位置。正落在一段字上就是它；落在空白处，找离得最近的一段
 * （拖着选的时候指针常常在行与行之间、在格子的空白里）。附近没有能选的字是 null
 */
export function pointAt(tree: ViewTree, x: number, y: number): TextPoint | null {
  return locate(tree.root, x, y);
}

/** x、y 是相对 node 的父节点左上角的 */
function locate(node: ViewNode, x: number, y: number): TextPoint | null {
  if (node.look.userSelect === 'none') return null;
  const localX = x - node.x;
  const localY = y - node.y;
  if (node.type === 'text') {
    return selectable(node) ? { node, offset: offsetAt(node, localX, localY) } : null;
  }
  const childX = localX + node.scrollLeft;
  const childY = localY + node.scrollTop;
  const { children, flowAxis } = node;
  // 顺着一条线排的长列：只看这个位置前后的几个
  const at = flowAxis === 'x' ? childX : childY;
  const [from, to] = childRange(node, at, at + 1e-6);
  const candidates: { child: ViewNode; distance: number }[] = [];
  for (let index = Math.max(0, from - 1); index < Math.min(children.length, to + 1); index++) {
    const child = children[index]!;
    if (child.type[0] === '#') continue;
    const dx = Math.max(child.x - childX, 0, childX - (child.x + child.width));
    const dy = Math.max(child.y - childY, 0, childY - (child.y + child.height));
    // 先看竖直方向离得近不近（同一行的优先），再看水平
    candidates.push({ child, distance: dy * 1e4 + dx });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  for (const { child } of candidates) {
    const found = locate(child, childX, childY);
    if (found) return found;
  }
  return null;
}

const words = new Intl.Segmenter(undefined, { granularity: 'word' });

/** 这个位置所在的那个词（双击选中的范围） */
export function wordAt(point: TextPoint): ViewSelection {
  const { node, offset } = point;
  for (const { segment, index } of words.segment(node.text)) {
    if (offset >= index && offset <= index + segment.length && segment.trim()) {
      return { anchor: { node, offset: index }, focus: { node, offset: index + segment.length } };
    }
  }
  return { anchor: point, focus: point };
}

/** 这个位置所在的整段字（三击选中的范围） */
export const blockAt = ({ node }: TextPoint): ViewSelection => ({
  anchor: { node, offset: 0 },
  focus: { node, offset: node.text.length },
});

/** 整棵树里所有能选的字（Ctrl+A）；一段字都没有是 null */
export function selectAll(tree: ViewTree): ViewSelection | null {
  let first: ViewNode | undefined;
  let last: ViewNode | undefined;
  walk(tree.root, (node) => {
    first ??= node;
    last = node;
  });
  return first && last
    ? { anchor: { node: first, offset: 0 }, focus: { node: last, offset: last.text.length } }
    : null;
}

/** 按文档的先后走一遍所有能选的 text 节点 */
function walk(node: ViewNode, visit: (text: ViewNode) => void): void {
  if (node.look.userSelect === 'none') return;
  if (node.type === 'text') {
    if (selectable(node)) visit(node);
    return;
  }
  for (const child of node.children) if (child.type[0] !== '#') walk(child, visit);
}

/**
 * 选区里的字连起来。两段字之间放什么：它们最近的共同祖先是横着排的（同一行里的两个格子）放制表符，
 * 不然放换行——所以选了几行表格贴到表格软件里，列是对得上的
 */
export function selectedText(tree: ViewTree, selection: ViewSelection | null): string {
  const ordered = orderSelection(tree, selection);
  if (!ordered) return '';
  let text = '';
  let previous: ViewNode | undefined;
  let inside = false;
  let done = false;
  walk(tree.root, (node) => {
    if (done) return;
    if (node === ordered.start.node) inside = true;
    if (!inside) return;
    const from = node === ordered.start.node ? ordered.start.offset : 0;
    const to = node === ordered.end.node ? ordered.end.offset : node.text.length;
    if (previous) text += separator(previous, node);
    text += node.text.slice(from, to);
    previous = node;
    if (node === ordered.end.node) done = true;
  });
  return text;
}

function separator(a: ViewNode, b: ViewNode): string {
  const ancestors = new Set<ViewNode>();
  for (let each: ViewNode | null = a.parent; each; each = each.parent) ancestors.add(each);
  for (let each: ViewNode | null = b.parent; each; each = each.parent) {
    if (ancestors.has(each)) return each.flowAxis === 'x' ? '\t' : '\n';
  }
  return '\n';
}
