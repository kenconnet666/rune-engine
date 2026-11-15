/**
 * 自己画的界面：节点树、样式、排版、命中都是自己的（不是网页元素），由 Vue 驱动；
 * 排好版列成显示列表，交给渲染线程用 WebGPU 画（画的那头在 render 包：view-painter.ts）。
 *
 *   const renderer = runViewRenderer(canvas);                       // '@rune-engine/view/renderer'
 *   const host = createViewHost(canvas, { send: renderer.send });
 *   host.mount(App);                                                // App 里用 <View>、<Text>
 */
export { createViewHost, type ViewHost, type ViewHostOptions, type ViewHostStats } from './host.ts';
export { createViewApp, Text, View, type ViewProps } from './renderer.ts';
export type { ViewRendererStats } from './worker/messages.ts';
export { ViewNode, ViewTree, type ViewNodeType } from './node.ts';
export { parseColor, type ViewAlign, type ViewStyle } from './style.ts';
export { layoutTree } from './layout.ts';
export {
  createPointerInput,
  hitTest,
  type PointerInput,
  type ViewPointerEvent,
  type ViewWheelEvent,
} from './events.ts';
export {
  createDisplayBuilder,
  type DisplayBuilder,
  type DisplayBuilderOptions,
  type DisplayFrame,
} from './display.ts';
export { createCanvasMeasurer, type TextMeasurer } from './text.ts';
export {
  pointAt,
  selectAll,
  selectedText,
  type TextPoint,
  type ViewSelection,
} from './selection.ts';
