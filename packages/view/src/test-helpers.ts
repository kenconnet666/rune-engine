/** 测试里手搭节点树用的小工具（不经过 Vue） */
import { layoutTree } from './layout.ts';
import { ViewNode, ViewTree } from './node.ts';
import type { ViewStyle } from './style.ts';
import type { TextMeasurer } from './text.ts';

/** 每个字 7 像素宽的假量法（测试里没有画布）；calls 记着量过哪些字 */
export function fixedMeasurer(): TextMeasurer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    width(_font, text) {
      calls.push(text);
      return text.length * 7;
    },
  };
}

export function createTestTree(): { tree: ViewTree; measurer: ReturnType<typeof fixedMeasurer> } {
  const measurer = fixedMeasurer();
  return { tree: new ViewTree(measurer), measurer };
}

/** 一个盒子 */
export function box(tree: ViewTree, style: ViewStyle = {}, children: ViewNode[] = []): ViewNode {
  const node = new ViewNode('view', tree);
  node.style = style;
  node.look = style;
  for (const child of children) append(node, child);
  return node;
}

/** 一行字 */
export function label(tree: ViewTree, text: string, style: ViewStyle = {}): ViewNode {
  const node = new ViewNode('text', tree);
  node.style = style;
  node.look = style;
  const content = new ViewNode('#text', tree);
  content.text = text;
  append(node, content);
  return node;
}

export function append(parent: ViewNode, child: ViewNode): void {
  child.parent = parent;
  parent.children.push(child);
  parent.tree.invalidateLayout(parent);
}

/** 把几个节点挂到根上、按 width×height 的视口排一遍 */
export function arrange(tree: ViewTree, children: ViewNode[], width = 400, height = 300): void {
  for (const child of children) append(tree.root, child);
  layoutTree(tree, width, height);
}

/** 一个节点的 [x, y, width, height] */
export const rect = (node: ViewNode) => [node.x, node.y, node.width, node.height];
