/**
 * 模拟里的日期：用 @internationalized/date 的日历日期（没有时区、没有时刻），不碰系统时间。
 * 一局从某一天开始，第几步是哪一天只由步数决定，所以两端算出来的日期一定相同。
 */
import { parseDate, type CalendarDate } from '@internationalized/date';

/** 从 start 那天开始，第 tick 步是哪一天（默认一步一天） */
export function dateAtTick(start: CalendarDate, tick: number, ticksPerDay = 1): CalendarDate {
  return start.add({ days: Math.floor(tick / ticksPerDay) });
}

/** 'YYYY-MM-DD' ↔ 日历日期：配置、存档里日期写成这种文本 */
export const dateFromText = (text: string): CalendarDate => parseDate(text);
export const dateToText = (date: CalendarDate): string => date.toString();
