/** 构建时的素材处理（只在 Node 里的构建脚本用，不进游戏的运行时代码） */
export { equalEarth, miller, type Projection } from './projection.ts';
export {
  buildDetailMesh,
  buildRegionMesh,
  type DetailMeshOptions,
  type RegionInfo,
  type RegionMesh,
  type RegionMeshOptions,
} from './region-mesh.ts';
