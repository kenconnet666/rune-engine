/** 科技树的排版：只算位置，不画（画在 TechTree.tsx） */

export interface TreeItem {
  id: string;
  /** 前置的 id（不在这棵树里的会被忽略） */
  requires: readonly string[];
}

export interface Placed<Item extends TreeItem> {
  node: Item;
  column: number;
  row: number;
}

/** 给每个节点定一个格子：列是前置链的长度，行是和前置尽量对齐、同一列里不重叠 */
export function layoutTree<Item extends TreeItem>(nodes: readonly Item[]): Placed<Item>[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const columns = new Map<string, number>();
  const columnOf = (id: string, seen: ReadonlySet<string>): number => {
    const known = columns.get(id);
    if (known !== undefined) return known;
    // 前置关系万一成了环：当它没有前置，不要卡死
    const parents = seen.has(id)
      ? []
      : (byId.get(id)?.requires ?? []).filter((parent) => byId.has(parent));
    const next = new Set(seen).add(id);
    const column = parents.length
      ? Math.max(...parents.map((parent) => columnOf(parent, next))) + 1
      : 0;
    columns.set(id, column);
    return column;
  };
  for (const node of nodes) columnOf(node.id, new Set());

  const placed = new Map<string, Placed<Item>>();
  const last = Math.max(0, ...columns.values());
  for (let column = 0; column <= last; column++) {
    const here = nodes.filter((node) => columns.get(node.id) === column);
    // 想待的那一行：前置所在行的平均；没有前置的按表里的先后
    const wanted = here.map((node, order) => {
      const rows = node.requires.flatMap((parent) => {
        const row = placed.get(parent)?.row;
        return row === undefined ? [] : [row];
      });
      return {
        node,
        row: rows.length ? rows.reduce((sum, row) => sum + row, 0) / rows.length : order,
        order,
      };
    });
    wanted.sort((a, b) => a.row - b.row || a.order - b.order);
    let free = 0;
    for (const { node, row } of wanted) {
      const at = Math.max(free, Math.round(row));
      placed.set(node.id, { node, column, row: at });
      free = at + 1;
    }
  }
  return nodes.map((node) => placed.get(node.id)!);
}
