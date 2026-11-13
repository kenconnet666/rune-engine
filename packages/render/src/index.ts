/** WebGPU 2D 渲染。现在只有地区地图这一层；之后的精灵、线条、文字、后期都加在这里 */
export { createMapRenderer, type MapRenderer, type MapRendererOptions } from './map-renderer.ts';
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
