/**
 * 说明小字：面板里解释一件事的一两句话，或者“这里还没有内容”的空状态。
 *
 *   <Note>还没有地区上报病例。</Note>
 *   <Note tone="danger">画面断了，正在恢复。</Note>
 *   <Note icon={Syringe} tone="signal">疫苗开始接种。</Note>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Icon, type IconData } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts, space } from './tokens.ts';

export interface NoteProps extends PartProps<'p'> {
  /** 默认是不抢眼的灰；danger 用在出错、警示，signal 用在要人注意的进展 */
  tone?: 'muted' | 'danger' | 'signal';
  /** 开头的小图标 */
  icon?: IconData;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    margin: 0,
    fontFamily: fonts.text,
    fontSize: '0.75rem',
    lineHeight: 1.5,
    color: colors.textMuted,
  },
  danger: { color: colors.danger },
  signal: { color: colors.signal },
  // 带图标时图标和文字的第一行对齐，文字折行后不绕到图标下面
  withIcon: { display: 'flex', alignItems: 'start', gap: space.sm },
  icon: { marginBlockStart: '0.15em' },
});

export const Note = _component(({ tone = 'muted', icon, children, ...rest }: NoteProps) => () => (
  <p
    {...mergeAttrs<'p'>(
      {
        sx: [
          styles.root,
          tone === 'danger' && styles.danger,
          tone === 'signal' && styles.signal,
          icon && styles.withIcon,
        ],
      },
      rest,
    )}
  >
    {icon && <Icon icon={icon} size="0.9375rem" sx={styles.icon} />}
    {icon ? <span>{children}</span> : children}
  </p>
));
