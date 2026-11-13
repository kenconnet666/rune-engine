/**
 * 操作按钮：做一件事。右侧可以放代价或等级这类小字；做不了的时候禁用；开关类的操作用 active 表示已经生效。
 * compact 是只放一个符号的方按钮（缩放的 ＋ －）。没声明的属性落到按钮上。
 *
 *   <ActionButton detail="12 点" disabled={points < 12} onPress={evolve}>强化传播</ActionButton>
 *   <ActionButton compact aria-label="放大" onPress={zoomIn}>＋</ActionButton>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface ActionButtonProps extends PartProps<'button', 'type' | 'aria-pressed'> {
  children?: VNodeChild;
  /** 靠右的小字：代价、等级 */
  detail?: VNodeChild;
  /** 已经生效的状态（开关类的操作） */
  active?: boolean;
  /** 只放一个符号的方按钮 */
  compact?: boolean;
  onPress?: () => void;
}

const styles = css.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    // 触屏上也好按：不低于 44px
    minHeight: '2.75rem',
    paddingBlock: space.sm,
    paddingInline: space.md,
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    textAlign: 'start',
    color: { default: colors.text, ':disabled': colors.textMuted },
    backgroundColor: { default: colors.inset, ':hover:not(:disabled)': colors.insetHover },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: colors.line, ':focus-visible': colors.signal },
    outline: 'none',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    opacity: { default: 1, ':disabled': 0.55 },
    transition: `background-color ${durations.fast}, border-color ${durations.fast}`,
    pointerEvents: 'auto',
  },
  active: { borderColor: colors.signal, color: colors.signal },
  compact: {
    justifyContent: 'center',
    width: '2.75rem',
    paddingInline: 0,
    fontFamily: fonts.numeric,
    fontSize: '1.125rem',
    backgroundColor: { default: colors.panel, ':hover:not(:disabled)': colors.insetHover },
  },
  detail: { fontFamily: fonts.numeric, fontSize: '0.8125rem', color: colors.textMuted },
});

export const ActionButton = _component(
  ({ children, detail, active = false, compact = false, onPress, ...rest }: ActionButtonProps) =>
    () => (
      <button
        {...mergeAttrs<'button'>(
          { sx: [styles.root, compact && styles.compact, active && styles.active] },
          rest,
          { type: 'button', 'aria-pressed': active || undefined, onClick: () => onPress?.() },
        )}
      >
        <span>{children}</span>
        {detail != null && <span {...css.attrs(styles.detail)}>{detail}</span>}
      </button>
    ),
);
