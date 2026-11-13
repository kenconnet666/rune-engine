/**
 * 分段选择：几个互斥的选项排成一行（倍速、视角）。没声明的属性落到外层上。
 *
 *   <Segmented label="倍速" options={[{ value: 1, label: '1×' }, { value: 4, label: '4×' }]} value={speed} onChange={setSpeed} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { ripple, rippleHost } from './ripple.ts';
import { focusRing, pressable } from './styles.ts';
import { colors, fonts } from './tokens.ts';

/** 选项的值 */
export type SegmentedValue = string | number;

export interface SegmentedOption {
  value: SegmentedValue;
  label: VNodeChild;
  /** 选项只放了图标时，给读屏和悬停提示用的名字 */
  name?: string;
}

export interface SegmentedProps extends PartProps<'div', 'role' | 'aria-label' | 'onChange'> {
  /** 这组选项是选什么的（读屏念它） */
  label: string;
  options: readonly SegmentedOption[];
  value: SegmentedValue;
  onChange?: (value: SegmentedValue) => void;
}

const styles = css.create({
  root: { display: 'flex', pointerEvents: 'auto' },
  item: {
    display: 'grid',
    placeItems: 'center',
    minWidth: '2.75rem',
    minHeight: '2.75rem',
    paddingInline: '0.75rem',
    fontFamily: fonts.numeric,
    fontSize: '0.875rem',
    color: { default: colors.textMuted, ':hover': colors.text },
    backgroundColor: { default: colors.panel, ':hover': colors.insetHover },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
    // 相邻的两项共用一条边
    marginInlineStart: '-1px',
  },
  selected: {
    color: { default: colors.onSignal, ':hover': colors.onSignal },
    backgroundColor: { default: colors.signal, ':hover': colors.signal },
    borderColor: colors.signal,
    // 选中的那项压在邻居的边上，四条边都是信号色
    zIndex: 1,
  },
});

export const Segmented = _component(
  ({ label, options, value, onChange, ...rest }: SegmentedProps) =>
    () => (
      <div
        {...mergeAttrs<'div'>({ sx: styles.root }, rest, { role: 'group', 'aria-label': label })}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            aria-label={option.name}
            title={option.name}
            onClick={() => onChange?.(option.value)}
            {...ripple}
            {...css.attrs(
              rippleHost.root,
              focusRing.inset,
              pressable.root,
              styles.item,
              option.value === value && styles.selected,
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
);
