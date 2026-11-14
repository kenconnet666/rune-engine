import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { colors } from '@rune-engine/components/tokens';
import { BarChart } from '@rune-engine/components/charts';

const months = [
  { month: '7月', income: 82, expense: 64 },
  { month: '8月', income: 95, expense: 71 },
  { month: '9月', income: 88, expense: 93 },
  { month: '10月', income: 104, expense: 76 },
];

export default _component(() => () => (
  <BarChart
    aria-label="月度收支"
    data={months}
    index="month"
    series={[
      { key: 'income', label: '收入', color: 'chart7' },
      { key: 'expense', label: '支出', color: colors.danger },
    ]}
    unit="万元"
  />
));
