/** 事件表：种类的含义见 sim 的 config.ts（EventKind）；weight 是相对的常见程度 */
import type { EventDef } from '@miwang/sim';

export const EVENTS: readonly EventDef[] = [
  { id: 'festival', kind: 'gathering', weight: 3, days: 10 },
  { id: 'sports', kind: 'gathering', weight: 2, days: 7 },
  { id: 'flood', kind: 'disaster', weight: 2, days: 40 },
  { id: 'earthquake', kind: 'disaster', weight: 1, days: 30 },
  { id: 'rumor', kind: 'rumor', weight: 3, amount: 0.06 },
  { id: 'breakthrough', kind: 'breakthrough', weight: 2, amount: 0.25 },
  { id: 'funding', kind: 'funding', weight: 2, amount: 15 },
  { id: 'mutation', kind: 'mutation', weight: 3, amount: 4 },
];
