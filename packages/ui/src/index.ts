/**
 * 游戏用的界面组件。风格是“情报室”：深色中性底、细线、等宽数字、一个信号色。
 *
 * 约定沿用 vue-tsx-pro 的组件库（见 props.ts）：组件没声明的属性都落到根元素上，用 sx 摆位置、改个别样式；
 * 颜色、字体、间距、时长只从 tokens 取，之后的主题只改 tokens。
 */
export { ActionButton, type ActionButtonProps } from './ActionButton.tsx';
export { Callout, type CalloutProps } from './Callout.tsx';
export { Fact, type FactProps } from './Fact.tsx';
export { Frame, type FrameProps } from './Frame.tsx';
export { Meter, type MeterProps } from './Meter.tsx';
export { Note, type NoteProps } from './Note.tsx';
export { mergeAttrs, type PartProps } from './props.ts';
export { Readout, type ReadoutProps } from './Readout.tsx';
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
  type SegmentedValue,
} from './Segmented.tsx';
export { Stack, type StackProps } from './Stack.tsx';
export { colors, durations, fonts, space } from './tokens.ts';
