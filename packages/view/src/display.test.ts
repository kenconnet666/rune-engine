import {
  VIEW_ITEM,
  VIEW_ITEM_FLOATS,
  VIEW_KIND_RECT,
  VIEW_KIND_TEXT,
} from '@rune-engine/render/view-types';
import { describe, expect, it } from 'vitest';
import { createDisplayBuilder, type DisplayFrame } from './display.ts';
import { layoutTree } from './layout.ts';
import { arrange, box, createTestTree, label } from './test-helpers.ts';

/** 显示列表里的第 index 项，按名字取数 */
const item = (frame: DisplayFrame, index: number) => {
  const at = index * VIEW_ITEM_FLOATS;
  const get = (offset: number, length = 1) =>
    Array.from(frame.items.subarray(at + offset, at + offset + length));
  return {
    kind: frame.items[at + VIEW_ITEM.kind],
    box: get(VIEW_ITEM.x, 4),
    clip: get(VIEW_ITEM.clipLeft, 4),
    color: get(VIEW_ITEM.color, 4),
    radius: frame.items[at + VIEW_ITEM.radius],
    borderWidth: frame.items[at + VIEW_ITEM.borderWidth],
    run: frame.items[at + VIEW_ITEM.run],
  };
};

describe('显示列表', () => {
  it('有底色或者边线的盒子是一项矩形，一行字是一项文字；按画的先后排', () => {
    const { tree } = createTestTree();
    const text = label(tree, '标题', { color: '#ff0000' });
    const card = box(tree, { padding: 10, backgroundColor: '#fff', borderRadius: 6 }, [text]);
    const plain = box(tree, { height: 20 });
    const outlined = box(tree, { height: 20, borderWidth: 1, borderColor: '#000' });
    arrange(tree, [card, plain, outlined]);
    const frame = createDisplayBuilder().build(tree, 400, 300);
    expect(frame.count).toBe(3);
    expect(item(frame, 0)).toMatchObject({ kind: VIEW_KIND_RECT, box: [0, 0, 400, 40], radius: 6 });
    expect(item(frame, 0).color).toEqual([1, 1, 1, 1]);
    expect(item(frame, 1)).toMatchObject({ kind: VIEW_KIND_TEXT, color: [1, 0, 0, 1] });
    expect(item(frame, 1).box.slice(0, 2)).toEqual([10, 10]);
    expect(item(frame, 2)).toMatchObject({ kind: VIEW_KIND_RECT, borderWidth: 1 });
    expect(frame.runs).toEqual([
      expect.objectContaining({ id: item(frame, 1).run, text: '标题', lineHeight: 20 }),
    ]);
  });

  it('不透明度一层层乘下去', () => {
    const { tree } = createTestTree();
    const inner = box(tree, { height: 10, backgroundColor: '#ffffff80', opacity: 0.5 });
    arrange(tree, [box(tree, { opacity: 0.5 }, [inner])]);
    const frame = createDisplayBuilder().build(tree, 400, 300);
    expect(item(frame, 0).color[3]).toBeCloseTo((128 / 255) * 0.25, 5);
  });

  it('超出不显示的盒子把子孙裁在自己（边线以内）的那一块里；滚动把内容往上挪', () => {
    const { tree } = createTestTree();
    const rows = Array.from({ length: 10 }, () =>
      box(tree, { height: 50, backgroundColor: '#eee' }),
    );
    const scroller = box(
      tree,
      { height: 100, overflow: 'scroll', borderWidth: 2, borderColor: '#000' },
      rows,
    );
    arrange(tree, [box(tree, { height: 30 }), scroller]);
    scroller.scrollTop = 120;
    const frame = createDisplayBuilder().build(tree, 400, 300);
    // 盒子自己，加上露出来的三行（第 2 行露出一小截、第 3 行整行、第 4 行一截）
    expect(frame.count).toBe(4);
    expect(item(frame, 1).box).toEqual([2, 30 + 2 + 100 - 120, 396, 50]);
    expect(item(frame, 1).clip).toEqual([2, 32, 398, 128]);
    expect(item(frame, 3).box[1]).toBe(30 + 2 + 200 - 120);
  });

  it('视口外面的不列：两万行只列露出来的那些', () => {
    const { tree } = createTestTree();
    const rows = Array.from({ length: 20000 }, (_, index) =>
      box(tree, { height: 20, backgroundColor: '#eee' }, [label(tree, `第 ${index} 行`)]),
    );
    const scroller = box(tree, { flexGrow: 1, overflow: 'scroll' }, rows);
    arrange(tree, [scroller], 400, 300);
    const builder = createDisplayBuilder();
    expect(builder.build(tree, 400, 300).count).toBe(15 * 2);
    scroller.scrollTop = 20 * 12345 + 5;
    const frame = builder.build(tree, 400, 300);
    expect(frame.count).toBe(16 * 2);
    expect(frame.runs[0]!.text).toBe('第 12345 行');
  });

  it('同一段字只登记一次；字改了重新登记', () => {
    const { tree } = createTestTree();
    const a = label(tree, '同样的字');
    const b = label(tree, '同样的字');
    arrange(tree, [a, b]);
    const builder = createDisplayBuilder();
    const first = builder.build(tree, 400, 300);
    expect(first.runs.length).toBe(1);
    expect(item(first, 0).run).toBe(item(first, 1).run);
    expect(builder.build(tree, 400, 300).runs).toEqual([]);
    a.children[0]!.text = '换了的字';
    tree.invalidateLayout(a);
    layoutTree(tree, 400, 300);
    const third = builder.build(tree, 400, 300);
    expect(third.runs.map((run) => run.text)).toEqual(['换了的字']);
    expect(item(third, 0).run).not.toBe(item(third, 1).run);
  });

  it('登记得太多了：这一帧没用到的清掉，告诉渲染线程可以忘了', () => {
    const { tree } = createTestTree();
    const rows = Array.from({ length: 40 }, (_, index) => label(tree, `第 ${index} 行`));
    const scroller = box(tree, { height: 100, overflow: 'scroll' }, rows);
    arrange(tree, [scroller]);
    const builder = createDisplayBuilder({ runLimit: 8 });
    const first = builder.build(tree, 400, 300);
    expect(first.runs.length).toBe(5);
    expect(first.dropped).toEqual([]);
    scroller.scrollTop = 400;
    const second = builder.build(tree, 400, 300);
    // 新的 5 段登记进来超了限：上一帧那 5 段不再用，清掉
    expect(second.runs.length).toBe(5);
    const ascending = (a: number, b: number) => a - b;
    expect(second.dropped.sort(ascending)).toEqual(first.runs.map((run) => run.id).sort(ascending));
    // 清过之后节点上记着的号还对得上
    const third = builder.build(tree, 400, 300);
    expect(third.runs).toEqual([]);
    expect(item(third, 0).run).toBe(second.runs[0]!.id);
  });
});
