/**
 * 舞台上自己加的一层：一块界面单独成层，就能单独决定它怎么贴——整层淡入、放大、一块块显现、带扫描线……
 * 这些在界面画进画布之后由渲染线程来做（不重新排版、不占主线程）；界面没画进画布时这一层照常显示，只是没有效果。
 *
 *   <StageLayer order={1.5} enter={{ from: { reveal: 0, scale: 1.04 }, ms: 500 }}>
 *     …结算的面板…
 *   </StageLayer>
 *
 * order 决定上下：舞台自带的四层是 0（world）、1（hud）、2（overlay）、3（tips），写小数就插在它们之间。
 * 默认这一层铺满整个舞台、自己不接收指针，里面的东西各自打开（和别的层一样）。
 *
 * fit="content" 时这一层只有内容那么大，左上角放在舞台上的 (x, y)：
 *
 *   <StageLayer fit="content" x={point.x} y={point.y} order={1.2}>…一个气泡…</StageLayer>
 *
 * 小的、老在动的东西用它：重拍一层的代价跟面积走，而且只是挪位置的话根本不用重拍。
 *
 * 写了 overlay 这一层就是个**弹层**：渲染出来就是打开的（要关就不再渲染它），上下按打开的先后排（不看 order），
 * 模态、点外面关、Esc、焦点由舞台的弹层宿主管（见 overlays.ts）：
 *
 *   {open && (
 *     <StageLayer overlay={{ modal: true, content: () => panel, onDismiss: () => (open = false) }}>
 *       <div 压暗的底><div ref={panel}>…</div></div>
 *     </StageLayer>
 *   )}
 *
 * 要它贴着一个元素显示（下拉、菜单），用 anchor 入口的 Anchored（Anchored.tsx）。
 */
import { PLAIN_MATERIAL, type UiMaterial } from '@rune-engine/render/ui-types';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, shallowRef, Teleport, watch, type VNodeChild } from 'vue';
import type { OverlayEntry, OverlayOptions } from './overlays.ts';
import { useStage, type StageLayerHandle } from './stage-context.ts';

export interface StageLayerProps {
  /** 这一层的样式（里面的东西怎么摆写在这里） */
  sx?: SxStyles;
  /** stage（默认）铺满舞台；content 只有内容那么大，放在 (x, y) */
  fit?: 'stage' | 'content';
  /** fit="content" 时左上角在舞台上的位置（CSS 像素） */
  x?: number;
  y?: number;
  /** 上下的次序，默认 1.5（hud 的上面、弹层的下面）。写了 overlay 时不看它 */
  order?: number;
  /** 这一层是个弹层（见文件头）。不在舞台里时不起作用 */
  overlay?: OverlayOptions;
  /** 拿到这一层的元素（要量它的大小时用） */
  layerRef?: (element: HTMLElement | null) => void;
  /** 这一层怎么贴（没写的项是原样）；改了它就过渡过去 */
  material?: Partial<UiMaterial>;
  /** material 变了用多久过渡过去（毫秒），默认 0 */
  transitionMs?: number;
  /** 出现的时候：先是 from 的样子，用 ms 毫秒变到 material */
  enter?: { from: Partial<UiMaterial>; ms: number };
  children?: VNodeChild;
}

const styles = css.create({
  stage: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  // 只有内容那么大：从舞台的左上角起，宽度跟着内容走；放到哪里由舞台来摆
  content: { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, width: 'max-content' },
});

export const StageLayer = _component(
  ({
    sx,
    fit = 'stage',
    x = 0,
    y = 0,
    order = 1.5,
    overlay,
    layerRef,
    material,
    transitionMs = 0,
    enter,
    children,
  }: StageLayerProps) => {
    const stage = useStage();
    /**
     * 这一层的元素。不能只在组件挂上的那一刻去登记：和舞台一起渲染出来的层，那一刻舞台自己还没挂上、
     * 没有地方传送，元素是晚一拍才出现的。所以盯着它，有了就登记
     */
    const element = shallowRef<HTMLElement | null>(null);
    const setElement = (next: unknown) => (element.value = next as HTMLElement | null);
    let handle: StageLayerHandle | undefined;
    let entry: OverlayEntry | undefined;

    /** 从舞台上拿掉：先从弹层里拿掉（焦点要还回去，这时元素还在），再收层 */
    const leave = () => {
      entry?.close();
      handle?.remove();
      entry = undefined;
      handle = undefined;
    };
    // 等这一轮渲染收尾了再登记（flush: 'post'）：元素的引用是渲染当中就给的，那一刻里面的东西
    // （对话框自己的元素引用）还没就位——弹层打开要把焦点给里面，太早了就给不到
    watch(
      element,
      (next) => {
        leave();
        layerRef?.(next);
        if (!next || !stage) return;
        // 选项每次现读：onDismiss、要不要点外面关都可以跟着渲染变
        if (overlay) entry = stage.overlays.open(next, () => overlay!);
        handle = stage.addLayer(next, entry?.order ?? order, { fill: fit === 'stage' });
        handle.moveTo(x, y);
        const target = { ...PLAIN_MATERIAL, ...material };
        if (enter) {
          handle.set({ ...target, ...enter.from });
          handle.set(target, enter.ms);
        } else {
          handle.set(target);
        }
      },
      { flush: 'post' },
    );
    watch(
      () => material,
      (next) => handle?.set({ ...PLAIN_MATERIAL, ...next }, transitionMs),
      { deep: true },
    );
    watch(
      () => [x, y] as const,
      ([nextX, nextY]) => handle?.moveTo(nextX, nextY),
    );
    onBeforeUnmount(() => {
      leave();
      layerRef?.(null);
    });

    return () => {
      const layer = (
        <div
          ref={setElement}
          // 不在舞台里：没人替它摆位置，自己用 translate 摆过去
          style={!stage && fit === 'content' ? { translate: `${x}px ${y}px` } : undefined}
          {...css.attrs(fit === 'stage' ? styles.stage : styles.content, sx)}
        >
          {children}
        </div>
      );
      if (!stage) return layer;
      const host = stage.root.value;
      return host ? <Teleport to={host}>{layer}</Teleport> : null;
    };
  },
);
