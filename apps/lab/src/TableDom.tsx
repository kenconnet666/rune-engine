/**
 * 订单表，网页元素的版本：普通的 div、span，浏览器排版、浏览器画。
 * 和 TableView.tsx 是同一张表、同一份数据、同样的样子，拿来一一对比。
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import {
  byStatus,
  COLORS,
  COLUMNS,
  HEADER_HEIGHT,
  orders,
  ROW_HEIGHT,
  selected,
  type Order,
} from './data';

type Css = Record<string, string | number>;

const root: Css = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  background: COLORS.page,
  color: COLORS.text,
  font: '14px/20px system-ui, sans-serif',
};
const header: Css = {
  display: 'flex',
  flexShrink: 0,
  height: `${HEADER_HEIGHT}px`,
  background: COLORS.header,
  color: COLORS.muted,
  fontWeight: 600,
};
const line: Css = { flexShrink: 0, height: '1px', background: COLORS.line };
const body: Css = { flex: 1, minHeight: 0, overflowY: 'auto' };
const cells: Css[] = COLUMNS.map((column) => ({
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  padding: '0 12px',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  ...(column.width ? { width: `${column.width}px`, flexShrink: 0 } : { flex: 1, minWidth: 0 }),
}));
const rowStyle = (background: string): Css => ({
  display: 'flex',
  height: `${ROW_HEIGHT}px`,
  background,
  cursor: 'pointer',
});
const rows = {
  even: rowStyle(COLORS.rowEven),
  odd: rowStyle(COLORS.rowOdd),
  chosen: rowStyle(COLORS.rowSelected),
};
const badges = byStatus<Css>((background, color) => ({
  display: 'flex',
  alignItems: 'center',
  height: '22px',
  padding: '0 8px',
  borderRadius: '11px',
  background,
  color,
  font: '12px/16px system-ui, sans-serif',
}));

// 指着一行时变色：没选中的行才变（行内样式盖不过它，所以写 !important）
const HOVER = `.lab-row:hover { background: ${COLORS.rowHover} !important; }`;

const Row = _component(({ row, chosen }: { row: Order; chosen: boolean }) => () => (
  <div
    class={chosen ? undefined : 'lab-row'}
    style={chosen ? rows.chosen : row.id % 2 ? rows.odd : rows.even}
    onClick={() => (selected.value = row.id)}
  >
    {COLUMNS.map((column, index) => (
      <div key={column.key} style={cells[index]}>
        {column.key === 'status' ? (
          <div style={badges[row.status]}>
            <span>{row.status}</span>
          </div>
        ) : (
          <span>{String(row[column.key])}</span>
        )}
      </div>
    ))}
  </div>
));

export const TableDom = _component(
  ({ onBody }: { onBody?: (element: HTMLElement | null) => void }) =>
    () => (
      <div style={root}>
        <style>{HOVER}</style>
        <div style={header}>
          {COLUMNS.map((column, index) => (
            <div key={column.key} style={cells[index]}>
              <span>{column.title}</span>
            </div>
          ))}
        </div>
        <div style={line} />
        <div style={body} ref={(element: unknown) => onBody?.(element as HTMLElement | null)}>
          {orders.value.map((row) => (
            <Row key={row.id} row={row} chosen={selected.value === row.id} />
          ))}
        </div>
      </div>
    ),
);
