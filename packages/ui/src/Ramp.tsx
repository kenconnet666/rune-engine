/**
 * 色带图例：一条从低到高的渐变，两头各一个标注——地图上涂的颜色是什么意思。
 *
 *   <Ramp stops={['#1b2530', '#f2a33a', '#e5484d']} low="没有" high="很重" />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts, space } from './tokens.ts';

export interface RampProps extends PartProps<'div'> {
  /** 渐变上的颜色，从低到高（CSS 的颜色） */
  stops: readonly string[];
  low: VNodeChild;
  high: VNodeChild;
  /** 正中间的标注（有“分界线”的色带用，比如传播数等于 1） */
  middle?: VNodeChild;
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: '10rem' },
  bar: {
    height: '0.375rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  labels: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: space.sm,
    fontFamily: fonts.text,
    fontSize: '0.6875rem',
    color: colors.textMuted,
  },
  high: { textAlign: 'end' },
});

const fills = css.create({
  gradient: (gradient: string) => ({ backgroundImage: gradient }),
});

export const Ramp = _component(({ stops, low, high, middle, ...rest }: RampProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: styles.root }, rest)}>
    <div
      {...css.attrs(styles.bar, fills.gradient(`linear-gradient(to right, ${stops.join(', ')})`))}
    />
    <div {...css.attrs(styles.labels)}>
      <span>{low}</span>
      <span>{middle}</span>
      <span {...css.attrs(styles.high)}>{high}</span>
    </div>
  </div>
));
