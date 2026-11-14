/**
 * 舞台上自己加的一层：一块界面单独成层，就能单独决定它怎么贴——整层淡入、放大、一块块显现、带扫描线……
 * 这些在界面画进画布之后由渲染线程来做（不重新排版、不占主线程）；界面没画进画布时这一层照常显示，只是没有效果。
 *
 *   <StageLayer order={1.5} enter={{ from: { reveal: 0, scale: 1.04 }, ms: 500 }}>
 *     …结算的面板…
 *   </StageLayer>
 *
 * order 决定上下：舞台自带的四层是 0（world）、1（hud）、2（overlay）、3（tips），写小数就插在它们之间。
 * 这一层铺满整个舞台、自己不接收指针，里面的东西各自打开（和别的层一样）。
 */
import { PLAIN_MATERIAL, type UiMaterial } from '@rune-engine/render/ui-types';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted, Teleport, watch, type VNodeChild } from 'vue';
import { useStage, type StageLayerHandle } from './stage-context.ts';

export interface StageLayerProps {
  /** 这一层的样式（它铺满舞台；里面的东西怎么摆写在这里） */
  sx?: SxStyles;
  /** 上下的次序，默认 1.5（hud 的上面、对话框的下面） */
  order?: number;
  /** 这一层怎么贴（没写的项是原样）；改了它就过渡过去 */
  material?: Partial<UiMaterial>;
  /** material 变了用多久过渡过去（毫秒），默认 0 */
  transitionMs?: number;
  /** 出现的时候：先是 from 的样子，用 ms 毫秒变到 material */
  enter?: { from: Partial<UiMaterial>; ms: number };
  children?: VNodeChild;
}

const styles = css.create({
  root: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
});

export const StageLayer = _component(
  ({ sx, order = 1.5, material, transitionMs = 0, enter, children }: StageLayerProps) => {
    const stage = useStage();
    let element = _state.raw<HTMLElement | null>(null);
    let handle: StageLayerHandle | undefined;

    onMounted(() => {
      if (!element || !stage) return;
      handle = stage.addLayer(element, order);
      const target = { ...PLAIN_MATERIAL, ...material };
      if (enter) {
        handle.set({ ...target, ...enter.from });
        handle.set(target, enter.ms);
      } else {
        handle.set(target);
      }
    });
    watch(
      () => material,
      (next) => handle?.set({ ...PLAIN_MATERIAL, ...next }, transitionMs),
      { deep: true },
    );
    onBeforeUnmount(() => handle?.remove());

    return () => {
      const layer = (
        <div ref={_toRef(element)} {...css.attrs(styles.root, sx)}>
          {children}
        </div>
      );
      if (!stage) return layer;
      const host = stage.root.value;
      return host ? <Teleport to={host}>{layer}</Teleport> : null;
    };
  },
);
