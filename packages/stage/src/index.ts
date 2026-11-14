/**
 * 舞台：一张画布，加上画在画布里的几层界面（做法和要知道的性质见 docs/interface.md）。
 * 这个包只管“层”：把层搬进画布、拍下来交给渲染线程、告诉浏览器各层画在哪、层的贴法，
 * 还有弹层共有的那几件事（谁在上面、模态、点外面关、Esc、焦点）。
 * 它不认识任何具体的组件——组件库在它上面做对话框、提示这些东西。
 * 贴着锚点摆的层在另一个入口（`@rune-engine/stage/anchor`）：算位置的库只有用到的页面才带上。
 */
export {
  canvasUiSupported,
  createCanvasUi,
  type CanvasUi,
  type CanvasUiLayer,
  type CanvasUiLayerOptions,
  type CanvasUiOptions,
  type ScrollRegion,
} from './canvas-ui.ts';
export {
  createOverlayHost,
  OVERLAY_ORDER,
  type DismissReason,
  type OverlayEntry,
  type OverlayHost,
  type OverlayHostEnv,
  type OverlayOptions,
} from './overlays.ts';
export { Stage, type StageHandle, type StageProps } from './Stage.tsx';
export {
  STAGE,
  STAGE_LAYER_ORDER,
  STAGE_LAYERS,
  useStage,
  type StageContext,
  type StageLayerHandle,
  type StageLayerName,
} from './stage-context.ts';
export { StageLayer, type StageLayerProps } from './StageLayer.tsx';
export { attachTips } from './tips.ts';
// 层的贴法是和渲染线程约好的（render 包的 ui-types）：用舞台的不用再去认识 render
export { PLAIN_MATERIAL, type UiMaterial, type UiMessage } from '@rune-engine/render/ui-types';
