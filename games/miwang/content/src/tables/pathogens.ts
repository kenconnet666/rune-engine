/**
 * 病原体档案：一种病原体开局时的底子。现在只有一个“新发病原体”，各项都居中；
 * 用常见传染病的公开资料做的档案（连同科普文字和出处）是路线图阶段 2 的事。
 */
import type { PathogenProfile } from '@miwang/sim';

export const PATHOGENS: readonly PathogenProfile[] = [
  {
    id: 'novel',
    // 一个发病者一天传给 0.26 个人、病程 7 天：没有任何措施时一个人平均传给不到两个人
    base: { air: 0.2, contact: 0.06, severity: 1, lethality: 0.004 },
    incubationDays: 4,
    infectiousDays: 7,
    climate: [0.85, 1, 0.9],
  },
];

export const DEFAULT_PATHOGEN = PATHOGENS[0]!;
