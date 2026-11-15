import { describe, expect, it } from 'vitest';
import { layoutTree } from './layout.ts';
import { append, arrange, box, createTestTree, label, rect } from './test-helpers.ts';

describe('排版', () => {
  it('默认竖着排，横向撑满；高度由内容定', () => {
    const { tree } = createTestTree();
    const first = box(tree, { height: 30 });
    const second = box(tree, { height: 50 });
    const column = box(tree, {}, [first, second]);
    arrange(tree, [column]);
    expect(rect(column)).toEqual([0, 0, 400, 80]);
    expect(rect(first)).toEqual([0, 0, 400, 30]);
    expect(rect(second)).toEqual([0, 30, 400, 50]);
  });

  it('横排：定宽的照定的，写了 flexGrow 的按份数分剩下的', () => {
    const { tree } = createTestTree();
    const fixed = box(tree, { width: 100 });
    const one = box(tree, { flexGrow: 1 });
    const three = box(tree, { flexGrow: 3 });
    const row = box(tree, { flexDirection: 'row', height: 40 }, [fixed, one, three]);
    arrange(tree, [row]);
    expect(rect(fixed)).toEqual([0, 0, 100, 40]);
    expect(rect(one)).toEqual([100, 0, 75, 40]);
    expect(rect(three)).toEqual([175, 0, 225, 40]);
  });

  it('内边距、边线都算在盒子里面；间隔只在相邻两个之间', () => {
    const { tree } = createTestTree();
    const a = box(tree, { height: 10 });
    const b = box(tree, { height: 10 });
    const outer = box(tree, { padding: 8, paddingLeft: 20, borderWidth: 2, gap: 6 }, [a, b]);
    arrange(tree, [outer]);
    expect(rect(outer)).toEqual([0, 0, 400, 10 + 10 + 6 + 16 + 4]);
    expect(rect(a)).toEqual([22, 10, 400 - 22 - 10, 10]);
    expect(rect(b)).toEqual([22, 26, 368, 10]);
    expect(outer.contentHeight).toBe(outer.height);
  });

  it('一行字：宽度是量出来的，高度是行高；放在不撑满的容器里就是内容那么大', () => {
    const { tree } = createTestTree();
    const text = label(tree, '四个汉字');
    const row = box(tree, { flexDirection: 'row', alignItems: 'center', height: 40 }, [text]);
    arrange(tree, [row]);
    expect(rect(text)).toEqual([0, 10, 28, 20]);
    expect(text.text).toBe('四个汉字');
  });

  it('交叉轴：居中、靠后、撑满；自己写了 alignSelf 的听自己的', () => {
    const { tree } = createTestTree();
    const centered = box(tree, { width: 20, height: 20 });
    const end = box(tree, { width: 20, height: 20, alignSelf: 'flex-end' });
    const stretched = box(tree, { width: 20, alignSelf: 'stretch' });
    const row = box(tree, { flexDirection: 'row', alignItems: 'center', height: 60 }, [
      centered,
      end,
      stretched,
    ]);
    arrange(tree, [row]);
    expect(centered.y).toBe(20);
    expect(end.y).toBe(40);
    expect(rect(stretched)).toEqual([40, 0, 20, 60]);
  });

  it('主轴：居中、靠后、两头顶住中间匀开', () => {
    const { tree } = createTestTree();
    const make = (justifyContent: 'center' | 'flex-end' | 'space-between') => {
      const items = [box(tree, { width: 50 }), box(tree, { width: 50 }), box(tree, { width: 50 })];
      return { items, row: box(tree, { flexDirection: 'row', height: 10, justifyContent }, items) };
    };
    const center = make('center');
    const end = make('flex-end');
    const between = make('space-between');
    arrange(tree, [center.row, end.row, between.row]);
    expect(center.items.map((item) => item.x)).toEqual([125, 175, 225]);
    expect(end.items.map((item) => item.x)).toEqual([250, 300, 350]);
    expect(between.items.map((item) => item.x)).toEqual([0, 175, 350]);
  });

  it('放不下时：默认不缩（溢出去），写了 flexShrink 的按原来的大小加权缩', () => {
    const { tree } = createTestTree();
    const rigid = [box(tree, { width: 300 }), box(tree, { width: 300 })];
    const overflowing = box(tree, { flexDirection: 'row', height: 10 }, rigid);
    const soft = [
      box(tree, { width: 300, flexShrink: 1 }),
      box(tree, { width: 100, flexShrink: 1 }),
    ];
    const shrinking = box(tree, { flexDirection: 'row', height: 10 }, soft);
    arrange(tree, [overflowing, shrinking], 200);
    expect(rigid.map((item) => item.width)).toEqual([300, 300]);
    expect(overflowing.contentWidth).toBe(600);
    expect(soft.map((item) => item.width)).toEqual([150, 50]);
  });

  it('最小、最大限制住伸缩出来的大小', () => {
    const { tree } = createTestTree();
    const capped = box(tree, { flexGrow: 1, maxWidth: 120 });
    const floor = box(tree, { width: 10, minWidth: 40 });
    const row = box(tree, { flexDirection: 'row', height: 10 }, [capped, floor]);
    arrange(tree, [row]);
    expect(capped.width).toBe(120);
    expect(floor.width).toBe(40);
  });

  it('外边距把自己和别人隔开', () => {
    const { tree } = createTestTree();
    const a = box(tree, { height: 10, marginBottom: 5 });
    const b = box(tree, { height: 10, marginLeft: 30, marginTop: 3 });
    const column = box(tree, {}, [a, b]);
    arrange(tree, [column]);
    expect(rect(b)).toEqual([30, 18, 370, 10]);
    expect(column.height).toBe(28);
  });

  it('根节点是整个视口；写了 flex: 1 的子节点占满剩下的高度（内容再多也不撑大它）', () => {
    const { tree } = createTestTree();
    const header = box(tree, { height: 40 });
    const body = box(tree, { flex: 1, overflow: 'scroll' }, [box(tree, { height: 1000 })]);
    arrange(tree, [header, body], 400, 300);
    expect(rect(body)).toEqual([0, 40, 400, 260]);
    expect(body.contentHeight).toBe(1000);
  });

  it('只写 flexGrow 的：原来的大小还是内容那么大，有空才伸，放不下不缩', () => {
    const { tree } = createTestTree();
    const small = box(tree, { flexGrow: 1 }, [box(tree, { height: 50 })]);
    const big = box(tree, { flexGrow: 1 }, [box(tree, { height: 1000 })]);
    arrange(
      tree,
      [box(tree, { height: 200 }, [small]), box(tree, { height: 200 }, [big])],
      400,
      400,
    );
    expect(small.height).toBe(200);
    expect(big.height).toBe(1000);
  });

  it('只重排变了的：改一段字，别的字不再量', () => {
    const { tree, measurer } = createTestTree();
    const rows = Array.from({ length: 50 }, (_, index) =>
      box(tree, { flexDirection: 'row', height: 20 }, [
        label(tree, `第 ${index} 行`),
        label(tree, '不变的字'),
      ]),
    );
    arrange(tree, [box(tree, {}, rows)]);
    expect(measurer.calls.length).toBe(100);
    measurer.calls.length = 0;
    const target = rows[7]!.children[0]!;
    target.children[0]!.text = '改过的字比原来长';
    tree.invalidateLayout(target);
    layoutTree(tree, 400, 300);
    expect(measurer.calls).toEqual(['改过的字比原来长']);
    expect(target.width).toBe(8 * 7);
    // 同一行里它后面的那个跟着挪了
    expect(rows[7]!.children[1]!.x).toBe(56);
  });

  it('内容变短了，滚过头的收回来', () => {
    const { tree } = createTestTree();
    const content = box(tree, { height: 1000 });
    const scroller = box(tree, { height: 200, overflow: 'scroll' }, [content]);
    arrange(tree, [scroller]);
    scroller.scrollTop = 800;
    content.style = content.look = { height: 500 };
    tree.invalidateLayout(content);
    layoutTree(tree, 400, 300);
    expect(scroller.scrollTop).toBe(300);
  });

  it('后来加进来的子节点排在该在的位置', () => {
    const { tree } = createTestTree();
    const column = box(tree, {}, [box(tree, { height: 10 })]);
    arrange(tree, [column]);
    const added = box(tree, { height: 25 });
    append(column, added);
    layoutTree(tree, 400, 300);
    expect(rect(added)).toEqual([0, 10, 400, 25]);
    expect(column.height).toBe(35);
  });
});
