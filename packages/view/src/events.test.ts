import { describe, expect, it } from 'vitest';
import { createPointerInput, hitTest, type ViewPointerEvent } from './events.ts';
import { layoutTree } from './layout.ts';
import { childRange } from './node.ts';
import { arrange, box, createTestTree, label } from './test-helpers.ts';

describe('命中', () => {
  it('落在最里面的那个节点上；没落到谁是 null', () => {
    const { tree } = createTestTree();
    const inner = box(tree, { width: 50, height: 20 });
    const outer = box(tree, { padding: 10 }, [inner]);
    arrange(tree, [outer]);
    expect(hitTest(tree, 15, 15)).toBe(inner);
    expect(hitTest(tree, 200, 15)).toBe(outer);
    expect(hitTest(tree, 5, 5)).toBe(outer);
    // 根节点不算被点到
    expect(hitTest(tree, 200, 200)).toBeNull();
  });

  it('后面的兄弟盖在前面的上面（溢出到别人身上时）', () => {
    const { tree } = createTestTree();
    const tall = box(tree, { height: 10 }, [box(tree, { height: 40 })]);
    const next = box(tree, { height: 30 });
    arrange(tree, [tall, next]);
    // tall 的子节点溢出到了 next 上面，但 next 排在后面
    expect(hitTest(tree, 5, 20)).toBe(next);
  });

  it('超出不显示的盒子：外面点不到它溢出去的子孙；滚了之后点到的是滚上来的那个', () => {
    const { tree } = createTestTree();
    const rows = Array.from({ length: 10 }, () => box(tree, { height: 50 }));
    const scroller = box(tree, { height: 100, overflow: 'scroll' }, rows);
    const below = box(tree, { height: 50 });
    arrange(tree, [scroller, below]);
    expect(hitTest(tree, 5, 120)).toBe(below);
    expect(hitTest(tree, 5, 60)).toBe(rows[1]);
    scroller.scrollTop = 200;
    expect(hitTest(tree, 5, 60)).toBe(rows[5]);
  });

  it('pointerEvents: none 的节点自己点不到，点到的是它下面的；它的子节点照常', () => {
    const { tree } = createTestTree();
    const child = box(tree, { width: 20, height: 20 });
    const ghost = box(tree, { height: 40, pointerEvents: 'none' }, [child]);
    const parent = box(tree, {}, [ghost]);
    arrange(tree, [parent]);
    expect(hitTest(tree, 100, 10)).toBe(parent);
    expect(hitTest(tree, 10, 10)).toBe(child);
  });

  it('很长的一列按位置二分：只找到和那一段重叠的子节点', () => {
    const { tree } = createTestTree();
    const rows = Array.from({ length: 1000 }, () => box(tree, { height: 20 }));
    const column = box(tree, {}, rows);
    arrange(tree, [column]);
    expect(childRange(column, 100, 160)).toEqual([5, 8]);
    expect(childRange(column, 0, 1)).toEqual([0, 1]);
    expect(childRange(column, 19990, 30000)).toEqual([999, 1000]);
    expect(hitTest(tree, 5, 20 * 777 + 3)).toBe(rows[777]);
  });
});

describe('指针事件', () => {
  it('点击从被点到的节点往上冒，可以拦住', () => {
    const { tree } = createTestTree();
    const seen: string[] = [];
    const button = label(tree, '按钮');
    button.props = {
      onClick: (event: ViewPointerEvent) => seen.push(`按钮 ${event.target === button}`),
    };
    const panel = box(tree, { padding: 10 }, [button]);
    panel.props = { onClick: () => seen.push('面板') };
    arrange(tree, [panel]);
    const input = createPointerInput(tree);
    input.down(12, 12);
    input.up(12, 12);
    expect(seen).toEqual(['按钮 true', '面板']);
    seen.length = 0;
    button.props = {
      onClick: (event: ViewPointerEvent) => (seen.push('按钮'), event.stopPropagation()),
    };
    input.down(12, 12);
    input.up(12, 12);
    expect(seen).toEqual(['按钮']);
  });

  it('按下和松开不在同一个节点上：点击落在它们共同的祖先上', () => {
    const { tree } = createTestTree();
    const seen: string[] = [];
    const left = box(tree, { width: 50, height: 20 });
    const right = box(tree, { width: 50, height: 20 });
    left.props = { onClick: () => seen.push('左') };
    right.props = { onClick: () => seen.push('右') };
    const row = box(tree, { flexDirection: 'row' }, [left, right]);
    row.props = { onClick: () => seen.push('行') };
    arrange(tree, [row]);
    const input = createPointerInput(tree);
    input.down(10, 10);
    input.up(60, 10);
    expect(seen).toEqual(['行']);
  });

  it('进来、出去不冒；进到子节点里不算从父节点出去', () => {
    const { tree } = createTestTree();
    const seen: string[] = [];
    const child = box(tree, { width: 20, height: 20 });
    const parent = box(tree, { padding: 10 }, [child]);
    const other = box(tree, { height: 30 });
    for (const [name, node] of [
      ['子', child],
      ['父', parent],
      ['旁', other],
    ] as const) {
      node.props = {
        onPointerenter: () => seen.push(`进${name}`),
        onPointerleave: () => seen.push(`出${name}`),
      };
    }
    arrange(tree, [parent, other]);
    const input = createPointerInput(tree);
    input.move(5, 5);
    input.move(15, 15);
    input.move(5, 5);
    input.move(5, 50);
    input.leave();
    expect(seen).toEqual(['进父', '进子', '出子', '出父', '进旁', '出旁']);
  });

  it('指着、按着的节点带上状态，样式里的 hover / active 生效；只变画法的不用重排', () => {
    const { tree } = createTestTree();
    const button = box(tree, {
      height: 30,
      backgroundColor: '#111',
      hover: { backgroundColor: '#222' },
      active: { backgroundColor: '#333', height: 28 },
    });
    arrange(tree, [button]);
    const input = createPointerInput(tree);
    tree.needsPaint = false;
    input.move(10, 10);
    expect(button.look.backgroundColor).toBe('#222');
    expect(tree.needsPaint).toBe(true);
    expect(tree.needsLayout).toBe(false);
    input.down(10, 10);
    expect(button.look.backgroundColor).toBe('#333');
    // active 里改了高度：要重排
    expect(tree.needsLayout).toBe(true);
    layoutTree(tree, 400, 300);
    expect(button.height).toBe(28);
    input.up(10, 10);
    expect(button.look.backgroundColor).toBe('#222');
    input.leave();
    expect(button.look).toBe(button.style);
  });

  it('光标看指着的那一串里最近写了 cursor 的', () => {
    const { tree } = createTestTree();
    const link = box(tree, { width: 40, height: 20, cursor: 'pointer' }, [label(tree, '链接')]);
    const panel = box(tree, { padding: 10 }, [link]);
    arrange(tree, [panel]);
    const input = createPointerInput(tree);
    input.move(12, 12);
    expect(input.cursor).toBe('pointer');
    input.move(200, 5);
    expect(input.cursor).toBe('default');
  });

  it('滚轮：最近的还滚得动的盒子滚，到头了交给外面的；都滚不动就不算处理了', () => {
    const { tree } = createTestTree();
    const inner = box(tree, { height: 100, overflow: 'scroll' }, [box(tree, { height: 150 })]);
    const outer = box(tree, { height: 200, overflow: 'scroll' }, [
      inner,
      box(tree, { height: 400 }),
    ]);
    arrange(tree, [outer]);
    const input = createPointerInput(tree);
    expect(input.wheel(10, 10, 0, 30)).toBe(true);
    expect([inner.scrollTop, outer.scrollTop]).toEqual([30, 0]);
    // 里面的最多再滚 20
    expect(input.wheel(10, 10, 0, 100)).toBe(true);
    expect([inner.scrollTop, outer.scrollTop]).toEqual([50, 0]);
    // 里面到头了：外面的滚
    expect(input.wheel(10, 10, 0, 100)).toBe(true);
    expect([inner.scrollTop, outer.scrollTop]).toEqual([50, 100]);
    outer.scrollTop = 300;
    inner.scrollTop = 50;
    expect(input.wheel(10, 150, 0, 100)).toBe(false);
  });

  it('滚轮的处理函数可以拦住默认的滚动', () => {
    const { tree } = createTestTree();
    const scroller = box(tree, { height: 100, overflow: 'scroll' }, [box(tree, { height: 500 })]);
    scroller.props = { onWheel: (event: { preventDefault(): void }) => event.preventDefault() };
    arrange(tree, [scroller]);
    const input = createPointerInput(tree);
    expect(input.wheel(10, 10, 0, 50)).toBe(true);
    expect(scroller.scrollTop).toBe(0);
  });
});
