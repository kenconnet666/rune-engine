/**
 * 一摞：把几样东西等距排成一列（或一行）。面板里的按钮组、事实表、分组都用它，不必各写一遍 flex。
 *
 *   <Stack>…</Stack>
 *   <Stack row gap="md" wrap>…</Stack>
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { space } from './tokens.ts';

export interface StackProps extends PartProps<'div'> {
  /** 横着排；默认竖着 */
  row?: boolean;
  /** 间距，默认 sm */
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  /** 横排时放不下就换行 */
  wrap?: boolean;
  children?: VNodeChild;
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  xs: { gap: space.xs },
  sm: { gap: space.sm },
  md: { gap: space.md },
  lg: { gap: space.lg },
});

export const Stack = _component(
  ({ row, gap = 'sm', wrap, children, ...rest }: StackProps) =>
    () => (
      <div
        {...mergeAttrs<'div'>(
          { sx: [styles.root, row && styles.row, wrap && styles.wrap, styles[gap]] },
          rest,
        )}
      >
        {children}
      </div>
    ),
);
