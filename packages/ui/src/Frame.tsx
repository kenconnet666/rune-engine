/**
 * 面板：压在游戏画面上的一块界面。细线描边，标题是一行小字；自己不接收指针以外的东西，内容照常交互。
 *
 *   <Frame title="态势">…</Frame>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { colors, fonts } from './tokens.ts';

export interface FrameProps {
  /** 面板左上角的小标题 */
  title?: VNodeChild;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    padding: '0.75rem 0.9rem',
    color: colors.text,
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    backgroundColor: colors.panel,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
    // 游戏画面上的界面默认不接收指针（见客户端的界面层），面板自己打开
    pointerEvents: 'auto',
  },
  title: {
    fontSize: '0.6875rem',
    letterSpacing: '0.18em',
    color: colors.textMuted,
  },
});

export const Frame = _component(({ title, children }: FrameProps) => () => (
  <section {...css.attrs(styles.root)}>
    {title != null && <header {...css.attrs(styles.title)}>{title}</header>}
    {children}
  </section>
));
