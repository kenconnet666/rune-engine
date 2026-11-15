import { describe, expect, it } from 'vitest';
import { affectsLayout, DEFAULT_TEXT, inheritText, parseColor } from './style.ts';

describe('颜色', () => {
  it('认十六进制的几种写法', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1, 1]);
    expect(parseColor('#ff000080')[3]).toBeCloseTo(0.5, 2);
    expect(parseColor('#0f08')).toEqual([0, 1, 0, 136 / 255]);
    expect(parseColor('#336699')).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255, 1]);
  });

  it('认 rgb() / rgba()，逗号、空格、斜杠都行', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual([1, 0, 0, 1]);
    expect(parseColor('rgba(0, 0, 255, 0.25)')).toEqual([0, 0, 1, 0.25]);
    expect(parseColor('rgb(0 255 0 / 50%)')).toEqual([0, 1, 0, 0.5]);
  });

  it('认不出来的是透明；同一个写法给的是同一个对象', () => {
    expect(parseColor('一种颜色')).toEqual([0, 0, 0, 0]);
    expect(parseColor('transparent')[3]).toBe(0);
    expect(parseColor('#123456')).toBe(parseColor('#123456'));
  });
});

describe('文字样式往下传', () => {
  it('自己没写文字相关的，用的就是父节点那一份（同一个对象）', () => {
    expect(inheritText(DEFAULT_TEXT, { backgroundColor: '#fff', padding: 4 })).toBe(DEFAULT_TEXT);
  });

  it('只改写了的那几样；换了字号没写行高时行高跟着字号走', () => {
    const bigger = inheritText(DEFAULT_TEXT, { fontSize: 20, color: '#f00' });
    expect(bigger.font.size).toBe(20);
    expect(bigger.font.family).toBe(DEFAULT_TEXT.font.family);
    expect(bigger.lineHeight).toBe(28);
    expect(bigger.color).toEqual([1, 0, 0, 1]);
    expect(inheritText(DEFAULT_TEXT, { fontSize: 20, lineHeight: 22 }).lineHeight).toBe(22);
    expect(inheritText(bigger, { color: '#00f' }).lineHeight).toBe(28);
  });

  it('同样的字体是同一个对象（量文字、登记文字段按对象认）', () => {
    const one = inheritText(DEFAULT_TEXT, { fontWeight: 600 });
    const other = inheritText(DEFAULT_TEXT, { fontWeight: 600, color: '#333' });
    expect(one.font).toBe(other.font);
    expect(one.font).not.toBe(DEFAULT_TEXT.font);
  });
});

describe('样式变了要不要重排', () => {
  it('只变了画法的不用', () => {
    expect(
      affectsLayout({ width: 10, backgroundColor: '#fff' }, { width: 10, backgroundColor: '#000' }),
    ).toBe(false);
    expect(affectsLayout({ width: 10 }, { width: 10, opacity: 0.5, borderRadius: 4 })).toBe(false);
  });

  it('尺寸、边距、文字变了、多了少了都要', () => {
    expect(affectsLayout({ width: 10 }, { width: 12 })).toBe(true);
    expect(affectsLayout({}, { padding: 4 })).toBe(true);
    expect(affectsLayout({ gap: 4 }, {})).toBe(true);
    expect(affectsLayout({ color: '#000' }, { color: '#fff' })).toBe(true);
  });
});
