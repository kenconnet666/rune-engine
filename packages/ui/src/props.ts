/**
 * 部件属性的类型与合并规则，沿用 vue-tsx-pro 组件库的约定（它的 utils/props.ts），这里是够游戏组件用的精简版：
 *
 * 组件给根元素的属性分三层：组件默认（可被覆盖）、使用方传入（组件没声明的属性都落到根元素上）、组件受管（不许覆盖，如 role）。
 *   - sx：默认在前、使用方其次、受管最后，后者覆盖前者；使用方用它摆位置、改个别样式
 *   - class、style：依次排列，交给 Vue 合并
 *   - 事件 onXxx：使用方的先执行，它调用了 event.preventDefault() 就跳过组件自己的处理
 *   - ref：各方都拿到元素
 *   - 其他属性：受管 > 使用方 > 默认
 *
 *   <section {...mergeAttrs<'section'>({ sx: styles.root }, rest, { role: 'group' })} />
 */
import { mergeRefs, ownProps, type RefSetter } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { IntrinsicProps, JSX } from '@zerodep-dev/vue-tsx-pro-tsx/jsx-runtime';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';

/** 原生元素的属性加上 sx；去掉组件自己管的属性与 children（内容走组件自己的 prop） */
export type PartProps<
  Tag extends keyof JSX.IntrinsicElements,
  Managed extends string = never,
> = Omit<IntrinsicProps<Tag>, Managed | 'children'> & { sx?: SxStyles };

type Props = Record<string, unknown>;
type Handler = (...args: unknown[]) => unknown;

const isHandler = (key: string) => /^on[A-Z]/.test(key);
const present = (...values: unknown[]) => values.filter((value) => value != null);

/** 合并根元素的三层属性（规则见文件开头），结果直接展开到元素上 */
export function mergeAttrs<Tag extends keyof JSX.IntrinsicElements>(
  defaults: Partial<PartProps<Tag>>,
  user?: Partial<PartProps<Tag>>,
  managed?: Partial<PartProps<Tag>>,
): Omit<Partial<PartProps<Tag>>, 'sx' | 'children'> {
  const base = defaults as Props;
  // 组件的 ...rest 是代理：换成背后的普通对象再展开
  const own = (ownProps(user as Props | undefined) ?? {}) as Props;
  const fixed = (managed ?? {}) as Props;
  const { sx: _sx, children: _children, ...merged } = { ...base, ...own, ...fixed };

  const compiled = css.attrs(base.sx as SxStyles, own.sx as SxStyles, fixed.sx as SxStyles);
  const classes = present(compiled.class, base.class, own.class, fixed.class);
  const styles = present(compiled.style, base.style, own.style, fixed.style);
  if (classes.length) merged.class = classes;
  if (styles.length) merged.style = styles;

  const refs = present(base.ref, own.ref, fixed.ref, compiled.ref) as RefSetter[];
  if (refs.length > 1) merged.ref = mergeRefs(refs);
  else if (refs.length === 1) merged.ref = refs[0];

  for (const key in own) {
    if (!isHandler(key)) continue;
    const mine = present(base[key], fixed[key]) as Handler[];
    const theirs = own[key] as Handler | undefined;
    if (!mine.length) continue;
    merged[key] = (...args: unknown[]) => {
      theirs?.(...args);
      const event = args[0];
      if (event instanceof Event && event.defaultPrevented) return;
      for (const handler of mine) handler(...args);
    };
  }
  return merged as Omit<Partial<PartProps<Tag>>, 'sx' | 'children'>;
}
