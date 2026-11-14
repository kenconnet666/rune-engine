/**
 * 趋势：这一方看得到的病例和死亡随时间的曲线（攻方是真实的，守方是上报的）。
 * 模拟每隔几天记一笔；最后再接上“现在”的数，曲线的末端就跟着每天在动。
 * 病例那条线后面接一段虚线：照最近这一段的势头再走几步会到哪里——只是把眼下的涨跌往前延，不是模拟算出来的。
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

/** 往前延几步（一步是模拟记一笔的间隔） */
const FORECAST_STEPS = 4;
/** 每一步最多涨到几倍、最少跌到几成：最近两笔差得再悬殊，也不把线甩到天上去 */
const MAX_FACTOR = 3;
const MIN_FACTOR = 0.3;

/** 照最近两笔的比例往前延；数据不够、或者眼下是 0 就不延 */
function forecast(values: readonly number[], ceiling: number): number[] {
  const last = values.at(-1) ?? 0;
  const before = values.at(-2) ?? 0;
  if (values.length < 3 || last <= 0 || before <= 0) return [];
  const factor = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, last / before));
  return Array.from({ length: FORECAST_STEPS }, (_, step) =>
    Math.min(ceiling, last * factor ** (step + 1)),
  );
}

export const TrendPanel = _component(({ view }: { view: OutbreakView }) => () => {
  const ui = useUi();
  const format = useFormats();
  const { history, totals, attacker } = view;
  // 最后那一笔“现在”离上一笔可能只隔一两天，拿它算势头会偏：用整笔整笔的记录来算
  const ahead = forecast(history.cases, totals.population);
  return (
    <Frame icon={TrendingUp} title={ui.trend.title} sx={styles.root}>
      <Chart
        series={[
          {
            label: attacker ? ui.status.infections : ui.status.cases,
            values: [...history.cases, totals.cases],
            tone: 'signal',
            fill: true,
            forecast: ahead,
          },
          { label: ui.status.deaths, values: [...history.deaths, totals.deaths], tone: 'danger' },
        ]}
        format={format.compact}
        from={ui.status.day(0)}
        to={
          ahead.length > 0
            ? ui.trend.ahead(view.tick + ahead.length * history.every)
            : ui.status.day(view.tick)
        }
      />
    </Frame>
  );
});
