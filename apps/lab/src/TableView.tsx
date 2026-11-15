/**
 * 订单表，自己画的版本：节点是 view 包的 View / Text，排版、命中、画都是我们自己的。
 * 和 TableDom.tsx 是同一张表、同一份数据、同样的样子，拿来一一对比。
 */
import { Text, View, type ViewNode, type ViewStyle } from '@rune-engine/view';
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

// 样式都是事先建好的几份、大家共用：两万行不用建两万份样式，也认得出“没变”
const root: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.page,
  color: COLORS.text,
  fontSize: 14,
  lineHeight: 20,
};
const header: ViewStyle = {
  flexDirection: 'row',
  height: HEADER_HEIGHT,
  backgroundColor: COLORS.header,
  color: COLORS.muted,
  fontWeight: 600,
};
const line: ViewStyle = { height: 1, backgroundColor: COLORS.line };
const body: ViewStyle = { flex: 1, overflow: 'scroll' };
const cells: ViewStyle[] = COLUMNS.map((column) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingInline: 12,
  overflow: 'hidden',
  ...(column.width ? { width: column.width } : { flex: 1 }),
}));
const rowStyle = (backgroundColor: string, hover = true): ViewStyle => ({
  flexDirection: 'row',
  height: ROW_HEIGHT,
  backgroundColor,
  cursor: 'pointer',
  hover: hover ? { backgroundColor: COLORS.rowHover } : undefined,
});
const rows = {
  even: rowStyle(COLORS.rowEven),
  odd: rowStyle(COLORS.rowOdd),
  chosen: rowStyle(COLORS.rowSelected, false),
};
const badges = byStatus<ViewStyle>((backgroundColor, color) => ({
  flexDirection: 'row',
  alignItems: 'center',
  height: 22,
  paddingInline: 8,
  borderRadius: 11,
  backgroundColor,
  color,
  fontSize: 12,
  lineHeight: 16,
}));

const Row = _component(({ row, chosen }: { row: Order; chosen: boolean }) => () => (
  <View
    style={chosen ? rows.chosen : row.id % 2 ? rows.odd : rows.even}
    onClick={() => (selected.value = row.id)}
  >
    {COLUMNS.map((column, index) => (
      <View key={column.key} style={cells[index]}>
        {column.key === 'status' ? (
          <View style={badges[row.status]}>
            <Text>{row.status}</Text>
          </View>
        ) : (
          <Text>{String(row[column.key])}</Text>
        )}
      </View>
    ))}
  </View>
));

export const TableView = _component(
  ({ onBody }: { onBody?: (node: ViewNode | null) => void }) =>
    () => (
      <View style={root}>
        <View style={header}>
          {COLUMNS.map((column, index) => (
            <View key={column.key} style={cells[index]}>
              <Text>{column.title}</Text>
            </View>
          ))}
        </View>
        <View style={line} />
        <View style={body} ref={(node: unknown) => onBody?.(node as ViewNode | null)}>
          {orders.value.map((row) => (
            <Row key={row.id} row={row} chosen={selected.value === row.id} />
          ))}
        </View>
      </View>
    ),
);
