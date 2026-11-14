/**
 * 标注：跟着画面上的一个点走的小提示（指针停在地图的一个地区上时显示它的名字）。
 * x、y 是那个点在舞台里的坐标（CSS 像素）；提示显示在点的右上方（上面放不下就翻到下面，右边出了舞台就往回挪），
 * 自己不接收指针，不挡住下面的画面。
 *
 *   <Callout x={point.x} y={point.y}>{region.name}</Callout>
 *
 * 它在舞台上单独占一层，只有自己那么大：指针每动一下它就要挪一次，要是放在一大层界面里，
 * 挪一下那一整层都得重画；单独成层的话挪位置根本不用重画（见 stage 包的 Anchored）。
 */
import { Anchored } from '@rune-engine/stage/anchor';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { colors, fonts, space } from './tokens.ts';

export interface CalloutProps extends PartProps<'div'> {
  /** 要标的那个点（相对舞台的左上角，CSS 像素） */
  x: number;
  y: number;
  children?: VNodeChild;
}

/** 在一直在的界面上面、对话框下面 */
const ORDER = 1.2;
/** 偏到点的右上方：不压住指针，也不压住点本身 */
const OFFSET_X = 14;
const OFFSET_Y = 10;

const styles = css.create({
  layer: { pointerEvents: 'none' },
  root: {
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
  },
});

export const Callout = _component(({ x, y, children, ...rest }: CalloutProps) => () => (
  <Anchored
    anchor={{ x: x + OFFSET_X, y }}
    placement="top-start"
    offset={OFFSET_Y}
    order={ORDER}
    sx={styles.layer}
  >
    <div {...mergeAttrs<'div'>({ sx: styles.root }, rest, { role: 'status' })}>{children}</div>
  </Anchored>
));
