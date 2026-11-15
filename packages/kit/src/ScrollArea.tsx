/**
 * 能滚的一块，带一根自己画的滚动条：内容比这一块高时右边出现一根滑块，跟着滚动走，也可以拖。
 * 滚动本身是 view 包的（overflow: 'scroll' 的盒子，滚轮能滚）；这里加的是那根滑块。
 */
import { View, type ViewNode, type ViewPointerEvent, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { themed } from './theme';

export interface ScrollAreaProps {
  /** 这一块自己的样式（占多大、在哪） */
  style?: ViewStyle;
  /** 里面内容那一层的样式（内边距、间隔） */
  contentStyle?: ViewStyle;
  /** 拿到那个能滚的节点（要自己滚到某处时用它的 scrollTo） */
  onNode?: (node: ViewNode) => void;
  /** 这一块的大小、或者里面内容的大小变了 */
  onLayout?: (node: ViewNode) => void;
  children?: VNodeChild;
}

/** 滑块离上下两头多远、最短多长（像素） */
const INSET = 2;
const MIN_THUMB = 24;

const styles = themed(({ colors }) => ({
  thumb: {
    position: 'absolute',
    right: 2,
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.faint,
    opacity: 0.6,
    hover: { opacity: 1 },
    active: { opacity: 1 },
  },
}));
const SCROLLER: ViewStyle = { flex: 1, overflow: 'scroll' };

export const ScrollArea = _component(
  ({ style, contentStyle, onNode, onLayout, children }: ScrollAreaProps) => {
    let scroller: ViewNode | null = null;
    /** 滑块在哪、多长；没东西可滚时长度是 0（不显示） */
    let thumb = _state({ top: INSET, height: 0 });
    /** 正拖着滑块：按下时指针在哪、当时滚到哪 */
    let dragging: { pointer: number; scroll: number } | null = null;

    const sync = (node: ViewNode) => {
      if (!scroller) onNode?.(node);
      scroller = node;
      const track = node.height - INSET * 2;
      const height =
        node.maxScrollTop > 0 ? Math.max(MIN_THUMB, (track * node.height) / node.contentHeight) : 0;
      const top =
        INSET + (height > 0 ? ((track - height) * node.scrollTop) / node.maxScrollTop : 0);
      if (height !== thumb.height || top !== thumb.top) thumb = { top, height };
    };
    const grab = (event: ViewPointerEvent) => {
      if (!scroller) return;
      event.capture();
      dragging = { pointer: event.y, scroll: scroller.scrollTop };
    };
    const drag = (event: ViewPointerEvent) => {
      if (!dragging || !scroller) return;
      const travel = scroller.height - INSET * 2 - thumb.height;
      if (travel <= 0) return;
      const moved = ((event.y - dragging.pointer) * scroller.maxScrollTop) / travel;
      scroller.scrollTo(scroller.scrollLeft, dragging.scroll + moved);
    };

    return () => (
      <View style={style}>
        <View
          style={contentStyle ? { ...SCROLLER, ...contentStyle } : SCROLLER}
          onLayout={(node) => {
            sync(node);
            onLayout?.(node);
          }}
          onScroll={sync}
        >
          {children}
        </View>
        {thumb.height > 0 && (
          <View
            style={{ ...styles().thumb, top: thumb.top, height: thumb.height }}
            onPointerdown={grab}
            onPointermove={drag}
            onPointerup={() => (dragging = null)}
          />
        )}
      </View>
    );
  },
);
