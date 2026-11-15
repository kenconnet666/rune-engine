/** 表格的数据：一张订单表。两种落地（网页元素、自己画）用的是同一份 */
import { shallowRef } from 'vue';

export interface Order {
  readonly id: number;
  readonly code: string;
  readonly customer: string;
  readonly city: string;
  readonly amount: string;
  readonly status: Status;
  readonly note: string;
}

export type Status = '待付款' | '备货中' | '已发货' | '已完成' | '已退款';

export interface Column {
  readonly key: keyof Order;
  readonly title: string;
  /** 列宽（像素）；没写的那一列占掉剩下的 */
  readonly width?: number;
}

export const COLUMNS: readonly Column[] = [
  { key: 'id', title: '序号', width: 70 },
  { key: 'code', title: '单号', width: 130 },
  { key: 'customer', title: '客户', width: 110 },
  { key: 'city', title: '城市', width: 80 },
  { key: 'amount', title: '金额', width: 110 },
  { key: 'status', title: '状态', width: 90 },
  { key: 'note', title: '备注' },
];

export const ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 40;

/** 状态的颜色：[底色, 字的颜色] */
export const STATUS_COLORS: Record<Status, readonly [string, string]> = {
  待付款: ['#3a2a10', '#f5a524'],
  备货中: ['#14284a', '#6aa5ff'],
  已发货: ['#1d2247', '#9aa2ff'],
  已完成: ['#12301f', '#4cc38a'],
  已退款: ['#3a1618', '#ff6369'],
};

/** 每种状态做一份东西（样式）：两种落地各自拿状态的颜色做自己的样式 */
export function byStatus<T>(make: (background: string, color: string) => T): Record<Status, T> {
  const made = {} as Record<Status, T>;
  for (const status of Object.keys(STATUS_COLORS) as Status[]) {
    made[status] = make(...STATUS_COLORS[status]);
  }
  return made;
}

export const COLORS = {
  page: '#17181c',
  header: '#1f2026',
  rowEven: '#17181c',
  rowOdd: '#1b1c21',
  rowHover: '#252838',
  rowSelected: '#2b3a67',
  line: '#2a2b31',
  text: '#e6e6e6',
  muted: '#9a9ca5',
} as const;

const STATUSES: readonly Status[] = ['待付款', '备货中', '已发货', '已完成', '已退款'];
const CUSTOMERS = [
  '林小满',
  '周一航',
  '陈默',
  '许悠',
  '王晴',
  '赵浩然',
  '孙思远',
  '李雨桐',
  'Acme Ltd',
  'Globex',
];
const CITIES = ['上海', '北京', '杭州', '深圳', '成都', '武汉', '南京', '西安'];
const NOTES = [
  '加急',
  '周末不收货',
  '需要发票',
  'fragile · handle with care',
  '到付',
  '老客户',
  '',
  '',
  '',
];

/** 定了种子的随机数：两种落地、每次打开都是同一份数据 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}
const random = seeded(20261115);
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;

function order(id: number): Order {
  return {
    id,
    code: `SO${100000 + id}`,
    customer: pick(CUSTOMERS),
    city: pick(CITIES),
    amount: `¥${(random() * 9000 + 10).toFixed(2)}`,
    status: pick(STATUSES),
    note: pick(NOTES),
  };
}

export const orders = shallowRef<readonly Order[]>([]);
export const selected = shallowRef<number | null>(null);

export function load(count: number): void {
  orders.value = Array.from({ length: count }, (_, index) => order(index + 1));
}

/** 改一批：前 400 行里随机 200 格换内容（金额、备注、状态轮着改） */
export function shuffle(): void {
  const next = orders.value.slice();
  const limit = Math.min(next.length, 400);
  for (let index = 0; index < 200; index++) {
    const at = Math.floor(random() * limit);
    const row = next[at]!;
    next[at] =
      index % 3 === 0
        ? { ...row, amount: `¥${(random() * 9000 + 10).toFixed(2)}` }
        : index % 3 === 1
          ? { ...row, note: pick(NOTES) || '改过' }
          : { ...row, status: pick(STATUSES) };
  }
  orders.value = next;
}
