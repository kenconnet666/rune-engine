/**
 * 标注：跟着画面上的一个点走的小提示（指针停在地图的一个地区上时显示它的名字）。
 * 放在一个铺满画面的定位容器里，x、y 是那个点在容器里的坐标（CSS 像素）；提示显示在点的右上方，
 * 自己不接收指针，不挡住下面的画面。位置用 translate 写，跟着指针动时不引起重排。
 *
 *   <Callout x={point.x} y={point.y}>{region.name}</Callout>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts, space } from './tokens.ts';

export interface CalloutProps extends PartProps<'div'> {
  /** 要标的那个点（相对定位容器的左上角，CSS 像素） */
  x: number;
  y: number;
  children?: VNodeChild;
}

const styles = css.create({
  root: {
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: space.xs,
    paddingBlock: space.sm,
    paddingInline: space.md,
    maxWidth: '16rem',
    color: colors.text,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    whiteSpace: 'nowrap',
    backgroundColor: colors.raised,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.lineStrong,
    pointerEvents: 'none',
    willChange: 'translate',
  },
});

// 偏到点的右上方：不压住指针，也不压住点本身
const places = css.create({
  at: (x: number, y: number) => ({ translate: `calc(${x}px + 14px) calc(${y}px - 100% - 10px)` }),
});

export const Callout = _component(({ x, y, children, ...rest }: CalloutProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: [styles.root, places.at(x, y)] }, rest, { role: 'status' })}>
    {children}
  </div>
));
