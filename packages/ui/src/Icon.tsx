/**
 * 图标：把一份图标数据画成 SVG。数据的格式和 lucide 的一样（一组 [标签, 属性]，24×24 的画布、只描线不填色），
 * 所以 lucide 的图标可以直接用，自己画的图标也照这个格式写。颜色跟着文字走，大小默认跟着字号走。
 *
 *   import { Wind } from 'lucide';
 *   <Icon icon={Wind} />
 *   <Icon icon={Wind} size="1.5rem" label="飞沫传播" />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { h } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';

/** 一个图标：几个 SVG 元素，各是 [标签, 属性] */
export type IconData = readonly (readonly [
  tag: string,
  attrs: Readonly<Record<string, string | number | undefined>>,
])[];

export interface IconProps extends PartProps<'svg', 'viewBox' | 'role'> {
  icon: IconData;
  /** 边长，默认 1.125em（比旁边的文字略大一点） */
  size?: string;
  /** 线的粗细（24 格画布上的单位），默认 2；小尺寸可以用 1.75 */
  weight?: number;
  /** 给了它，图标自己就是一条信息（读屏念它）；不给就是装饰，读屏跳过 */
  label?: string;
}

const styles = css.create({
  // 不被旁边的文字挤扁，也不把一行文字撑高
  root: { flexShrink: 0, display: 'block' },
});

export const Icon = _component(
  ({ icon, size = '1.125em', weight = 2, label, ...rest }: IconProps) =>
    () => (
      <svg
        {...mergeAttrs<'svg'>({ sx: styles.root }, rest, {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': weight,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          role: label ? 'img' : undefined,
          'aria-label': label,
          'aria-hidden': label ? undefined : true,
        })}
      >
        {icon.map(([tag, attrs], index) => h(tag, { key: index, ...attrs }))}
      </svg>
    ),
);
