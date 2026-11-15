import {
  VIEW_ITEM,
  VIEW_ITEM_FLOATS,
  VIEW_KIND_RECT,
  VIEW_KIND_TEXT,
} from '@rune-engine/render/view-types';
import { describe, expect, it } from 'vitest';
import { createDisplayBuilder } from './display.ts';
import { createPointerInput } from './events.ts';
import { pointAt, selectAll, selectedText } from './selection.ts';
import { arrange, box, createTestTree, label } from './test-helpers.ts';

/** 假的钟：测试里自己拨 */
const clock = () => {
  let time = 0;
  return { now: () => time, pass: (ms: number) => (time += ms) };
};

/** 一张两行三列的小表：每个格子 100 宽、30 高，字在格子的左上角（每个字 7 像素宽、行高 20） */
function table() {
  const { tree } = createTestTree();
  const cell = (text: string) => box(tree, { width: 100, height: 30 }, [label(tree, text)]);
  const rows = [
    box(tree, { flexDirection: 'row' }, [cell('苹果'), cell('三斤'), cell('十二块五')]),
    box(tree, { flexDirection: 'row' }, [cell('香蕉'), cell('一把'), cell('八块')]),
  ];
  arrange(tree, rows);
  return tree;
}

describe('画布上的位置对着哪个字', () => {
  it('落在一段字上：离得最近的那个字缝', () => {
    const tree = table();
    expect(pointAt(tree, 3, 5)).toMatchObject({ offset: 0 });
    expect(pointAt(tree, 4, 5)).toMatchObject({ offset: 1 });
    expect(pointAt(tree, 13, 5)?.node.text).toBe('苹果');
    expect(pointAt(tree, 13, 5)?.offset).toBe(2);
    expect(pointAt(tree, 208, 35)).toMatchObject({ offset: 1 });
    expect(pointAt(tree, 208, 35)?.node.text).toBe('八块');
  });

  it('落在空白处：取最近的一段字，同一行的优先', () => {
    const tree = table();
    // 第一行第二格的右边空白：还是“三斤”，停在末尾
    expect(pointAt(tree, 180, 10)?.node.text).toBe('三斤');
    expect(pointAt(tree, 180, 10)?.offset).toBe(2);
    // 表格下面很远：最后一行
    expect(pointAt(tree, 105, 250)?.node.text).toBe('一把');
  });

  it('折了行的一段字：按行找', () => {
    const { tree } = createTestTree();
    const text = label(tree, '一二三四五六七八九十甲乙丙');
    arrange(tree, [text], 70);
    expect(text.lines.length).toBe(2);
    expect(pointAt(tree, 15, 5)?.offset).toBe(2);
    expect(pointAt(tree, 15, 25)?.offset).toBe(12);
    expect(pointAt(tree, 200, 25)?.offset).toBe(13);
  });
});

describe('拖着选', () => {
  it('在字上按下、拖到别处：选中中间的；复制出来同一行用制表符隔开、换行用换行符', () => {
    const tree = table();
    const input = createPointerInput(tree);
    input.down(8, 5);
    input.move(110, 5);
    expect(selectedText(tree, tree.selection)).toBe('果\t三');
    input.move(150, 40);
    input.up(150, 40);
    expect(selectedText(tree, tree.selection)).toBe('果\t三斤\t十二块五\n香蕉\t一把');
  });

  it('往回拖也行；选区的先后和拖的方向无关', () => {
    const tree = table();
    const input = createPointerInput(tree);
    input.down(120, 40);
    input.move(8, 5);
    input.up(8, 5);
    expect(selectedText(tree, tree.selection)).toBe('果\t三斤\t十二块五\n香蕉\t一把');
  });

  it('只按了一下没拖：什么都没选中；按在空白处原来的选区取消', () => {
    const tree = table();
    const time = clock();
    const input = createPointerInput(tree, time);
    input.down(8, 5);
    input.up(8, 5);
    expect(selectedText(tree, tree.selection)).toBe('');
    // 隔一会儿再按（不然是双击）
    time.pass(1000);
    input.down(8, 5);
    input.move(20, 5);
    input.up(20, 5);
    expect(selectedText(tree, tree.selection)).toBe('果');
    input.down(60, 25);
    input.up(60, 25);
    expect(tree.selection).toBeNull();
  });

  it('双击选一个词，三击选整段；隔久了再点不算连击', () => {
    const { tree } = createTestTree();
    arrange(tree, [label(tree, 'hello brave world')]);
    const time = clock();
    const input = createPointerInput(tree, time);
    const click = (x: number) => {
      input.down(x, 5);
      input.up(x, 5);
    };
    click(60);
    time.pass(100);
    click(60);
    expect(selectedText(tree, tree.selection)).toBe('brave');
    time.pass(100);
    click(60);
    expect(selectedText(tree, tree.selection)).toBe('hello brave world');
    time.pass(1000);
    click(60);
    expect(selectedText(tree, tree.selection)).toBe('');
  });

  it('按着 Shift 点：从原来按下的地方接着选到这里', () => {
    const tree = table();
    const input = createPointerInput(tree);
    input.down(8, 5);
    input.up(8, 5);
    input.down(120, 40, { shift: true });
    input.up(120, 40);
    expect(selectedText(tree, tree.selection)).toBe('果\t三斤\t十二块五\n香蕉\t一把');
  });

  it('写了 userSelect: none 的选不中、复制时跳过；全选只选能选的', () => {
    const { tree } = createTestTree();
    const button = box(tree, { userSelect: 'none', height: 20 }, [label(tree, '按钮')]);
    arrange(tree, [label(tree, '第一段'), button, label(tree, '第二段')]);
    const input = createPointerInput(tree);
    input.down(5, 25);
    input.move(20, 25);
    input.up(20, 25);
    expect(tree.selection).toBeNull();
    tree.select(selectAll(tree));
    expect(selectedText(tree, tree.selection)).toBe('第一段\n第二段');
    expect(input.cursor).toBe('default');
    input.move(5, 5);
    expect(input.cursor).toBe('text');
  });
});

describe('选中的底色', () => {
  it('每段选中的字下面垫一块矩形，画在字的前面；没选中的没有', () => {
    const tree = table();
    const input = createPointerInput(tree);
    input.down(8, 5);
    input.move(110, 5);
    input.up(110, 5);
    const frame = createDisplayBuilder().build(tree, 400, 300);
    const kinds = Array.from(
      { length: frame.count },
      (_, index) => frame.items[index * VIEW_ITEM_FLOATS],
    );
    // “苹果”的底色、字，“三斤”的底色、字，然后是没选中的四段字
    expect(kinds).toEqual([
      VIEW_KIND_RECT,
      VIEW_KIND_TEXT,
      VIEW_KIND_RECT,
      VIEW_KIND_TEXT,
      VIEW_KIND_TEXT,
      VIEW_KIND_TEXT,
      VIEW_KIND_TEXT,
      VIEW_KIND_TEXT,
    ]);
    const rect = (index: number) =>
      Array.from(
        frame.items.subarray(
          index * VIEW_ITEM_FLOATS + VIEW_ITEM.x,
          index * VIEW_ITEM_FLOATS + VIEW_ITEM.x + 4,
        ),
      );
    // “果”：从第 1 个字到这段字的末尾，后面接着选所以多出一小截
    expect(rect(0)).toEqual([7, 0, 7 + 5, 20]);
    // “三”：第二格开头的一个字
    expect(rect(2)).toEqual([100, 0, 7, 20]);
  });

  it('节点不在树上了（界面换了）：选区自己失效，不出错', () => {
    const tree = table();
    const input = createPointerInput(tree);
    input.down(8, 5);
    input.move(110, 5);
    input.up(110, 5);
    tree.root.children[0]!.parent = null;
    tree.root.children.shift();
    tree.invalidateLayout(tree.root);
    expect(selectedText(tree, tree.selection)).toBe('');
    expect(() => createDisplayBuilder().build(tree, 400, 300)).not.toThrow();
  });
});
