/**
 * 把排好版的节点树列成“这一帧要画的东西”（显示列表，约定见 render 包的 view-types.ts）。
 * 只列露出来的：裁剪框以外的子树整棵跳过，顺着一条线排的长列按位置二分——两万行的表格每帧只走露出来的几十行。
 *
 * 文字段在这里登记：同一个字体、同一行高、同样的字是同一段，只在头一回出现时把内容告诉渲染线程，之后表里只写它的号。
 * 登记得太多了（滚过的内容越来越多）就把这一帧没用到的清掉。
 */
import {
  VIEW_ITEM,
  VIEW_ITEM_FLOATS,
  VIEW_KIND_RECT,
  VIEW_KIND_TEXT,
  type ViewFont,
  type ViewRun,
} from '@rune-engine/render/view-types';
import { childRange } from './events.ts';
import type { ViewNode, ViewRunEntry, ViewTree } from './node.ts';
import { parseColor } from './style.ts';

export interface DisplayFrame {
  /** 显示列表，前 count 项有效。每帧是一个新数组（交给渲染线程时是转移过去的） */
  items: Float32Array;
  count: number;
  /** 这一帧头一回出现的文字段；不会再用、可以忘掉的文字段 */
  runs: ViewRun[];
  dropped: number[];
}

export interface DisplayBuilder {
  /** 把这棵树里落在 width×height 的视口里的东西列出来 */
  build(tree: ViewTree, width: number, height: number): DisplayFrame;
}

export interface DisplayBuilderOptions {
  /** 登记的文字段超过这么多就清一次（清掉这一帧没用到的），默认 8000 */
  runLimit?: number;
}

export function createDisplayBuilder({
  runLimit = 8000,
}: DisplayBuilderOptions = {}): DisplayBuilder {
  /** 字体 → “行高:内容” → 登记的那一段 */
  const table = new Map<ViewFont, Map<string, ViewRunEntry>>();
  let registered = 0;
  let nextId = 1;
  /** 清过几回：节点上记着的号是哪一回登记的，对不上就重新查 */
  let epoch = 0;
  let frame = 0;

  let items = new Float32Array(0);
  let count = 0;
  let fresh: ViewRun[] = [];

  /** 这个节点的那段字是几号：节点上记着的还作数就直接用，不然按“字体、行高、内容”去查，没有就登记 */
  function runOf(node: ViewNode): number {
    if (node.run && node.runEpoch === epoch) {
      node.run.usedAt = frame;
      return node.run.id;
    }
    const style = node.textStyle!;
    let byText = table.get(style.font);
    if (!byText) table.set(style.font, (byText = new Map()));
    const key = `${style.lineHeight}:${node.text}`;
    let entry = byText.get(key);
    if (!entry) {
      entry = { id: nextId++, usedAt: frame };
      byText.set(key, entry);
      registered++;
      fresh.push({ id: entry.id, text: node.text, font: style.font, lineHeight: style.lineHeight });
    }
    entry.usedAt = frame;
    node.run = entry;
    node.runEpoch = epoch;
    return entry.id;
  }

  /** 腾地方：这一帧没用到的都清掉 */
  function sweep(): number[] {
    const dropped: number[] = [];
    for (const byText of table.values()) {
      for (const [key, entry] of byText) {
        if (entry.usedAt === frame) continue;
        byText.delete(key);
        dropped.push(entry.id);
      }
    }
    registered -= dropped.length;
    epoch++;
    return dropped;
  }

  /** 再放一项的地方：不够就加倍 */
  function slot(): number {
    if ((count + 1) * VIEW_ITEM_FLOATS > items.length) {
      const grown = new Float32Array(Math.max(1024, count * 2) * VIEW_ITEM_FLOATS);
      grown.set(items.subarray(0, count * VIEW_ITEM_FLOATS));
      items = grown;
    }
    return count++ * VIEW_ITEM_FLOATS;
  }

  /**
   * 画一个节点和它的子孙。originX、originY 是它父节点的左上角在视口里的位置；
   * 后四个是到这里为止的裁剪框（视口里的坐标）；opacity 是祖先们乘下来的不透明度
   */
  function paint(
    node: ViewNode,
    originX: number,
    originY: number,
    clipLeft: number,
    clipTop: number,
    clipRight: number,
    clipBottom: number,
    opacity: number,
  ): void {
    const x = originX + node.x;
    const y = originY + node.y;
    // 自己整个在裁剪框外面：连子孙一起不画（溢出到盒子外面的子孙这时也看不到了——眼下认了）
    if (
      x >= clipRight ||
      y >= clipBottom ||
      x + node.width <= clipLeft ||
      y + node.height <= clipTop
    ) {
      return;
    }
    const style = node.look;
    const alpha = opacity * (style.opacity ?? 1);
    if (alpha <= 0) return;

    const border = style.borderWidth ?? 0;
    const hasBorder = border > 0 && style.borderColor !== undefined;
    if (style.backgroundColor !== undefined || hasBorder) {
      const at = slot();
      items[at + VIEW_ITEM.kind] = VIEW_KIND_RECT;
      items[at + VIEW_ITEM.x] = x;
      items[at + VIEW_ITEM.y] = y;
      items[at + VIEW_ITEM.width] = node.width;
      items[at + VIEW_ITEM.height] = node.height;
      items[at + VIEW_ITEM.clipLeft] = clipLeft;
      items[at + VIEW_ITEM.clipTop] = clipTop;
      items[at + VIEW_ITEM.clipRight] = clipRight;
      items[at + VIEW_ITEM.clipBottom] = clipBottom;
      const fill = style.backgroundColor === undefined ? NONE : parseColor(style.backgroundColor);
      items[at + VIEW_ITEM.color] = fill[0];
      items[at + VIEW_ITEM.color + 1] = fill[1];
      items[at + VIEW_ITEM.color + 2] = fill[2];
      items[at + VIEW_ITEM.color + 3] = fill[3] * alpha;
      items[at + VIEW_ITEM.radius] = style.borderRadius ?? 0;
      items[at + VIEW_ITEM.borderWidth] = hasBorder ? border : 0;
      if (hasBorder) {
        const edge = parseColor(style.borderColor!);
        items[at + VIEW_ITEM.borderColor] = edge[0];
        items[at + VIEW_ITEM.borderColor + 1] = edge[1];
        items[at + VIEW_ITEM.borderColor + 2] = edge[2];
        items[at + VIEW_ITEM.borderColor + 3] = edge[3] * alpha;
      }
    }

    if (node.type === 'text') {
      if (!node.text || !node.textStyle) return;
      const run = runOf(node);
      const color = node.textStyle.color;
      const at = slot();
      items[at + VIEW_ITEM.kind] = VIEW_KIND_TEXT;
      items[at + VIEW_ITEM.x] = x;
      items[at + VIEW_ITEM.y] = y;
      items[at + VIEW_ITEM.clipLeft] = clipLeft;
      items[at + VIEW_ITEM.clipTop] = clipTop;
      items[at + VIEW_ITEM.clipRight] = clipRight;
      items[at + VIEW_ITEM.clipBottom] = clipBottom;
      items[at + VIEW_ITEM.color] = color[0];
      items[at + VIEW_ITEM.color + 1] = color[1];
      items[at + VIEW_ITEM.color + 2] = color[2];
      items[at + VIEW_ITEM.color + 3] = color[3] * alpha;
      items[at + VIEW_ITEM.run] = run;
      return;
    }

    // 超出不显示的盒子：子孙只画在它（边线以内）的那一块里
    if (style.overflow === 'hidden' || style.overflow === 'scroll') {
      clipLeft = Math.max(clipLeft, x + border);
      clipTop = Math.max(clipTop, y + border);
      clipRight = Math.min(clipRight, x + node.width - border);
      clipBottom = Math.min(clipBottom, y + node.height - border);
      if (clipLeft >= clipRight || clipTop >= clipBottom) return;
    }
    const childX = x - node.scrollLeft;
    const childY = y - node.scrollTop;
    const { children } = node;
    const [from, to] =
      node.flowAxis === 'x'
        ? childRange(node, clipLeft - childX, clipRight - childX)
        : childRange(node, clipTop - childY, clipBottom - childY);
    for (let index = from; index < to; index++) {
      const child = children[index]!;
      if (child.type[0] === '#') continue;
      paint(child, childX, childY, clipLeft, clipTop, clipRight, clipBottom, alpha);
    }
  }

  return {
    build(tree, width, height) {
      frame++;
      // 上一帧的数组已经交出去了：这一帧新开一个，先按上一帧的项数估
      items = new Float32Array(Math.max(256, count + 64) * VIEW_ITEM_FLOATS);
      count = 0;
      fresh = [];
      paint(tree.root, 0, 0, 0, 0, width, height, 1);
      tree.needsPaint = false;
      const dropped = registered > runLimit ? sweep() : [];
      return { items, count, runs: fresh, dropped };
    },
  };
}

const NONE = [0, 0, 0, 0] as const;
