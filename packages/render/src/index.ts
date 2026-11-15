/** WebGPU 2D 渲染：地区地图（底图、地区、弧线三层）、视野的坐标换算、点选；把界面层贴到画面上的合成器，和只画界面的渲染器 */
export {
  luminance,
  MAP_PALETTES,
  rampColor,
  type MapPalette,
  type MapPaletteName,
  type Rgb,
} from './map-palette.ts';
export {
  createMapRenderer,
  type MapArc,
  type MapRenderer,
  type MapRendererOptions,
} from './map-renderer.ts';
export {
  clampCamera,
  fitCamera,
  mapScale,
  mapToScreen,
  panBy,
  screenToMap,
  zoomAround,
  type MapBounds,
  type MapCamera,
  type MapViewport,
} from './map-view.ts';
export { decodeRegionMesh, encodeRegionMesh, type RegionMeshData } from './mesh-format.ts';
export { createRegionPicker } from './region-picker.ts';
export {
  createUiCompositor,
  type UiCompositor,
  type UiCompositorOptions,
} from './ui-compositor.ts';
export { createUiRenderer, type UiRenderer, type UiRendererOptions } from './ui-renderer.ts';
export type { FrameLayer } from './frame-layer.ts';
export {
  PLAIN_MATERIAL,
  type ElementImage,
  type UiMaterial,
  type UiMessage,
  type UiReport,
} from './ui-types.ts';
// 自己画的界面：显示列表的约定、照着它画的那一层
export { createViewPainter, type ViewPainter, type ViewPainterOptions } from './view-painter.ts';
export {
  VIEW_ITEM,
  VIEW_ITEM_FLOATS,
  VIEW_KIND_RECT,
  VIEW_KIND_TEXT,
  viewFontString,
  type ViewFont,
  type ViewMessage,
  type ViewRun,
} from './view-types.ts';
