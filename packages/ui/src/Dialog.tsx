/**
 * 对话框：盖在整个画面上的一大块界面（进化树、研究、设置）。用浏览器原生的 <dialog>：
 * 它自己在最上层、自己管焦点；closedby="any" 让按 Esc、点外面都能关。
 * 渲染出来就是打开的——要关就不再渲染它（onClose 里把状态改掉）。
 *
 *   {open && <Dialog title="进化" onClose={() => (open = false)}>…</Dialog>}
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { X } from 'lucide';
import { onMounted, type VNodeChild } from 'vue';
import { Icon } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { dialogEnter, focusRing, pressable } from './styles.ts';
import { colors, fonts, space } from './tokens.ts';

export interface DialogProps extends PartProps<'dialog', 'title' | 'open'> {
  title: VNodeChild;
  /** 标题右边的东西（比如手里的点数） */
  aside?: VNodeChild;
  onClose: () => void;
  /** 关闭按钮的名称（读屏念它），默认“关闭” */
  closeLabel?: string;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    width: 'min(64rem, calc(100vw - 2rem))',
    maxWidth: 'none',
    height: 'min(42rem, calc(100vh - 2rem))',
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
    // 后面的画面压暗、略微虚化：注意力留在对话框上，又看得出游戏还在
    '::backdrop': { backgroundColor: 'rgba(3, 6, 9, 0.55)', backdropFilter: 'blur(3px)' },
  },
  // dialog 自己的 display 由浏览器管（关着的时候是 none），布局放在里面这一层
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
  ({ title, aside, onClose, closeLabel = '关闭', children, ...rest }: DialogProps) => {
    let element = _state.raw<HTMLDialogElement | null>(null);
    onMounted(() => element?.showModal());
    return () => (
      <dialog
        ref={_toRef(element)}
        {...mergeAttrs<'dialog'>({ sx: [dialogEnter.panel, styles.root] }, rest, {
          // 按 Esc、点对话框外面都算关
          closedby: 'any',
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
    );
  },
);
