/**
 * 提示：指针停在一样东西上（或者键盘聚焦到它）时，旁边浮出的一小段说明。
 * 气泡的内容传送到舞台的 tips 层里（在所有界面的上面）；什么时候出现、摆在哪由舞台统一管（tips.ts）。
 * 不用浏览器的 popover：那在页面“顶层”，画不进画布。
 * 图块、操作按钮自带 tip 属性，一般不用直接用它；别的元素要提示时这样写：
 *
 *   const id = useId();
 *   <span data-tip={id} aria-describedby={id}>…</span>
 *   <Tip id={id}>说明</Tip>
 *
 * 不在舞台里时没有气泡（说明还在，读屏照样念得到）。
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Teleport, type VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { useStage } from './stage-context.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface TipProps extends PartProps<'div', 'role'> {
  /** 触发它的元素用 data-tip 和 aria-describedby 指向这个 id */
  id: string;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: 0,
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
    // 没出来的时候占着位置但看不见：出现之前要量它的大小
    visibility: { default: 'hidden', '[data-open]': 'visible' },
    opacity: { default: 0, '[data-open]': 1 },
    transition: `opacity ${durations.fast}`,
  },
});

export const Tip = _component(({ id, children, ...rest }: TipProps) => {
  const stage = useStage();
  return () => {
    const host = stage?.layers.tips.value;
    const tip = (
      <div {...mergeAttrs<'div'>({ sx: styles.root }, rest, { id, role: 'tooltip' })}>
        {children}
      </div>
    );
    return host ? <Teleport to={host}>{tip}</Teleport> : null;
  };
});
