/**
 * 操作按钮：做一件事。右侧可以放代价或等级这类小字；做不了的时候禁用；开关类的操作用 active 表示已经生效。
 * compact 是只放一个符号的方按钮（缩放的 ＋ －）。没声明的属性落到按钮上。
 *
 *   <ActionButton detail="12 点" disabled={points < 12} onPress={evolve}>强化传播</ActionButton>
 *   <ActionButton compact icon={Plus} aria-label="放大" onPress={zoomIn} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { useId, type VNodeChild } from 'vue';
import { Icon, type IconData } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { ripple, rippleHost } from './ripple.ts';
import { focusRing, pressable } from './styles.ts';
import { Tip } from './Tip.tsx';
import { colors, fonts, space } from './tokens.ts';

export interface ActionButtonProps extends PartProps<'button', 'type' | 'aria-pressed'> {
  children?: VNodeChild;
  /** 文字前面的图标；compact 的按钮只放图标时不用写 children */
  icon?: IconData;
  /** 指针停在上面时浮出的说明（只有图标的按钮用它说明自己是干什么的） */
  tip?: VNodeChild;
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
    borderColor: { default: colors.line, ':hover:not(:disabled)': colors.lineStrong },
    pointerEvents: 'auto',
  },
  active: {
    color: colors.signal,
    borderColor: { default: colors.signal, ':hover:not(:disabled)': colors.signal },
    backgroundColor: { default: colors.signalFaint, ':hover:not(:disabled)': colors.signalFaint },
  },
  compact: {
    justifyContent: 'center',
    width: '2.75rem',
    paddingInline: 0,
    fontFamily: fonts.numeric,
    fontSize: '1.125rem',
    backgroundColor: { default: colors.panel, ':hover:not(:disabled)': colors.insetHover },
  },
  // 文字占满中间：图标靠左、小字靠右
  label: { flexGrow: 1, minWidth: 0 },
  detail: { fontFamily: fonts.numeric, fontSize: '0.8125rem', color: colors.textMuted },
});

export const ActionButton = _component(
  ({
    children,
    icon,
    tip,
    detail,
    active = false,
    compact = false,
    onPress,
    ...rest
  }: ActionButtonProps) => {
    const tipId = useId();
    return () => (
      <>
        <button
          {...mergeAttrs<'button'>(
            {
              sx: [
                rippleHost.root,
                focusRing.visible,
                pressable.root,
                styles.root,
                compact && styles.compact,
                active && styles.active,
              ],
            },
            rest,
            {
              type: 'button',
              'aria-pressed': active || undefined,
              onClick: () => onPress?.(),
              ...ripple,
              ...(tip != null && { interestfor: tipId }),
            },
          )}
        >
          {icon && <Icon icon={icon} />}
          {children != null && <span {...css.attrs(styles.label)}>{children}</span>}
          {detail != null && <span {...css.attrs(styles.detail)}>{detail}</span>}
        </button>
        {tip != null && <Tip id={tipId}>{tip}</Tip>}
      </>
    );
  },
);
