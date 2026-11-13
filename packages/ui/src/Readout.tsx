/**
 * 读数：一个标签加一个数字。数字用等宽数字，位数变化时左右不抖。
 *
 *   <Readout label="病例" value="12.4 万" tone="signal" />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts } from './tokens.ts';

export interface ReadoutProps extends PartProps<'div'> {
  label: VNodeChild;
  /** 已经格式化好的数字（格式化跟语言有关，由使用方做） */
  value: VNodeChild;
  /** 数字的颜色：默认是正文色；signal 是这块面板里最要紧的那个，danger 是坏消息 */
  tone?: 'signal' | 'danger' | 'calm';
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: '4.5rem' },
  label: { fontSize: '0.6875rem', letterSpacing: '0.08em', color: colors.textMuted },
  value: {
    fontFamily: fonts.numeric,
    fontSize: '1.375rem',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
    color: colors.text,
  },
  signal: { color: colors.signal },
  danger: { color: colors.danger },
  calm: { color: colors.calm },
});

export const Readout = _component(({ label, value, tone, ...rest }: ReadoutProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: styles.root }, rest)}>
    <span {...css.attrs(styles.label)}>{label}</span>
    <span {...css.attrs(styles.value, tone && styles[tone])}>{value}</span>
  </div>
));
