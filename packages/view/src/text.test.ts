import { describe, expect, it } from 'vitest';
import { layoutTree } from './layout.ts';
import { DEFAULT_TEXT } from './style.ts';
import { arrange, box, createTestTree, fixedMeasurer, label } from './test-helpers.ts';
import { breakLines, caretStops } from './text.ts';

const font = DEFAULT_TEXT.font;
/** 假量法里每个字 7 像素：maxWidth 70 就是一行 10 个字 */
const texts = (content: string, options: Parameters<typeof breakLines>[3]) =>
  breakLines(fixedMeasurer(), font, content, options).map((line) => line.text);

describe('折行', () => {
  it('放得下就是一行；没给宽度不折', () => {
    expect(texts('一二三四五', { maxWidth: 70 })).toEqual(['一二三四五']);
    expect(texts('这一行很长很长很长很长很长很长', {})).toEqual(['这一行很长很长很长很长很长很长']);
  });

  it('中文在字之间折；英文在词之间折，行尾的空格不算', () => {
    expect(texts('一二三四五六七八九十甲乙丙', { maxWidth: 70 })).toEqual([
      '一二三四五六七八九十',
      '甲乙丙',
    ]);
    expect(texts('the quick brown fox jumps', { maxWidth: 70 })).toEqual([
      'the quick',
      'brown fox',
      'jumps',
    ]);
  });

  it('记着每一行是原文的哪一段', () => {
    const lines = breakLines(fixedMeasurer(), font, 'the quick brown', { maxWidth: 70 });
    expect(lines.map((line) => [line.start, line.end])).toEqual([
      [0, 9],
      [10, 15],
    ]);
    expect(lines[0]!.width).toBe(63);
  });

  it('换行符处一定断；pre 只在换行符处断；nowrap 一行到底', () => {
    expect(texts('第一行\n第二行', {})).toEqual(['第一行', '第二行']);
    expect(texts('const a = 1;\n  return a + 12345;', { maxWidth: 70, whiteSpace: 'pre' })).toEqual(
      ['const a = 1;', '  return a + 12345;'],
    );
    expect(texts('一二三四五六七八九十甲乙丙', { maxWidth: 70, whiteSpace: 'nowrap' })).toEqual([
      '一二三四五六七八九十甲乙丙',
    ]);
  });

  it('一个词比一行还宽：在词里面断', () => {
    expect(texts('abcdefghijklmnopqrstuvwxyz', { maxWidth: 70 })).toEqual([
      'abcdefghij',
      'klmnopqrst',
      'uvwxyz',
    ]);
    // 网址在标点处也能断：每一行都不超宽，连起来还是原文
    const url = texts('see https://example.com/a/very/long/path ok', { maxWidth: 70 });
    expect(url.every((text) => text.length <= 10)).toBe(true);
    expect(url.join('').replaceAll(' ', '')).toBe('seehttps://example.com/a/very/long/pathok');
  });

  it('超过最多行数的不要；要省略号的话最后一行截短放上', () => {
    expect(
      texts('一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑', { maxWidth: 70, maxLines: 2 }),
    ).toEqual(['一二三四五六七八九十', '甲乙丙丁戊己庚辛壬癸']);
    expect(
      texts('一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑', {
        maxWidth: 70,
        maxLines: 2,
        ellipsis: true,
      }),
    ).toEqual(['一二三四五六七八九十', '甲乙丙丁戊己庚辛壬…']);
    expect(
      texts('不折行的一行放不下的时候', { maxWidth: 70, whiteSpace: 'nowrap', ellipsis: true }),
    ).toEqual(['不折行的一行放不下…']);
  });

  it('光标能停的位置：按字停（一个表情算一个），离行首多远是整段量的', () => {
    const [line] = breakLines(fixedMeasurer(), font, 'a👍b', {});
    const stops = caretStops(fixedMeasurer(), font, line!);
    expect(stops.offsets).toEqual([0, 1, 3, 4]);
    expect(stops.positions).toEqual([0, 7, 21, 28]);
  });
});

describe('一段字的排版', () => {
  it('竖排里的一段字在容器的宽度里折行，高度是行数乘行高', () => {
    const { tree } = createTestTree();
    const text = label(tree, '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑');
    const column = box(tree, { width: 90, padding: 10 }, [text]);
    arrange(tree, [box(tree, { flexDirection: 'row' }, [column])]);
    expect(text.lines.map((line) => line.text)).toEqual([
      '一二三四五六七八九十',
      '甲乙丙丁戊己庚辛壬癸',
      '子丑',
    ]);
    expect([text.width, text.height]).toEqual([70, 60]);
    expect(column.height).toBe(80);
  });

  it('横排里的一段字默认一行到底；写了 flex: 1 的在分到的宽度里折', () => {
    const { tree } = createTestTree();
    const rigid = label(tree, '一二三四五六七八九十甲乙');
    const soft = label(tree, '一二三四五六七八九十甲乙', { flex: 1 });
    const rows = [
      box(tree, { flexDirection: 'row' }, [rigid]),
      box(tree, { flexDirection: 'row' }, [box(tree, { width: 30 }), soft]),
    ];
    arrange(tree, rows, 100);
    expect(rigid.lines.length).toBe(1);
    expect(rigid.width).toBe(84);
    expect(soft.lines.map((line) => line.text)).toEqual(['一二三四五六七八九十', '甲乙']);
    expect(rows[1]!.height).toBe(40);
  });

  it('容器变窄了重新折', () => {
    const { tree } = createTestTree();
    const text = label(tree, '一二三四五六七八九十');
    arrange(tree, [text], 70);
    expect(text.lines.length).toBe(1);
    layoutTree(tree, 35, 300);
    expect(text.lines.map((line) => line.text)).toEqual(['一二三四五', '六七八九十']);
  });
});
