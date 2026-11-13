/**
 * 点选：地图上的一点落在哪个地区。把网格的三角形按一张均匀的格子登记好，
 * 查的时候只看那一格里的几个三角形——一万个三角形的地图，一次查询是微秒级的，指针每动一下查一次没有负担。
 */
import type { RegionMeshData } from './mesh-format.ts';

const COLUMNS = 96;
const ROWS = 48;

/** 返回一个查询函数：给地图坐标，返回地区的下标；不在任何地区里（海上）返回 -1 */
export function createRegionPicker(mesh: RegionMeshData): (x: number, y: number) => number {
  const { vertices, indices, bounds } = mesh;
  const [minX, minY, maxX, maxY] = bounds;
  const cellWidth = (maxX - minX) / COLUMNS || 1;
  const cellHeight = (maxY - minY) / ROWS || 1;
  const column = (x: number) =>
    Math.min(COLUMNS - 1, Math.max(0, Math.floor((x - minX) / cellWidth)));
  const row = (y: number) => Math.min(ROWS - 1, Math.max(0, Math.floor((y - minY) / cellHeight)));

  // 两遍：先数每格有几个三角形，再按偏移填进一个连续的数组（不为每格建一个小数组）
  const starts = new Uint32Array(COLUMNS * ROWS + 1);
  const eachCell = (triangle: number, visit: (cell: number) => void) => {
    const a = indices[triangle]! * 3;
    const b = indices[triangle + 1]! * 3;
    const c = indices[triangle + 2]! * 3;
    const c0 = column(Math.min(vertices[a]!, vertices[b]!, vertices[c]!));
    const c1 = column(Math.max(vertices[a]!, vertices[b]!, vertices[c]!));
    const r0 = row(Math.min(vertices[a + 1]!, vertices[b + 1]!, vertices[c + 1]!));
    const r1 = row(Math.max(vertices[a + 1]!, vertices[b + 1]!, vertices[c + 1]!));
    for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) visit(r * COLUMNS + q);
  };
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    eachCell(triangle, (cell) => starts[cell + 1]!++);
  }
  for (let cell = 0; cell < COLUMNS * ROWS; cell++) starts[cell + 1]! += starts[cell]!;
  const filled = starts.slice(0, COLUMNS * ROWS);
  const triangles = new Uint32Array(starts[COLUMNS * ROWS]!);
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    eachCell(triangle, (cell) => (triangles[filled[cell]!++] = triangle));
  }

  return (x, y) => {
    if (x < minX || x > maxX || y < minY || y > maxY) return -1;
    const cell = row(y) * COLUMNS + column(x);
    for (let at = starts[cell]!; at < starts[cell + 1]!; at++) {
      const triangle = triangles[at]!;
      const a = indices[triangle]! * 3;
      const b = indices[triangle + 1]! * 3;
      const c = indices[triangle + 2]! * 3;
      const ax = vertices[a]!;
      const ay = vertices[a + 1]!;
      // 点在三角形里：它在三条边的同一侧
      const d1 = (x - ax) * (vertices[b + 1]! - ay) - (vertices[b]! - ax) * (y - ay);
      const d2 =
        (x - vertices[b]!) * (vertices[c + 1]! - vertices[b + 1]!) -
        (vertices[c]! - vertices[b]!) * (y - vertices[b + 1]!);
      const d3 =
        (x - vertices[c]!) * (ay - vertices[c + 1]!) - (ax - vertices[c]!) * (y - vertices[c + 1]!);
      const negative = d1 < 0 || d2 < 0 || d3 < 0;
      const positive = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(negative && positive)) return vertices[a + 2]!;
    }
    return -1;
  };
}
