/**
 * 游戏用的界面组件。风格是“情报室”：深色中性底、细线、等宽数字、一个信号色。
 *
 * 约定沿用 vue-tsx-pro 的组件库（见 props.ts）：组件没声明的属性都落到根元素上，用 sx 摆位置、改个别样式；
 * 颜色、字体、间距、时长只从 tokens 取，之后的主题只改 tokens。
 */
export { ActionButton, type ActionButtonProps } from './ActionButton.tsx';
export { Callout, type CalloutProps } from './Callout.tsx';
export {
  canvasUiSupported,
  createCanvasUi,
  type CanvasUi,
  type CanvasUiLayer,
} from './canvas-ui.ts';
export { Chart, type ChartProps, type ChartSeries } from './Chart.tsx';
export { Dialog, type DialogProps } from './Dialog.tsx';
export { Fact, type FactProps } from './Fact.tsx';
export { Frame, type FrameProps } from './Frame.tsx';
export { Icon, type IconData, type IconProps } from './Icon.tsx';
export { FaceMask, Lungs, Mosquito, PlaneOff } from './icons.ts';
export { Meter, type MeterProps } from './Meter.tsx';
export { Note, type NoteProps } from './Note.tsx';
export { mergeAttrs, type PartProps } from './props.ts';
export { Ramp, type RampProps } from './Ramp.tsx';
export { Readout, type ReadoutProps } from './Readout.tsx';
export { ripple, rippleHost } from './ripple.ts';
export { Scroll, type ScrollProps } from './Scroll.tsx';
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
  type SegmentedValue,
} from './Segmented.tsx';
export { Slider, type SliderProps } from './Slider.tsx';
export { Stack, type StackProps } from './Stack.tsx';
export { Stage, type StageHandle, type StageProps } from './Stage.tsx';
export { StageLayer, type StageLayerProps } from './StageLayer.tsx';
export {
  STAGE_LAYERS,
  useStage,
  type StageContext,
  type StageLayerHandle,
  type StageLayerName,
} from './stage-context.ts';
export { focusRing, pressable, scroll } from './styles.ts';
export { Tabs, type TabItem, type TabsProps, type TabValue } from './Tabs.tsx';
export { TechTree, type TechTreeProps, type TreeNode } from './TechTree.tsx';
export { TextField, type TextFieldProps } from './TextField.tsx';
export { Tile, type TileProps, type TileState } from './Tile.tsx';
export { Tip, type TipProps } from './Tip.tsx';
export { Toasts, type ToastItem, type ToastsProps } from './Toasts.tsx';
export { colors, colorSafeTheme, durations, fonts, space } from './tokens.ts';
