/**
 * 滑块：在一个范围里调一个数（音量）。用浏览器原生的滑块，键盘、触屏、读屏都是现成的，只换了颜色。
 * 上面一行是名字和当前的值（怎么写成文字由使用方给 format）。
 *
 *   <Slider label="音乐" value={volume} onChange={setVolume} format={(value) => `${Math.round(value * 100)}%`} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { mergeAttrs, type PartProps } from './props.ts';
import { focusRing } from './styles.ts';
import { colors, fonts, space } from './tokens.ts';

export interface SliderProps extends PartProps<'label', 'onChange'> {
  label: string;
  value: number;
  /** 范围和步长，默认 0 到 1、每步 0.05 */
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  /** 把当前的值写成文字；不给就不显示 */
  format?: (value: number) => string;
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.xs, pointerEvents: 'auto' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' },
  label: { color: colors.text },
  value: { fontFamily: fonts.numeric, fontVariantNumeric: 'tabular-nums', color: colors.textMuted },
  input: {
    width: '100%',
    // 触屏上也好拖：把手所在的那一条不低于 28px
    height: '1.75rem',
    margin: 0,
    accentColor: colors.signal,
    cursor: 'pointer',
  },
});

export const Slider = _component(
  ({ label, value, min = 0, max = 1, step = 0.05, onChange, format, ...rest }: SliderProps) =>
    () => (
      <label {...mergeAttrs<'label'>({ sx: styles.root }, rest)}>
        <span {...css.attrs(styles.row)}>
          <span {...css.attrs(styles.label)}>{label}</span>
          {format && <span {...css.attrs(styles.value)}>{format(value)}</span>}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={(event: Event) => onChange?.(Number((event.target as HTMLInputElement).value))}
          {...css.attrs(focusRing.visible, styles.input)}
        />
      </label>
    ),
);
