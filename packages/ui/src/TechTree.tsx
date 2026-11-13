/**
 * 科技树：一批有前置关系的东西（性状、研究），按“要先有谁”从左到右排开，前置和后继之间连线。
 * 位置是自己算的（见 tree-layout.ts）：一样东西排在它所有前置的右边一列；每一列里尽量和前置对齐，挤了就往下让。
 * 点一个图块是“看它”（selected），要不要它由使用方在详情里决定。
 *
 *   <TechTree nodes={nodes} selected={current} onSelect={(id) => (current = id)} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import type { IconData } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { layoutTree, type TreeItem } from './tree-layout.ts';
import { Tile, type TileState } from './Tile.tsx';
import { colors } from './tokens.ts';

export interface TreeNode extends TreeItem {
  icon?: IconData;
  label: VNodeChild;
  detail?: VNodeChild;
  state: TileState;
}

export interface TechTreeProps extends PartProps<'div', 'onSelect'> {
  nodes: readonly TreeNode[];
  selected?: string | null;
  onSelect?: (id: string) => void;
}

/** 一格的大小（rem）和图块在格子里占的比例：连线从图块的边上出发 */
const CELL_WIDTH = 8.5;
const CELL_HEIGHT = 5.25;
const TILE_SHARE = 0.78;

const styles = css.create({
  // 宽高跟着格子走，不被外面拉大：连线那张图和网格一样大，坐标才对得上
  root: { position: 'relative', display: 'grid', width: 'fit-content', height: 'fit-content' },
  links: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  // 线的颜色走文字色（描边写的是 currentColor）：样式引擎不认 SVG 专有的属性
  link: { color: colors.line },
  // 前置已经有了：这条路走得通
  open: { color: colors.signal },
  cell: { display: 'grid', placeItems: 'stretch', padding: '0.4rem 0.9rem', minWidth: 0 },
});

const places = css.create({
  grid: (columns: number, rows: number) => ({
    gridTemplateColumns: `repeat(${columns}, ${CELL_WIDTH}rem)`,
    gridTemplateRows: `repeat(${rows}, ${CELL_HEIGHT}rem)`,
  }),
  at: (column: number, row: number) => ({ gridColumn: `${column + 1}`, gridRow: `${row + 1}` }),
});

export const TechTree = _component(
  ({ nodes, selected, onSelect, ...rest }: TechTreeProps) =>
    () => {
      const placed = layoutTree(nodes);
      const at = new Map(placed.map((item) => [item.node.id, item]));
      const columns = Math.max(1, ...placed.map((item) => item.column + 1));
      const rows = Math.max(1, ...placed.map((item) => item.row + 1));
      const edge = (1 - TILE_SHARE) / 2;
      return (
        <div {...mergeAttrs<'div'>({ sx: [styles.root, places.grid(columns, rows)] }, rest)}>
          {/* 连线画在一张和网格一样大的图上，坐标的单位是“格” */}
          <svg
            viewBox={`0 0 ${columns} ${rows}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            {...css.attrs(styles.links)}
          >
            {placed.flatMap(({ node, column, row }) =>
              node.requires.flatMap((parentId) => {
                const parent = at.get(parentId);
                if (!parent) return [];
                const x1 = parent.column + 1 - edge;
                const y1 = parent.row + 0.5;
                const x2 = column + edge;
                const y2 = row + 0.5;
                const middle = (x1 + x2) / 2;
                return (
                  <path
                    key={`${parentId}-${node.id}`}
                    d={`M${x1} ${y1} C${middle} ${y1} ${middle} ${y2} ${x2} ${y2}`}
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    vector-effect="non-scaling-stroke"
                    {...css.attrs(styles.link, parent.node.state === 'owned' && styles.open)}
                  />
                );
              }),
            )}
          </svg>
          {placed.map(({ node, column, row }) => (
            <div key={node.id} {...css.attrs(styles.cell, places.at(column, row))}>
              <Tile
                icon={node.icon}
                label={node.label}
                detail={node.detail}
                state={node.state}
                selected={node.id === selected}
                onPress={() => onSelect?.(node.id)}
              />
            </div>
          ))}
        </div>
      );
    },
);
