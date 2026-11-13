import { CalendarDate, parseDate } from '@internationalized/date';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  compareNumeric,
  dateAtTick,
  dateToText,
  fromWire,
  numericText,
  toDecimal,
  toWire,
} from './index.ts';

describe('数值：number、bigint、Decimal 混着用', () => {
  it('不同类型按大小比较，Decimal 不丢精度', () => {
    expect(compareNumeric(new Decimal('1.5'), 1.25)).toBe(1);
    expect(compareNumeric(10n, 10)).toBe(0);
    expect(compareNumeric(new Decimal('0.1').plus('0.2'), new Decimal('0.3'))).toBe(0);
    expect(compareNumeric(2n ** 70n, new Decimal('1e21'))).toBe(1);
  });

  it('写成十进制文本时不用科学计数法', () => {
    expect(numericText(1e21)).toBe('1000000000000000000000');
    expect(numericText(new Decimal('1e-9'))).toBe('0.000000001');
    expect(numericText(7_800_000_000n)).toBe('7800000000');
    expect(toDecimal(0.1).plus(toDecimal(0.2)).toString()).toBe('0.3');
  });
});

describe('日期：只由步数决定', () => {
  it('从开始那天往后数，跨月跨年都对', () => {
    const start = parseDate('2026-11-13');
    expect(dateToText(dateAtTick(start, 0))).toBe('2026-11-13');
    expect(dateToText(dateAtTick(start, 49))).toBe('2027-01-01');
    expect(dateToText(dateAtTick(start, 9, 4))).toBe('2026-11-15');
  });
});

describe('过线的格式', () => {
  it('Decimal、bigint、日期经 JSON 一来一回不变，数值数组原样通过', () => {
    const numbers = new Float32Array([1, 2, 3]);
    const value = {
      cost: new Decimal('12.50'),
      population: 7_800_000_000n,
      day: parseDate('2026-11-13'),
      list: [new Decimal('0.1'), 2, 'x'],
      numbers,
    };
    const wire = toWire(value) as Record<string, unknown>;
    expect(wire.numbers).toBe(numbers);
    const { numbers: _skip, ...json } = wire;
    const back = fromWire(JSON.parse(JSON.stringify(json))) as typeof value;
    expect(back.cost.equals(value.cost)).toBe(true);
    expect(back.population).toBe(value.population);
    expect(back.day).toBeInstanceOf(CalendarDate);
    expect(back.day.compare(value.day)).toBe(0);
    expect((back.list[0] as Decimal).toString()).toBe('0.1');
  });
});
