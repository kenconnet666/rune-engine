import { describe, expect, it } from 'vitest';
import { layoutTree } from './tree-layout.ts';

const node = (id: string, ...requires: string[]) => ({ id, requires });
const at = (placed: ReturnType<typeof layoutTree>, id: string) => {
  const found = placed.find((item) => item.node.id === id)!;
  return [found.column, found.row];
};

describe('科技树的排版', () => {
  it('一样东西排在它所有前置的右边一列', () => {
    const placed = layoutTree([node('a'), node('b', 'a'), node('c', 'b'), node('d', 'a', 'c')]);
    expect(at(placed, 'a')).toEqual([0, 0]);
    expect(at(placed, 'b')).toEqual([1, 0]);
    expect(at(placed, 'c')).toEqual([2, 0]);
    // d 的前置里最靠右的是 c
    expect(at(placed, 'd')[0]).toBe(3);
  });

  it('同一列里和前置对齐，挤了就往下让，不重叠', () => {
    const placed = layoutTree([
      node('a'),
      node('b'),
      node('a1', 'a'),
      node('a2', 'a'),
      node('b1', 'b'),
    ]);
    expect(at(placed, 'a1')).toEqual([1, 0]);
    expect(at(placed, 'a2')).toEqual([1, 1]);
    expect(at(placed, 'b1')).toEqual([1, 2]);
    const cells = placed.map((item) => `${item.column},${item.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('前置不在这棵树里就当没有；成了环也不会卡死', () => {
    expect(at(layoutTree([node('a', '不在树里')]), 'a')).toEqual([0, 0]);
    const loop = layoutTree([node('a', 'b'), node('b', 'a')]);
    expect(loop).toHaveLength(2);
  });
});
