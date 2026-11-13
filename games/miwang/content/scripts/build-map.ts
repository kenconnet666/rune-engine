/**
 * 生成世界地图的素材（pnpm --filter @miwang/content build:map）：
 *   generated/world-mesh.bin   地区网格，渲染器直接加载
 *   generated/world.json       各地区的名字、面积、中心、相邻关系，模拟的配置从它来
 * 数据是 world-atlas 的 1:1.1 亿国家边界（Natural Earth，公有领域）。产物不进仓库：开发服务器启动前（客户端的 predev）、
 * 类型检查前（根目录的 typecheck 先跑它，再并行检查各包——客户端的检查要读这里的 world.json）自动生成。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRegionMesh } from '@rune-engine/assets-build';
import { encodeRegionMesh } from '@rune-engine/render/mesh-format';
import type { Topology } from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json' with { type: 'json' };

const out = join(import.meta.dirname, '..', 'generated');
mkdirSync(out, { recursive: true });

const mesh = buildRegionMesh(atlas as unknown as Topology, 'countries');
writeFileSync(join(out, 'world-mesh.bin'), encodeRegionMesh(mesh));
writeFileSync(
  join(out, 'world.json'),
  JSON.stringify({
    bounds: mesh.bounds.map((value) => +value.toFixed(5)),
    regions: mesh.regions.map((region) => ({
      id: region.id,
      name: region.name,
      area: +region.area.toFixed(6),
      center: region.center.map((value) => +value.toFixed(4)),
      neighbors: region.neighbors,
    })),
  }),
);
console.log(
  `世界地图：${mesh.regions.length} 个地区，${mesh.vertices.length / 3} 个顶点，${mesh.indices.length / 3} 个三角形`,
);
