/**
 * 面板：压在游戏画面上的一块界面。细线描边，标题是一行小字；给了 onClose 时标题行右边有关闭按钮。
 * 没声明的属性落到根元素上，用 sx 摆位置。
 *
 *   <Frame title="态势">…</Frame>
 *   <Frame title={region.name} onClose={() => (selected = null)}>…</Frame>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface FrameProps extends PartProps<'section', 'title'> {
  /** 面板左上角的小标题 */
  title?: VNodeChild;
  /** 给了它，标题行右边出现关闭按钮 */
  onClose?: () => void;
  /** 关闭按钮的名称（读屏念它），默认“关闭” */
  closeLabel?: string;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    padding: `${space.md} 0.9rem`,
    color: colors.text,
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    backgroundColor: colors.panel,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
    // 游戏画面上的界面层默认不接收指针（点得到下面的地图），面板自己打开
    pointerEvents: 'auto',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: '0.6875rem', letterSpacing: '0.18em', color: colors.textMuted },
  close: {
    // 看上去小，能点的范围不小：负边距把 44px 的按钮收进标题行
    width: '2.75rem',
    height: '2.75rem',
    margin: '-0.9rem -0.8rem -0.9rem 0',
    fontSize: '1rem',
    lineHeight: 1,
    color: { default: colors.textMuted, ':hover': colors.text, ':focus-visible': colors.signal },
    backgroundColor: 'transparent',
    borderWidth: 0,
    outline: 'none',
    cursor: 'pointer',
    transition: `color ${durations.fast}`,
  },
});

export const Frame = _component(
  ({ title, onClose, closeLabel = '关闭', children, ...rest }: FrameProps) =>
    () => (
      <section {...mergeAttrs<'section'>({ sx: styles.root }, rest)}>
        {(title != null || onClose) && (
          <header {...css.attrs(styles.header)}>
            <span {...css.attrs(styles.title)}>{title}</span>
            {onClose && (
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => onClose()}
                {...css.attrs(styles.close)}
              >
                ×
              </button>
            )}
          </header>
        )}
        {children}
      </section>
    ),
);
