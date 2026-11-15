import { describe, expect, it } from 'vitest';
import { createPointerInput, hitTest, type ViewPointerEvent } from './events.ts';
import type { ViewNode } from './node.ts';
import { arrange, box, createTestTree, rect } from './test-helpers.ts';

describe('绝对定位', () => {
  it('不参加排队：兄弟照常排，它贴着父节点的边放', () => {
    const { tree } = createTestTree();
    const a = box(tree, { height: 30 });
    const corner = box(tree, { position: 'absolute', right: 8, top: 4, width: 20, height: 10 });
    const b = box(tree, { height: 30 });
    const parent = box(tree, { borderWidth: 2 }, [a, corner, b]);
    arrange(tree, [parent]);
    expect(parent.height).toBe(64);
    expect(rect(b)).toEqual([2, 32, 396, 30]);
    expect(rect(corner)).toEqual([400 - 2 - 8 - 20, 2 + 4, 20, 10]);
  });

  it('两边都写了：大小是两边之间那么大；只写一边的由内容定', () => {
    const { tree } = createTestTree();
    const cover = box(tree, { position: 'absolute', left: 10, right: 10, top: 0, bottom: 0 });
    const bottom = box(tree, { position: 'absolute', bottom: 5, left: 0 }, [
      box(tree, { width: 40, height: 12 }),
    ]);
    const parent = box(tree, { height: 100 }, [cover, bottom]);
    arrange(tree, [parent]);
    expect(rect(cover)).toEqual([10, 0, 380, 100]);
    expect(rect(bottom)).toEqual([0, 100 - 5 - 12, 40, 12]);
  });

  it('画在排着队的兄弟后面：叠在一起时点到的是它', () => {
    const { tree } = createTestTree();
    const below = box(tree, { height: 50 });
    const above = box(tree, { position: 'absolute', left: 0, top: 0, width: 30, height: 30 });
    arrange(tree, [box(tree, {}, [below, above])]);
    expect(hitTest(tree, 10, 10)).toBe(above);
    expect(hitTest(tree, 100, 10)).toBe(below);
  });
});

describe('滚动事件、抓住指针', () => {
  it('盒子滚了会叫 onScroll（滚轮、scrollTo 都算）；没动不叫', () => {
    const { tree } = createTestTree();
    const seen: number[] = [];
    const scroller = box(tree, { height: 100, overflow: 'scroll' }, [box(tree, { height: 500 })]);
    scroller.props = { onScroll: (node: ViewNode) => seen.push(node.scrollTop) };
    arrange(tree, [scroller]);
    scroller.scrollTo(0, 120);
    createPointerInput(tree).wheel(10, 10, 0, 30);
    scroller.scrollTo(0, 150);
    scroller.scrollTo(0, 9999);
    expect(seen).toEqual([120, 150, 400]);
  });

  it('按下时抓住指针：之后挪到哪、在哪松开都发给它', () => {
    const { tree } = createTestTree();
    const seen: string[] = [];
    const thumb = box(tree, { width: 20, height: 20 });
    thumb.props = {
      onPointerdown: (event: ViewPointerEvent) => event.capture(),
      onPointermove: (event: ViewPointerEvent) => seen.push(`挪 ${event.x},${event.y}`),
      onPointerup: () => seen.push('松'),
    };
    const other = box(tree, { height: 100 });
    other.props = { onPointermove: () => seen.push('别人') };
    arrange(tree, [thumb, other]);
    const input = createPointerInput(tree);
    input.down(5, 5);
    input.move(200, 80);
    input.up(300, 90);
    input.move(200, 80);
    expect(seen).toEqual(['挪 200,80', '松', '别人']);
  });
});
