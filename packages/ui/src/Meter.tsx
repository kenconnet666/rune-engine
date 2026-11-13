/**
 * 量条：一个 0–1 之间的程度，带标签和右侧的数字。伸缩有过渡；读屏念成“标签，百分之几”。
 *
 *   <Meter label="感染程度" value={0.42} detail="42%" tone="danger" />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface MeterProps extends PartProps<'div', 'role'> {
  /** 量的是什么（也是读屏念的名称） */
  label: string;
  /** 0–1；超出的按两头算 */
  value: number;
  /** 右侧的数字（已经格式化好） */
  detail?: VNodeChild;
  tone?: 'signal' | 'danger' | 'calm';
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.xs },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' },
  label: { color: colors.textMuted },
  detail: { fontFamily: fonts.numeric, fontVariantNumeric: 'tabular-nums', color: colors.text },
  track: { height: '0.3125rem', backgroundColor: colors.inset, overflow: 'hidden' },
  fill: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left center',
    backgroundColor: colors.text,
    transition: `transform ${durations.normal} ease-out`,
  },
  signal: { backgroundColor: colors.signal },
  danger: { backgroundColor: colors.danger },
  calm: { backgroundColor: colors.calm },
});

// 随数值变的那一条单独放：它是动态样式
const fills = css.create({
  at: (ratio: number) => ({ transform: `scaleX(${ratio})` }),
});

export const Meter = _component(({ label, value, detail, tone, ...rest }: MeterProps) => () => {
  const ratio = Math.min(1, Math.max(0, value));
  return (
    <div
      {...mergeAttrs<'div'>({ sx: styles.root }, rest, {
        role: 'meter',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(ratio * 100),
      })}
    >
      <div {...css.attrs(styles.row)}>
        <span {...css.attrs(styles.label)}>{label}</span>
        {detail != null && <span {...css.attrs(styles.detail)}>{detail}</span>}
      </div>
      <div {...css.attrs(styles.track)}>
        <div {...css.attrs(styles.fill, tone && styles[tone], fills.at(ratio))} />
      </div>
    </div>
  );
});
