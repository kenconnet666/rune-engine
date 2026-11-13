/**
 * 操作按钮：做一件有代价的事。右侧可以放代价或等级这类小字；做不了的时候禁用。
 *
 *   <ActionButton detail="12 点" disabled={points < 12} onPress={evolve}>强化传播</ActionButton>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { colors, fonts } from './tokens.ts';

export interface ActionButtonProps {
  children?: VNodeChild;
  /** 靠右的小字：代价、等级 */
  detail?: VNodeChild;
  disabled?: boolean;
  /** 已经生效的状态（开关类的操作） */
  active?: boolean;
  onPress?: () => void;
}

const styles = css.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    // 触屏上也好按：不低于 44px
    minHeight: '2.75rem',
    paddingBlock: '0.4rem',
    paddingInline: '0.75rem',
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    color: { default: colors.text, ':disabled': colors.textMuted },
    backgroundColor: { default: colors.inset, ':hover:not(:disabled)': colors.insetHover },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: colors.line, ':focus-visible': colors.signal },
    outline: 'none',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    opacity: { default: 1, ':disabled': 0.55 },
    transition: 'background-color 120ms, border-color 120ms',
  },
  active: { borderColor: colors.signal, color: colors.signal },
  detail: { fontFamily: fonts.numeric, fontSize: '0.8125rem', color: colors.textMuted },
});

export const ActionButton = _component(
  ({ children, detail, disabled = false, active = false, onPress }: ActionButtonProps) =>
    () => (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active || undefined}
        onClick={() => onPress?.()}
        {...css.attrs(styles.root, active && styles.active)}
      >
        <span>{children}</span>
        {detail != null && <span {...css.attrs(styles.detail)}>{detail}</span>}
      </button>
    ),
);
