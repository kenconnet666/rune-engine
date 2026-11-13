/**
 * 说明小字：面板里解释一件事的一两句话，或者“这里还没有内容”的空状态。
 *
 *   <Note>还没有地区上报病例。</Note>
 *   <Note tone="danger">画面断了，正在恢复。</Note>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts } from './tokens.ts';

export interface NoteProps extends PartProps<'p'> {
  /** 默认是不抢眼的灰；danger 用在出错、警示，signal 用在要人注意的进展 */
  tone?: 'muted' | 'danger' | 'signal';
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
});

export const Note = _component(({ tone = 'muted', children, ...rest }: NoteProps) => () => (
  <p
    {...mergeAttrs<'p'>(
      { sx: [styles.root, tone === 'danger' && styles.danger, tone === 'signal' && styles.signal] },
      rest,
    )}
  >
    {children}
  </p>
));
