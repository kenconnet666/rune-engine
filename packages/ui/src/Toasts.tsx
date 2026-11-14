/**
 * 提示条：一摞短消息（“出现了第一例死亡”“措施见效了”），新的在下面冒出来，过一会儿由使用方拿掉。
 * 每条可以点（去看它说的那个地方）。什么时候出现、留多久都是使用方的事，这里只管画。
 * 整摞是一个 aria-live 的区域：新消息读屏会念出来。
 *
 *   <Toasts label="提示" items={[{ id: 1, tone: 'danger', icon: Skull, title: '出现了第一例死亡' }]} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { Icon, type IconData } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { focusRing, pressable } from './styles.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface ToastItem {
  id: string | number;
  title: VNodeChild;
  /** 第二行的小字：具体的数、原因 */
  detail?: VNodeChild;
  icon?: IconData;
  /** 左边那条色带和图标的颜色：signal 要人注意的进展，danger 坏消息，calm 好消息 */
  tone?: 'signal' | 'danger' | 'calm';
  /** 点这一条时做什么（比如地图飞到它说的那个地区） */
  onPress?: () => void;
}

export interface ToastsProps extends PartProps<'div', 'role' | 'aria-live' | 'aria-label'> {
  /** 这一摞是什么（读屏念它） */
  label: string;
  items: readonly ToastItem[];
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.xs, pointerEvents: 'none' },
  item: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    alignItems: 'center',
    columnGap: space.md,
    minWidth: '16rem',
    maxWidth: '26rem',
    paddingBlock: space.sm,
    paddingInline: space.md,
    textAlign: 'start',
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    color: colors.text,
    backgroundColor: { default: colors.raised, ':hover': colors.panel },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
    borderInlineStartWidth: '3px',
    borderInlineStartColor: 'currentColor',
    boxShadow: '0 0.5rem 1.5rem rgba(0, 0, 0, 0.45)',
    pointerEvents: 'auto',
    // 冒出来：从上面滑下一小段、由透明到实
    opacity: { default: 1, '@starting-style': 0 },
    translate: { default: '0 0', '@starting-style': '0 -0.5rem' },
    transitionProperty: 'opacity, translate, background-color',
    transitionDuration: durations.normal,
  },
  signal: { color: colors.signal },
  danger: { color: colors.danger },
  calm: { color: colors.calm },
  text: { display: 'flex', flexDirection: 'column', gap: '0.1rem', color: colors.text },
  detail: { fontFamily: fonts.numeric, fontSize: '0.75rem', color: colors.textMuted },
});

export const Toasts = _component(({ label, items, ...rest }: ToastsProps) => () => (
  <div
    {...mergeAttrs<'div'>({ sx: styles.root }, rest, {
      role: 'log',
      'aria-live': 'polite',
      'aria-label': label,
    })}
  >
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        data-tone={item.tone ?? 'signal'}
        onClick={() => item.onPress?.()}
        {...css.attrs(
          focusRing.visible,
          pressable.root,
          styles.item,
          styles[item.tone ?? 'signal'],
        )}
      >
        {item.icon ? <Icon icon={item.icon} size="1.25rem" /> : <span />}
        <span {...css.attrs(styles.text)}>
          <span>{item.title}</span>
          {item.detail != null && <span {...css.attrs(styles.detail)}>{item.detail}</span>}
        </span>
      </button>
    ))}
  </div>
));
