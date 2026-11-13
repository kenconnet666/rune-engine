/**
 * 一行事实：左边是名称，右边是取值。几行排在一起就是一张说明表（地区的人口、邻接数）。
 *
 *   <Fact label="人口" value="1.4 亿" />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts, space } from './tokens.ts';

export interface FactProps extends PartProps<'div'> {
  label: VNodeChild;
  value: VNodeChild;
}

const styles = css.create({
  root: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
    fontSize: '0.8125rem',
  },
  label: { color: colors.textMuted },
  value: { fontFamily: fonts.numeric, fontVariantNumeric: 'tabular-nums', color: colors.text },
});

export const Fact = _component(({ label, value, ...rest }: FactProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: styles.root }, rest)}>
    <span {...css.attrs(styles.label)}>{label}</span>
    <span {...css.attrs(styles.value)}>{value}</span>
  </div>
));
