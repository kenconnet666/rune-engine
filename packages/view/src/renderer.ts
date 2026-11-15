/**
 * 把 Vue 接到节点树上：组件照常写（响应式、组件、插槽都是 Vue 的），只是最后落到的不是网页元素，是我们的节点。
 * 用的是 Vue 自带的自定义渲染器接口（createRenderer）：它只要我们说清楚“怎么建一个节点、怎么插、怎么删、怎么改属性”。
 *
 * 元素只有两种：view（盒子）和 text（一行字）。写 TSX 时用这里导出的 View、Text——
 * 它们就是这两个名字（不是组件，不多一层），只是带上了属性的类型。
 */
import { createRenderer, type App, type Component, type VNode, type VNodeChild } from 'vue';
import type { ViewPointerEvent, ViewWheelEvent } from './events.ts';
import { ViewNode, type ViewNodeType, type ViewTree } from './node.ts';
import { affectsLayout, NO_STYLE, type ViewStyle } from './style.ts';

export interface ViewProps {
  style?: ViewStyle;
  onClick?: (event: ViewPointerEvent) => void;
  onPointerdown?: (event: ViewPointerEvent) => void;
  onPointerup?: (event: ViewPointerEvent) => void;
  onPointermove?: (event: ViewPointerEvent) => void;
  /** 指针进来、出去：不往上冒，进到子节点里不算出去 */
  onPointerenter?: (event: ViewPointerEvent) => void;
  onPointerleave?: (event: ViewPointerEvent) => void;
  onWheel?: (event: ViewWheelEvent) => void;
  /** 排版之后这个盒子的大小、或者它里面内容的大小变了（滚动条据此知道该多长） */
  onLayout?: (node: ViewNode) => void;
  /** 这个盒子滚了（滚轮、scrollTo）：从节点上读 scrollTop、maxScrollTop */
  onScroll?: (node: ViewNode) => void;
  children?: VNodeChild;
}

/** 写 TSX 时当标签用的样子（运行时它就是元素的名字，不是函数）。要拿到节点用 Vue 的 ref：ref={(node) => …} */
type Element = (props: ViewProps) => VNode;
/** 盒子：放别的节点，可以有底色、边线、圆角 */
export const View = 'view' as unknown as Element;
/** 一行字：里面只放文字 */
export const Text = 'text' as unknown as Element;

const detach = (child: ViewNode) => {
  const siblings = child.parent?.children;
  if (!siblings) return;
  siblings.splice(siblings.indexOf(child), 1);
  child.parent = null;
};

/** 在这棵树上起一个 Vue 应用：返回的 app 用 mount(tree.root) 挂上去 */
export function createViewApp(
  tree: ViewTree,
  root: Component,
  props?: Record<string, unknown>,
): App<ViewNode> {
  const { createApp } = createRenderer<ViewNode, ViewNode>({
    createElement: (type) => new ViewNode(type as ViewNodeType, tree),
    createText(text) {
      const node = new ViewNode('#text', tree);
      node.text = text;
      return node;
    },
    createComment: () => new ViewNode('#comment', tree),
    insert(child, parent, anchor) {
      detach(child);
      child.parent = parent;
      const { children } = parent;
      if (anchor) children.splice(children.indexOf(anchor), 0, child);
      else children.push(child);
      tree.invalidateLayout(parent);
    },
    remove(child) {
      const { parent } = child;
      detach(child);
      tree.invalidateLayout(parent);
    },
    patchProp(node, key, _before, next) {
      if (key !== 'style') {
        (node.props ??= {})[key] = next;
        return;
      }
      node.style = (next as ViewStyle | null | undefined) ?? NO_STYLE;
      const before = node.look;
      node.look = node.style;
      // 正被指着、按着的节点：把 hover / active 叠回去（restyle 里会比出要不要重排）
      if (node.hovered || node.pressed) {
        node.look = before;
        node.restyle();
      } else if (affectsLayout(before, node.look)) tree.invalidateLayout(node);
      else tree.invalidatePaint();
    },
    setText(node, text) {
      node.text = text;
      tree.invalidateLayout(node.parent);
    },
    setElementText(node, text) {
      for (const child of node.children) child.parent = null;
      node.children.length = 0;
      if (text) {
        const child = new ViewNode('#text', tree);
        child.text = text;
        child.parent = node;
        node.children.push(child);
      }
      tree.invalidateLayout(node);
    },
    parentNode: (node) => node.parent,
    nextSibling(node) {
      const siblings = node.parent?.children;
      return siblings ? (siblings[siblings.indexOf(node) + 1] ?? null) : null;
    },
  });
  return createApp(root, props);
}
