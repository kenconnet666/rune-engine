/**
 * 舞台：一张画布，加上压在它上面的几层界面（world、hud、overlay、tips，见 stage-context.ts）。
 *
 * 这几层平时叠在画布上面，是普通的网页元素。浏览器支持（HTML-in-Canvas，新的 Chrome）、渲染线程也说“画面接上了”
 * 之后（setLive(true)），它们搬进画布里面，由渲染线程和画布上的画面一起合成：界面照常排版、照常响应鼠标键盘，
 * 但它成了画面的一部分——能过着色器、能和画面一起过场。渲染那头出了事（setLive(false)）就搬回来：
 * 界面不能跟着画面一起没了，报错的那行字还得看得见。两种摆法样子和操作都一样，差别只是有没有那些效果。
 *
 * 画布本身归使用方：onReady 里拿到它去建渲染线程，再把“往渲染线程发界面”的函数交回来（connect）。
 *
 *   <Stage world={<MapLabels />} onReady={(stage) => { … stage.connect(sendToRenderWorker) }}>
 *     …一直在的界面…
 *   </Stage>
 *
 * 每一层自己不接收指针（点得到下面的画布），里面的面板、按钮各自打开——和以前界面层的约定一样。
 */
import { PLAIN_MATERIAL, type UiMaterial, type UiMessage } from '@rune-engine/render/ui-types';
import {
  canvasUiSupported,
  createCanvasUi,
  type CanvasUi,
  type CanvasUiLayer,
} from './canvas-ui.ts';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted, provide, shallowRef, type VNodeChild } from 'vue';
import { mergeAttrs, type PartProps } from './props.ts';
import { STAGE, STAGE_LAYERS, type StageContext, type StageLayerName } from './stage-context.ts';
import { attachTips } from './tips.ts';

export interface StageHandle {
  readonly canvas: HTMLCanvasElement;
  /** 这个浏览器能不能把界面画进画布（不能的话 setLive、connect、refresh、material 都什么也不做） */
  readonly supported: boolean;
  /**
   * 渲染线程的画面接上了（true）：把界面搬进画布，交给它合成；画面断了（false）：搬回画布上面，照常显示。
   * 搬的时候元素本身不重建，里面的状态（滚到哪、焦点在哪）都留着
   */
  setLive(live: boolean): void;
  /** 接上渲染线程：拍下来的界面从 send 发出去 */
  connect(send: (message: UiMessage, transfer: Transferable[]) => void): void;
  /** 渲染线程那头的贴图没了（刚起来、显卡设备重建了）：全部重拍一遍 */
  refresh(): void;
  material(layer: StageLayerName, material: Partial<UiMaterial>, durationMs?: number): void;
  /** 一层“闪一下”：立刻变成 peak 的样子，再用 durationMs 毫秒回到它原来的贴法 */
  pulse(layer: StageLayerName, peak: Partial<UiMaterial>, durationMs: number): void;
}

export interface StageProps extends PartProps<'div'> {
  /** 画布的名称（读屏念它） */
  canvasLabel?: string;
  /** 画布的样式（光标之类） */
  canvasSx?: SxStyles;
  /** world 层的内容：跟着世界走的东西 */
  world?: VNodeChild;
  /** hud 层的内容 */
  children?: VNodeChild;
  onReady?: (stage: StageHandle) => void;
}

const styles = css.create({
  root: { position: 'relative', overflow: 'hidden' },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    outline: 'none',
  },
  // 一层：铺满，里面的东西按它来定位；自己不接收指针。
  // 搬进画布以后它的位置不再由排版说了算（画在哪由合成器定），大小由界面采集设成和画布一样
  layer: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
});

/** 层叠在画布上面的时候靠 z-index 分上下：和画进画布以后一样按 order 来（order 可以是小数） */
const stackOf = (order: number) => String(Math.round(order * 100));

/** 把元素挪到另一个父元素下面，尽量不惊动它（moveBefore 不会重置滚动位置、动画和焦点） */
function relocate(parent: Element, element: Element) {
  const target = parent as Element & { moveBefore?: (node: Node, before: Node | null) => void };
  if (target.moveBefore) target.moveBefore(element, null);
  else parent.append(element);
}

export const Stage = _component(
  ({ canvasLabel, canvasSx, world, children, onReady, ...rest }: StageProps) => {
    const supported = canvasUiSupported();
    const root = shallowRef<HTMLElement | null>(null);
    let canvas = _state.raw<HTMLCanvasElement | null>(null);
    const layers = Object.fromEntries(
      STAGE_LAYERS.map((name) => [name, shallowRef<HTMLElement | null>(null)]),
    ) as StageContext['layers'];
    const handles: Partial<Record<StageLayerName, CanvasUiLayer>> = {};
    /** 各层的贴法：界面不在画布里的时候也记着，搬进去时用上 */
    const materials: Partial<Record<StageLayerName, Partial<UiMaterial>>> = {};
    let send: ((message: UiMessage, transfer: Transferable[]) => void) | undefined;
    let modals = 0;
    /** 界面现在是不是在画布里 */
    let live = false;
    let ui: CanvasUi | undefined;

    /** 使用方自己加的层：元素、次序、现在的贴法；界面在画布里时还有它在采集那头的把手 */
    interface Extra {
      readonly element: HTMLElement;
      readonly order: number;
      material: Partial<UiMaterial>;
      handle?: CanvasUiLayer;
    }
    const extras = new Set<Extra>();

    /** 把一层搬进画布、登记给界面采集 */
    const enter = (
      created: CanvasUi,
      element: HTMLElement,
      order: number,
      kept: Partial<UiMaterial> | undefined,
    ) => {
      if (!canvas) return undefined;
      // 画布里的元素要带这个属性才画得出来
      element.setAttribute('drawable', '');
      relocate(canvas, element);
      const handle = created.addLayer(element, order);
      // 贴法是跟着层走的：搬出去又搬回来，接着用原来的
      if (kept) handle.set(kept);
      return handle;
    };
    /** 把一层搬回画布上面 */
    const leave = (element: HTMLElement) => {
      element.removeAttribute('drawable');
      element.style.width = '';
      element.style.height = '';
      if (root.value) relocate(root.value, element);
    };

    const material: StageContext['material'] = (layer, next, durationMs) => {
      materials[layer] = { ...materials[layer], ...next };
      handles[layer]?.set(next, durationMs);
    };
    const pulse: StageContext['pulse'] = (layer, peak, durationMs) => {
      const handle = handles[layer];
      if (!handle || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // 记着的贴法不动：闪完回到它
      handle.set(peak);
      handle.set({ ...PLAIN_MATERIAL, ...materials[layer] }, durationMs);
    };

    function setLive(next: boolean) {
      if (!supported || !root.value || !canvas || next === live) return;
      live = next;
      if (next) {
        const created = createCanvasUi(canvas);
        ui = created;
        STAGE_LAYERS.forEach((name, order) => {
          const element = layers[name].value;
          if (element) handles[name] = enter(created, element, order, materials[name]);
        });
        for (const extra of extras) {
          extra.handle = enter(created, extra.element, extra.order, extra.material);
        }
        if (send) created.connect(send);
        return;
      }
      ui?.dispose();
      ui = undefined;
      for (const name of STAGE_LAYERS) {
        handles[name] = undefined;
        const element = layers[name].value;
        if (element) leave(element);
      }
      for (const extra of extras) {
        extra.handle = undefined;
        leave(extra.element);
      }
    }

    provide(STAGE, {
      supported,
      get inCanvas() {
        return live;
      },
      root,
      layers,
      material,
      pulse,
      addLayer(element, order) {
        const extra: Extra = { element, order, material: {} };
        extras.add(extra);
        element.style.zIndex = stackOf(order);
        if (ui) extra.handle = enter(ui, element, order, undefined);
        return {
          set(next, durationMs) {
            extra.material = { ...extra.material, ...next };
            extra.handle?.set(next, durationMs);
          },
          remove() {
            extras.delete(extra);
            extra.handle?.remove();
            // 元素接着由加它的组件收走（它可能还在画布里：从哪里拿掉都一样）
          },
        };
      },
      openModal() {
        modals++;
        // 模态的东西在 overlay 层：它下面的两层不再响应操作，焦点也进不去
        for (const name of ['world', 'hud'] as const)
          layers[name].value?.toggleAttribute('inert', true);
        return () => {
          if (--modals > 0) return;
          for (const name of ['world', 'hud'] as const) {
            layers[name].value?.toggleAttribute('inert', false);
          }
        };
      },
    });

    let stopTips: (() => void) | undefined;
    onMounted(() => {
      if (!root.value || !canvas) return;
      stopTips = attachTips(root.value, () => layers.tips.value);
      STAGE_LAYERS.forEach((name, order) => {
        const element = layers[name].value;
        if (element) element.style.zIndex = stackOf(order);
      });
      // 画布里的东西要这个属性才当成“可以画的内容”来排版
      if (supported) canvas.setAttribute('content', 'drawable');
      onReady?.({
        canvas,
        supported,
        setLive,
        connect(next) {
          send = next;
          ui?.connect(next);
        },
        refresh: () => ui?.refresh(),
        material,
        pulse,
      });
    });
    onBeforeUnmount(() => {
      stopTips?.();
      ui?.dispose();
    });

    return () => {
      const content: Record<StageLayerName, VNodeChild> = {
        world,
        hud: children,
        overlay: null,
        tips: null,
      };
      // 在这里它们总是画布的兄弟；搬进画布、搬回来是 setLive 直接挪元素，不经过这里
      return (
        <div
          ref={(element: unknown) => (root.value = element as HTMLElement | null)}
          {...mergeAttrs<'div'>({ sx: styles.root }, rest)}
        >
          <canvas
            ref={_toRef(canvas)}
            aria-label={canvasLabel}
            {...css.attrs(styles.canvas, canvasSx)}
          />
          {STAGE_LAYERS.map((name) => (
            <div
              key={name}
              ref={(element: unknown) => (layers[name].value = element as HTMLElement | null)}
              data-stage-layer={name}
              {...css.attrs(styles.layer)}
            >
              {content[name]}
            </div>
          ))}
        </div>
      );
    };
  },
);
