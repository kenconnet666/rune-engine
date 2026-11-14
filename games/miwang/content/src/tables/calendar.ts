/**
 * 日程表：每年固定日子到来、提前预告的事（规则见 sim 的 rules/calendar.ts）。
 * day 是一年里的第几天（0 起：1 月 1 日是 0），days 是持续几天，notice 是提前几天预告，
 * amount 是幅度：出行高峰是各条路线的出行量多几成，雨季是热带的水源、蚊媒传播强几成，
 * 国际赛事是全世界坐飞机的出行量多几成（主办地另有一场集会）。
 */
import type { CalendarDef } from '@miwang/sim';

export const CALENDAR: readonly CalendarDef[] = [
  // 年初的返乡潮：一月下旬起三周多
  { id: 'homecoming', kind: 'travel', day: 20, days: 24, notice: 14, amount: 0.4 },
  // 雨季：六月中到八月底
  { id: 'monsoon', kind: 'rains', day: 165, days: 75, notice: 14, amount: 0.25 },
  // 暑期出行：七月中起一个月
  { id: 'summerTravel', kind: 'travel', day: 196, days: 30, notice: 14, amount: 0.25 },
  // 国际赛事：七月下旬起两周多；在哪里办提前一个月就知道
  { id: 'games', kind: 'games', day: 204, days: 16, notice: 30, amount: 0.2 },
  // 年末的假期：十二月中旬起三周，跨到新年
  { id: 'yearEnd', kind: 'travel', day: 349, days: 21, notice: 14, amount: 0.3 },
];
