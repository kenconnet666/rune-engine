/**
 * 游戏用的界面组件。第一批只有搭主界面要的几个；风格是“情报室”：深色中性底、细线、等宽数字、一个信号色。
 * 颜色、字体都从 tokens 取，之后的主题只改 tokens。
 */
export { ActionButton, type ActionButtonProps } from './ActionButton.tsx';
export { Frame, type FrameProps } from './Frame.tsx';
export { Readout, type ReadoutProps } from './Readout.tsx';
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
  type SegmentedValue,
} from './Segmented.tsx';
export { colors, fonts } from './tokens.ts';
