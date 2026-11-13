import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import { equalEarth, miller } from './projection.ts';
import { buildDetailMesh, buildRegionMesh } from './region-mesh.ts';

/**
 * 三个并排的方块（经纬度各 1 度）：A | B | C，A 和 B、B 和 C 各共用一条边。
 * B 在数据源里没有编号。
 */
const squares = {
  type: 'Topology',
  arcs: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 0],
    ],
    [
      [1, 1],
      [2, 1],
    ],
    [
      [2, 1],
      [2, 0],
    ],
    [
      [2, 0],
      [1, 0],
    ],
    [
      [2, 1],
      [3, 1],
      [3, 0],
      [2, 0],
    ],
  ],
  objects: {
    areas: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '4', properties: { name: 'A' }, arcs: [[0, 1]] },
        { type: 'Polygon', properties: { name: 'B' }, arcs: [[-2, 2, 3, 4]] },
        { type: 'Polygon', id: '8', properties: { name: 'C' }, arcs: [[-4, 5]] },
      ],
    },
  },
} as unknown as Topology;

describe('地区网格', () => {
  it('数据源没给编号的地区记成 “#下标”，不和真编号撞', () => {
    const mesh = buildRegionMesh(squares, 'areas');
    expect(mesh.regions.map((region) => region.id)).toEqual(['4', '#1', '8']);
    expect(mesh.regions.map((region) => region.neighbors)).toEqual([[1], [0, 2], [1]]);
  });

  it('去掉一个地区之后，下标和相邻关系跟着换', () => {
    const mesh = buildRegionMesh(squares, 'areas', { skip: (id) => id === '4' });
    expect(mesh.regions.map((region) => region.name)).toEqual(['B', 'C']);
    expect(mesh.regions.map((region) => region.neighbors)).toEqual([[1], [0]]);
    // 顶点里记的地区下标也是新的：每个方块 4 个顶点
    const owners = Array.from(
      { length: mesh.vertices.length / 3 },
      (_, i) => mesh.vertices[i * 3 + 2],
    );
    expect(owners).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('面积按等面积投影量，和画图用哪种投影无关', () => {
    const flat = buildRegionMesh(squares, 'areas', { project: miller });
    const curved = buildRegionMesh(squares, 'areas', { project: equalEarth });
    expect(flat.regions.map((region) => region.area)).toEqual(
      curved.regions.map((region) => region.area),
    );
    // 画出来的形状跟着投影走：米勒投影下经度 3° 就是 x = 3π/180
    expect(flat.bounds[2]).toBeCloseTo((3 * Math.PI) / 180, 10);
    expect(flat.bounds).not.toEqual(curved.bounds);
  });
});

describe('细节网格', () => {
  it('只留对得上的地区，下标用给定的那套', () => {
    // 把 C 归到 0 号、A 归到 1 号，没有编号的 B 不要
    const mesh = buildDetailMesh(squares, 'areas', {
      regionOf: (id) => (id === '8' ? 0 : id === '4' ? 1 : -1),
    });
    const owners = Array.from(
      { length: mesh.vertices.length / 3 },
      (_, i) => mesh.vertices[i * 3 + 2],
    );
    // 数据里 A 在前、C 在后；每个方块 4 个顶点、2 个三角形
    expect(owners).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);
    expect(mesh.indices).toHaveLength(12);
  });
});

describe('米勒投影', () => {
  it('经线竖直、纬线水平：x 只看经度，y 只看纬度', () => {
    expect(miller(180, 0)[0]).toBe(Math.PI);
    // tan(π/4) 在浮点数里不正好是 1，赤道的 y 差一个舍入误差
    expect(miller(180, 0)[1]).toBeCloseTo(0, 12);
    expect(miller(-60, 45)[0]).toBeCloseTo(-Math.PI / 3, 12);
    expect(miller(10, 45)[1]).toBe(miller(120, 45)[1]);
    expect(miller(0, -30)[1]).toBeCloseTo(-miller(0, 30)[1], 12);
  });
});
