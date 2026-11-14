/**
 * 只画界面的渲染器：画布上没有别的画面（地图、场景），每一帧就是把各层界面贴上去。
 * 整站都是界面的页面用它（组件库的文档站）；有自己画面的，把合成器当作画面之上的一层接到自己的渲染器里
 * （见 map-renderer.ts 的 overlay）。
 *
 * 画布是带透明度的：没有界面的地方透出画布后面的网页（页面的底色还是 CSS 说了算）。
 * 显卡设备丢了会自己重建，重建好之前 onLost、之后 onRestored——界面那头据此搬回画布上面、再搬回来。
 */
import type { FrameLayer } from './frame-layer.ts';

export interface UiRendererOptions {
  canvas: OffscreenCanvas;
  /** 要画的界面：一般是 createUiCompositor() 的结果 */
  layer: FrameLayer;
  /** 设备丢了（原因），正在重建 */
  onLost?: (reason: string) => void;
  /** 设备重建好了，画面接上了 */
  onRestored?: () => void;
  /** 显卡报的错（同一条只报一次） */
  onError?: (message: string) => void;
}

export interface UiRenderer {
  /** 画布的像素尺寸变了 */
  resize(width: number, height: number): void;
  /** 画一帧 */
  render(nowMs: number): void;
  destroy(): void;
}

/** 设备重建不成（显卡进程还没回来）时隔多久再试（毫秒） */
const RETRY_MS = 1000;

interface Gpu {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

async function createGpu(canvas: UiRendererOptions['canvas']): Promise<Gpu> {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('这个浏览器没有可用的 WebGPU');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('画布拿不到 WebGPU 上下文');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });
  return { device, context, format };
}

export async function createUiRenderer(options: UiRendererOptions): Promise<UiRenderer> {
  const { canvas, layer, onLost, onRestored, onError } = options;
  let gpu: Gpu | undefined;
  let destroyed = false;
  const reported = new Set<string>();

  const adopt = (next: Gpu) => {
    gpu = next;
    layer.attach(next.device, next.format);
    next.device.addEventListener('uncapturederror', (event) => {
      const { message } = event.error;
      if (reported.has(message)) return;
      reported.add(message);
      onError?.(message);
    });
    void next.device.lost.then((info) => {
      if (destroyed || gpu !== next) return;
      gpu = undefined;
      layer.detach();
      onLost?.(info.message || info.reason);
      void restore();
    });
  };

  const restore = async () => {
    while (!destroyed) {
      try {
        const next = await createGpu(canvas);
        if (destroyed) {
          next.device.destroy();
          return;
        }
        adopt(next);
        onRestored?.();
        return;
      } catch (error) {
        onLost?.(String(error));
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
    }
  };

  adopt(await createGpu(canvas));

  return {
    resize(width, height) {
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
    },
    render(nowMs) {
      if (!gpu) return;
      const encoder = gpu.device.createCommandEncoder();
      const frame = gpu.context.getCurrentTexture().createView();
      // 先整张清成透明，界面再一层层贴上去
      encoder
        .beginRenderPass({
          colorAttachments: [
            {
              view: frame,
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        })
        .end();
      layer.draw(encoder, frame, canvas.width, canvas.height, nowMs);
      gpu.device.queue.submit([encoder.finish()]);
    },
    destroy() {
      destroyed = true;
      layer.detach();
      gpu?.device.destroy();
      gpu = undefined;
    },
  };
}
