/**
 * 提示：指针停在一样东西上（或者键盘聚焦、触屏长按）时，旁边浮出的一小段说明。
 * 全靠浏览器自己：触发的元素写 interestfor 指向提示的 id，提示是一个 popover="hint"，
 * 位置用 CSS 的锚点定位贴在触发元素上方（放不下就翻到下方）。不用写任何事件处理。
 * 图块、操作按钮自带 tip 属性，一般不用直接用它；别的元素要提示时这样写：
 *
 *   const id = useId();
 *   <span interestfor={id}>…</span>
 *   <Tip id={id}>说明</Tip>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface TipProps extends PartProps<'div', 'popover'> {
  /** 触发它的元素用 interestfor 指向这个 id */
  id: string;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    // 去掉 popover 默认的居中摆法，改成贴着触发它的元素
    inset: 'auto',
    margin: space.sm,
    positionArea: 'block-start',
    positionTryFallbacks: 'flip-block',
    maxWidth: '18rem',
    paddingBlock: space.sm,
    paddingInline: space.md,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    textAlign: 'start',
    color: colors.text,
    backgroundColor: colors.raised,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.lineStrong,
    boxShadow: '0 0.5rem 1.5rem rgba(0, 0, 0, 0.45)',
    // 提示只是给人看的：不挡住下面的东西
    pointerEvents: 'none',
    opacity: { default: 0, ':popover-open': { default: 1, '@starting-style': 0 } },
    transition: `opacity ${durations.fast}, display ${durations.fast} allow-discrete, overlay ${durations.fast} allow-discrete`,
  },
});

export const Tip = _component(({ id, children, ...rest }: TipProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: styles.root }, rest, { id, popover: 'hint' })}>{children}</div>
));
