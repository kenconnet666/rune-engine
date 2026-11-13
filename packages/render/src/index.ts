/** WebGPU 2D 渲染。现在只有地区地图这一层；之后的精灵、线条、文字、后期都加在这里 */
export {
  createMapRenderer,
  type MapCamera,
  type MapRenderer,
  type MapRendererOptions,
} from './map-renderer.ts';
export { decodeRegionMesh, encodeRegionMesh, type RegionMeshData } from './mesh-format.ts';
