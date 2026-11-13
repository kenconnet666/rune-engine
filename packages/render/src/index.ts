/** WebGPU 2D 渲染：地区地图（底图、地区、弧线三层）、视野的坐标换算、点选 */
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
