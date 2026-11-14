/**
 * 贴着一样东西显示的一层：只有内容那么大，跟着锚点走（位置怎么算见 anchor.ts）。
 * 下拉、菜单、气泡、地图上的标注都是它；再写上 overlay 就是个能点外面关、按 Esc 关的弹层。
 *
 *   {open && (
 *     <Anchored
 *       anchor={button}
 *       placement="bottom-start"
 *       overlay={{ inside: () => [button], onDismiss: () => (open = false) }}
 *     >
 *       …菜单…
 *     </Anchored>
 *   )}
 *
 * 界面画在画布里时，跟着锚点挪位置不用重拍（位置是贴的时候才用的）。摆在了哪一侧写在这一层的
 * data-side（top / bottom / left / right）和 data-align（start / center / end）上，箭头之类的样式按它来。
 * 第一次算好位置之前这一层看不见，不会在角上闪一下。只在舞台里起作用。
 *
 * 它从包的 anchor 入口导出（`@rune-engine/stage/anchor`）：算位置的库只有用到它的页面才带上。
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, watch, type VNodeChild } from 'vue';
import {
  followAnchor,
  type AnchorFollow,
  type AnchorOptions,
  type AnchorResult,
  type AnchorTarget,
} from './anchor.ts';
import { useStage } from './stage-context.ts';
import { StageLayer, type StageLayerProps } from './StageLayer.tsx';

export {
  followAnchor,
  type AnchorFollow,
  type AnchorOptions,
  type AnchorResult,
  type AnchorTarget,
};

export interface AnchoredProps extends Omit<StageLayerProps, 'fit' | 'x' | 'y'>, AnchorOptions {
  /** 贴着谁：一个元素，或者舞台里的一个点；还没有（元素没挂上）时先不显示 */
  anchor: AnchorTarget | null | undefined;
  /** 摆好了（头一回，和之后每次挪动）：告诉使用方最后在哪一侧 */
  onPlaced?: (result: AnchorResult) => void;
  children?: VNodeChild;
}

const styles = css.create({
  unplaced: { visibility: 'hidden' },
});

export const Anchored = _component(
  ({
    anchor,
    placement,
    offset,
    padding,
    matchWidth,
    fitHeight,
    onPlaced,
    sx,
    layerRef,
    children,
    ...rest
  }: AnchoredProps) => {
    const stage = useStage();
    let layer: HTMLElement | null = null;
    let follow: AnchorFollow | undefined;
    /** 现在盯着的锚点元素（点没有元素）：换了一个才要重新盯 */
    let watched: Element | undefined;
    let position = _state<AnchorResult | null>(null);

    const elementOf = (target: AnchorTarget | null | undefined) =>
      target instanceof Element ? target : undefined;

    function start() {
      follow?.stop();
      follow = undefined;
      const root = stage?.root.value;
      if (!root || !layer || !anchor) return;
      const floating = layer;
      watched = elementOf(anchor);
      follow = followAnchor(
        root,
        // 锚点换成没有的那一下还可能被叫到（排着队的重算）：用最后一次的
        () => anchor ?? watched ?? { x: 0, y: 0 },
        floating,
        () => ({ placement, offset, padding, matchWidth, fitHeight }),
        (result) => {
          const [side, align = 'center'] = result.placement.split('-');
          floating.dataset.side = side;
          floating.dataset.align = align;
          position = result;
          onPlaced?.(result);
        },
      );
    }

    watch(
      () => anchor,
      (next) => {
        if (!follow || elementOf(next) !== watched) start();
        else follow.update();
      },
    );
    watch(
      () => [placement, offset, padding, matchWidth, fitHeight],
      () => follow?.update(),
    );
    onBeforeUnmount(() => follow?.stop());

    return () => (
      <StageLayer
        {...rest}
        fit="content"
        x={position?.x ?? 0}
        y={position?.y ?? 0}
        sx={[sx, !position && styles.unplaced]}
        layerRef={(element) => {
          layer = element;
          layerRef?.(element);
          if (element) start();
        }}
      >
        {children}
      </StageLayer>
    );
  },
);
