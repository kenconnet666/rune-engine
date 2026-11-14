import { describe, expect, it } from 'vitest';
import { formatsFor } from './formats.ts';
import { createI18n } from './i18n.ts';

const zh = { title: '态势', day: (n: number) => `第 ${n} 天` };
const en: typeof zh = { title: 'Situation', day: (n) => `Day ${n}` };
const options = { catalogs: { zh, en }, tags: { zh: 'zh-CN', en: 'en' }, fallback: 'zh' } as const;

describe('多语言', () => {
  it('切换语言之后文案和数字的写法都跟着换', () => {
    const i18n = createI18n(options);
    i18n.locale.value = 'zh';
    expect(i18n.messages.value.day(3)).toBe('第 3 天');
    expect(i18n.formats.value.compact(1_400_000_000)).toBe('14亿');
    i18n.locale.value = 'en';
    expect(i18n.messages.value.title).toBe('Situation');
    expect(i18n.messages.value.day(3)).toBe('Day 3');
    expect(i18n.formats.value.compact(1_400_000_000)).toBe('1.4B');
  });

  it('列得出有哪些语言', () => {
    expect(createI18n(options).locales).toEqual(['zh', 'en']);
  });
});

describe('数字与日期的写法', () => {
  it('日期按语言写成长日期，不受时区影响', () => {
    expect(formatsFor('zh-CN').longDate('2026-11-13')).toBe('2026年11月13日');
    expect(formatsFor('en').longDate('2026-11-13')).toBe('November 13, 2026');
  });

  it('百分比不带小数；小额保留一位，不到 1 的留两位', () => {
    const formats = formatsFor('zh-CN');
    expect(formats.percent(0.426)).toBe('43%');
    expect(formats.amount(3)).toBe('3.0');
    expect(formats.amount(0.036)).toBe('0.04');
    expect(formats.amount(-0.5)).toBe('-0.50');
    expect(formats.amount(0)).toBe('0.0');
    expect(formats.whole(12345.6)).toBe('12,346');
  });
});
