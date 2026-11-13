/**
 * 曲线图：几条随时间变化的线画在一起，共用一把纵轴尺子（从 0 到最大的那个值）。
 * 上面一行图例（每条线的名字和最新的值），左上角标出纵轴的最大值，下面两头标出横轴的起止。
 * 值怎么写成文字跟语言有关，由使用方给 format。
 *
 *   <Chart
 *     series={[{ label: '病例', values: cases, tone: 'signal', fill: true }, { label: '死亡', values: deaths, tone: 'danger' }]}
 *     format={compact} from="第 0 天" to="第 210 天"
 *   />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts, space } from './tokens.ts';

export interface ChartSeries {
  label: string;
  values: readonly number[];
  tone: 'signal' | 'danger' | 'calm' | 'text';
  /** 线下面铺一层淡淡的颜色（最要紧的那条线用） */
  fill?: boolean;
}

export interface ChartProps extends PartProps<'figure'> {
  series: readonly ChartSeries[];
  /** 把一个值写成文字（图例里的最新值、纵轴的最大值） */
  format: (value: number) => string;
  /** 横轴两头的标注 */
  from?: string;
  to?: string;
  /** 图的高度，默认 5rem */
  height?: string;
}

/** 画图用的坐标：宽 100、高 40，实际大小由 CSS 定（线宽不跟着拉伸） */
const WIDTH = 100;
const HEIGHT = 40;

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.xs, margin: 0 },
  legend: { display: 'flex', flexWrap: 'wrap', columnGap: space.md, fontSize: '0.75rem' },
  entry: { display: 'flex', alignItems: 'center', gap: space.xs, color: colors.textMuted },
  swatch: { width: '0.6rem', height: '2px', backgroundColor: 'currentColor' },
  value: { fontFamily: fonts.numeric, fontVariantNumeric: 'tabular-nums', color: colors.text },
  plot: { position: 'relative' },
  svg: { display: 'block', width: '100%', height: '100%', overflow: 'visible' },
  grid: { color: colors.line },
  // 纵轴的最大值压在图的左上角
  max: {
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: 0,
    paddingInline: '0.2rem',
    fontFamily: fonts.numeric,
    fontSize: '0.6875rem',
    color: colors.textMuted,
    backgroundColor: colors.panel,
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: fonts.numeric,
    fontSize: '0.6875rem',
    color: colors.textMuted,
  },
  signal: { color: colors.signal },
  danger: { color: colors.danger },
  calm: { color: colors.calm },
  text: { color: colors.text },
});

const sizes = css.create({
  height: (height: string) => ({ height }),
});

/** 一条线上各点的坐标，写成 polyline 的 points */
function points(values: readonly number[], count: number, max: number): string {
  return values
    .map((value, index) => {
      const x = count > 1 ? (index / (count - 1)) * WIDTH : 0;
      const y = HEIGHT - (max > 0 ? value / max : 0) * HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export const Chart = _component(
  ({ series, format, from, to, height = '5rem', ...rest }: ChartProps) =>
    () => {
      const count = Math.max(2, ...series.map((line) => line.values.length));
      const max = Math.max(0, ...series.flatMap((line) => line.values));
      return (
        <figure {...mergeAttrs<'figure'>({ sx: styles.root }, rest)}>
          <figcaption {...css.attrs(styles.legend)}>
            {series.map((line) => (
              <span key={line.label} {...css.attrs(styles.entry)}>
                <span {...css.attrs(styles.swatch, styles[line.tone])} />
                {line.label}
                <span {...css.attrs(styles.value)}>{format(line.values.at(-1) ?? 0)}</span>
              </span>
            ))}
          </figcaption>
          <div {...css.attrs(styles.plot, sizes.height(height))}>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              {...css.attrs(styles.svg)}
            >
              <g {...css.attrs(styles.grid)}>
                {[0, HEIGHT / 2, HEIGHT].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2={WIDTH}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-dasharray={y === HEIGHT ? undefined : '2 3'}
                    vector-effect="non-scaling-stroke"
                  />
                ))}
              </g>
              {series.map((line) => {
                const path = points(line.values, count, max);
                const end = count > 1 ? ((line.values.length - 1) / (count - 1)) * WIDTH : 0;
                return (
                  <g key={line.label} {...css.attrs(styles[line.tone])}>
                    {line.fill && line.values.length > 1 && (
                      <polygon
                        points={`0,${HEIGHT} ${path} ${end.toFixed(2)},${HEIGHT}`}
                        fill="currentColor"
                        fill-opacity="0.14"
                      />
                    )}
                    <polyline
                      points={path}
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                      vector-effect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>
            <span {...css.attrs(styles.max)}>{format(max)}</span>
          </div>
          {(from || to) && (
            <div {...css.attrs(styles.axis)}>
              <span>{from}</span>
              <span>{to}</span>
            </div>
          )}
        </figure>
      );
    },
);
