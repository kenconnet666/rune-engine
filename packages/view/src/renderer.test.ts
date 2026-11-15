import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue';
import { layoutTree } from './layout.ts';
import type { ViewNode } from './node.ts';
import { createViewApp } from './renderer.ts';
import { createTestTree } from './test-helpers.ts';

/** 节点树的样子：只看盒子和字 */
const shape = (node: ViewNode): unknown =>
  node.type === 'text'
    ? node.textContent
    : node.children.filter((child) => child.type[0] !== '#').map(shape);

describe('Vue 落到节点树上', () => {
  it('组件渲染成节点；样式、事件落在节点上', () => {
    const { tree } = createTestTree();
    const onClick = () => {};
    const App = defineComponent(
      () => () =>
        h('view', { style: { padding: 8 }, onClick }, [
          h('text', null, '你好'),
          h('view', { style: { height: 10 } }),
        ]),
    );
    createViewApp(tree, App).mount(tree.root);
    const [panel] = tree.root.children;
    expect(shape(tree.root)).toEqual([['你好', []]]);
    expect(panel!.style).toEqual({ padding: 8 });
    expect(panel!.props?.onClick).toBe(onClick);
    layoutTree(tree, 200, 100);
    expect(panel!.height).toBe(8 + 20 + 10 + 8);
  });

  it('响应式的数据变了：字跟着变，只标记要重排，不动别的节点', async () => {
    const { tree, measurer } = createTestTree();
    const count = ref(1);
    const App = defineComponent(
      () => () =>
        h('view', null, [h('text', null, `数到 ${count.value}`), h('text', null, '不变')]),
    );
    createViewApp(tree, App).mount(tree.root);
    layoutTree(tree, 200, 100);
    const [changing, steady] = tree.root.children[0]!.children;
    expect(tree.needsLayout).toBe(false);
    count.value = 25;
    await nextTick();
    expect(tree.needsLayout).toBe(true);
    expect(changing!.layoutDirty).toBe(true);
    expect(steady!.layoutDirty).toBe(false);
    measurer.calls.length = 0;
    layoutTree(tree, 200, 100);
    expect(changing!.text).toBe('数到 25');
    // 只量了变了的那一段（看它在这个宽度里放不放得下）；没变的那一行整个跳过了
    expect(measurer.calls).toEqual(['数到 25']);
    expect(steady!.layoutDirty).toBe(false);
  });

  it('列表增删、换顺序：节点跟着增删、挪位置（按 key 复用）', async () => {
    const { tree } = createTestTree();
    const names = shallowRef(['甲', '乙', '丙']);
    const App = defineComponent(
      () => () =>
        h(
          'view',
          null,
          names.value.map((name) => h('text', { key: name }, name)),
        ),
    );
    createViewApp(tree, App).mount(tree.root);
    const list = tree.root.children[0]!;
    const original = list.children.filter((child) => child.type === 'text');
    names.value = ['丙', '甲', '丁'];
    await nextTick();
    expect(shape(list)).toEqual(['丙', '甲', '丁']);
    const now = list.children.filter((child) => child.type === 'text');
    expect(now[0]).toBe(original[2]);
    expect(now[1]).toBe(original[0]);
    expect(original[1]!.parent).toBeNull();
  });

  it('只换了底色的样式不用重排；换了尺寸的要', async () => {
    const { tree } = createTestTree();
    const style = shallowRef<Record<string, unknown>>({ height: 10, backgroundColor: '#111' });
    const App = defineComponent(() => () => h('view', { style: style.value }));
    createViewApp(tree, App).mount(tree.root);
    layoutTree(tree, 200, 100);
    tree.needsPaint = false;
    style.value = { height: 10, backgroundColor: '#222' };
    await nextTick();
    expect([tree.needsLayout, tree.needsPaint]).toEqual([false, true]);
    style.value = { height: 12, backgroundColor: '#222' };
    await nextTick();
    expect(tree.needsLayout).toBe(true);
  });

  it('卸载之后树是空的', () => {
    const { tree } = createTestTree();
    const app = createViewApp(
      tree,
      defineComponent(() => () => h('view', null, [h('text', null, '在')])),
    );
    app.mount(tree.root);
    expect(shape(tree.root)).toEqual([['在']]);
    app.unmount();
    expect(shape(tree.root)).toEqual([]);
  });
});
