/**
 * 对话框：盖在整个画面上的一大块界面（进化树、研究、设置）。
 * 它在舞台上自己占一层：一层压暗的底，中间是对话框。按 Esc、点外面、点关闭按钮都能关。
 * 用的是 <dialog> 元素（读屏认得它），但不走浏览器的模态“顶层”——那一层画不进画布；
 * 模态该有的几件事由舞台的弹层宿主做：打开时下面的界面不再响应操作，焦点进到对话框里，关了回到原来的地方。
 * 对话框里再开对话框也行：后开的在上面，Esc 一次关一个。
 * 渲染出来就是打开的——要关就不再渲染它（onClose 里把状态改掉）。不在舞台里时只是一块普通的界面。
 *
 *   {open && <Dialog title="进化" onClose={() => (open = false)}>…</Dialog>}
 *
 * 界面画在画布里时，对话框是一块块“显现”出来的（贴它那一层的时候过的效果，见 StageLayer 的 enter）；
 * 想换一种出现的样子就传 enter。
 */
import { StageLayer, useStage, type UiMaterial } from '@rune-engine/stage';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { X } from 'lucide';
import type { VNodeChild } from 'vue';
import { Icon } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { focusRing, pressable } from './styles.ts';
import { colors, fonts, space } from './tokens.ts';

export interface DialogProps extends PartProps<'dialog', 'title' | 'open'> {
  title: VNodeChild;
  /** 标题右边的东西（比如手里的点数） */
  aside?: VNodeChild;
  onClose: () => void;
  /** 关闭按钮的名称（读屏念它），默认“关闭” */
  closeLabel?: string;
  /**
   * 界面画在画布里时它怎么出现：它那一层先是这个样子，再过渡回原样。默认是一块块显现（{ reveal: 0 }）；
   * 比如 { opacity: 0, scale: 1.06 } 是从大一点的地方淡进来
   */
  enter?: Partial<UiMaterial>;
  children?: VNodeChild;
}

/** 对话框出现用多久（毫秒） */
const ENTER_MS = 260;
/** 默认的出现：一块块显现 */
const REVEAL: Partial<UiMaterial> = { reveal: 0 };

const enter = css.keyframes({
  from: { opacity: 0, scale: 0.97 },
  to: { opacity: 1, scale: 1 },
});

const styles = css.create({
  // 压暗的底：铺满这一层，挡住下面的操作；对话框在正中
  scrim: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: 'rgba(3, 6, 9, 0.6)',
    pointerEvents: 'auto',
  },
  root: {
    // <dialog> 自带的绝对定位、外边距去掉：位置由外面那层的网格定
    position: 'static',
    margin: 0,
    width: 'min(64rem, calc(100% - 2rem))',
    maxWidth: 'none',
    height: 'min(42rem, calc(100% - 2rem))',
    maxHeight: 'none',
    padding: 0,
    color: colors.text,
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    backgroundColor: colors.raised,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.lineStrong,
    boxShadow: '0 1.5rem 4rem rgba(0, 0, 0, 0.55)',
    outline: 'none',
  },
  // 界面叠在画布上面时的进场：淡入、从小一点放大。画在画布里时不用它——进场交给贴那一层的效果，
  // 而且网页这头的动画会让整层一帧帧地重拍
  entering: {
    animationName: enter,
    animationDuration: `${ENTER_MS}ms`,
    animationTimingFunction: 'ease-out',
  },
  body: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    paddingBlock: space.sm,
    paddingInline: space.lg,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  title: { flexGrow: 1, fontSize: '0.75rem', letterSpacing: '0.2em', color: colors.textMuted },
  close: {
    display: 'grid',
    placeItems: 'center',
    width: '2.75rem',
    height: '2.75rem',
    marginInlineEnd: `calc(${space.md} * -1)`,
    color: { default: colors.textMuted, ':hover': colors.text },
    backgroundColor: { default: 'transparent', ':hover': colors.inset },
    borderWidth: 0,
  },
  content: { flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
});

export const Dialog = _component(
  ({ title, aside, onClose, closeLabel = '关闭', enter, children, ...rest }: DialogProps) => {
    const stage = useStage();
    let element = _state.raw<HTMLDialogElement | null>(null);
    /** 打开的那一刻界面在不在画布里：定了用哪一种进场 */
    const inCanvas = stage?.inCanvas === true;

    return () => (
      <StageLayer
        // 压暗的底不算对话框里面：点它就是点外面
        overlay={{
          modal: true,
          outside: true,
          content: () => element,
          onDismiss: () => element?.close(),
        }}
        enter={{ from: enter ?? REVEAL, ms: ENTER_MS }}
      >
        <div {...css.attrs(styles.scrim)}>
          <dialog
            ref={_toRef(element)}
            {...mergeAttrs<'dialog'>({ sx: [styles.root, !inCanvas && styles.entering] }, rest, {
              open: true,
              tabindex: -1,
              // 元素自己的 close()（关闭按钮、Esc、测试脚本）都走这里
              onClose: () => onClose(),
            } as Partial<PartProps<'dialog'>>)}
          >
            <div {...css.attrs(styles.body)}>
              <header {...css.attrs(styles.header)}>
                <span {...css.attrs(styles.title)}>{title}</span>
                {aside}
                <button
                  type="button"
                  aria-label={closeLabel}
                  onClick={() => element?.close()}
                  {...css.attrs(focusRing.inset, pressable.root, styles.close)}
                >
                  <Icon icon={X} />
                </button>
              </header>
              <div {...css.attrs(styles.content)}>{children}</div>
            </div>
          </dialog>
        </div>
      </StageLayer>
    );
  },
);
