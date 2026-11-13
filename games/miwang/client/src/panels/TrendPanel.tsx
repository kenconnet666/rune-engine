/**
 * 趋势：这一方看得到的病例和死亡随时间的曲线（攻方是真实的，守方是上报的）。
 * 模拟每隔几天记一笔；最后再接上“现在”的数，曲线的末端就跟着每天在动。
 */
import type { OutbreakView } from '@miwang/sim';
import { Chart, Frame } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { TrendingUp } from 'lucide';
import { useFormats, useUi } from '../i18n.ts';

const styles = css.create({
  root: { width: '22rem' },
});

export const TrendPanel = _component(({ view }: { view: OutbreakView }) => () => {
  const ui = useUi();
  const format = useFormats();
  const { history, totals, attacker } = view;
  return (
    <Frame icon={TrendingUp} title={ui.trend.title} sx={styles.root}>
      <Chart
        series={[
          {
            label: attacker ? ui.status.infections : ui.status.cases,
            values: [...history.cases, totals.cases],
            tone: 'signal',
            fill: true,
          },
          { label: ui.status.deaths, values: [...history.deaths, totals.deaths], tone: 'danger' },
        ]}
        format={format.compact}
        from={ui.status.day(0)}
        to={ui.status.day(view.tick)}
      />
    </Frame>
  );
});
