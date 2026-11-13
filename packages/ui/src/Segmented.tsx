/**
 * 分段选择：几个互斥的选项排成一行（倍速、视角）。
 *
 *   <Segmented label="倍速" options={[{ value: 1, label: '1×' }, { value: 4, label: '4×' }]} value={speed} onChange={setSpeed} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { colors, fonts } from './tokens.ts';

/** 选项的值 */
export type SegmentedValue = string | number;

export interface SegmentedOption {
  value: SegmentedValue;
  label: VNodeChild;
}

export interface SegmentedProps {
  /** 这组选项是选什么的（读屏念它） */
  label: string;
  options: readonly SegmentedOption[];
  value: SegmentedValue;
  onChange?: (value: SegmentedValue) => void;
}

const styles = css.create({
  root: { display: 'flex', pointerEvents: 'auto' },
  item: {
    minWidth: '2.75rem',
    minHeight: '2.75rem',
    paddingInline: '0.75rem',
    fontFamily: fonts.numeric,
    fontSize: '0.875rem',
    color: colors.textMuted,
    backgroundColor: { default: colors.panel, ':hover': colors.insetHover },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: colors.line, ':focus-visible': colors.signal },
    // 相邻的两项共用一条边
    marginInlineStart: '-1px',
    outline: 'none',
    cursor: 'pointer',
  },
  selected: { color: colors.onSignal, backgroundColor: colors.signal, borderColor: colors.signal },
});

export const Segmented = _component(({ label, options, value, onChange }: SegmentedProps) => () => (
  <div role="group" aria-label={label} {...css.attrs(styles.root)}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange?.(option.value)}
        {...css.attrs(styles.item, option.value === value && styles.selected)}
      >
        {option.label}
      </button>
    ))}
  </div>
));
