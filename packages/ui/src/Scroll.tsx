/**
 * 滚动区：内容放不下时自己滚动。滚动是浏览器原生的（惯性、键盘、读屏都不变），只把滚动条换成细的、半透明的。
 * 大小由使用方给（放在 flex、grid 里，或者用 sx 给高度）。
 *
 *   <Scroll sx={styles.column}>…</Scroll>
 *   <Scroll axis="both">…</Scroll>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { scroll } from './styles.ts';

export interface ScrollProps extends PartProps<'div'> {
  /** 哪个方向可以滚，默认 y（另一个方向超出的部分裁掉） */
  axis?: 'y' | 'x' | 'both';
  children?: VNodeChild;
}

export const Scroll = _component(({ axis = 'y', children, ...rest }: ScrollProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: [scroll.bar, scroll[axis]] }, rest)}>{children}</div>
));
