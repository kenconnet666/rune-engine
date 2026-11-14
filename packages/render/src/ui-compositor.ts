/**
 * 界面合成器：把主线程拍下来的一层层界面贴到这一帧上（约定见 ui-types.ts）。
 * 每层一张贴图（和这一层一样大），按 order 从下往上画在它该在的位置；贴的时候可以带透明度、平移缩放旋转、颜色和几种效果。
 * 拍下来的界面先在界面画布（2D）上画成像素，再拷进这一层的贴图：界面画布在这里只当工具用，画完就清空，自己不显示东西。
 *
 * “这一层在页面上的哪里”（点击、悬停、量位置都靠它）也归这里管：在 2D 的画布上，浏览器认的是**最后一次把它画在哪**——
 * 主线程说的位置会被这边的下一次画盖掉。而且只有画过的那一块点得到。所以每层的画面留着不关，
 * 位置定下来（新画面到了、挪了地方、过渡走完）就按它真正的位置整块画一遍再清掉：像素不留，位置和能点的范围留下了。
 * 贴法的过渡在这里逐帧插值——主线程只说“用 300 毫秒变成这样”，之后它忙不忙都不影响动画。
 */
import type { ElementImageContext, FrameLayer } from './frame-layer.ts';
import { PLAIN_MATERIAL, type ElementImage, type UiMaterial, type UiMessage } from './ui-types.ts';

export interface UiCompositor extends FrameLayer {
  /** 主线程来的一条消息 */
  handle(message: UiMessage): void;
}

export interface UiCompositorOptions {
  /** 贴图都没了（刚接上设备、设备重建了）：请主线程把各层重新拍一遍 */
  onNeedImages?: () => void;
  /** 一块块显现（reveal）时，刚出来的格子边上亮一下的颜色（RGB，各 0–1）。默认是不带色的亮 */
  glow?: readonly [number, number, number];
}

/** 一层的参数在着色器那头的样子：见 SHADER 里的 Layer */
const UNIFORM_FLOATS = 32;
/** 亮边的颜色、这一层的位置和大小、滚动区、滚动区该挪多少各从第几个浮点数开始放 */
const GLOW_AT = 16;
const RECT_AT = 20;
const SCROLL_RECT_AT = 24;
const SCROLL_SHIFT_AT = 28;

const SHADER = /* wgsl */ `
struct Layer {
  // 画布的像素尺寸；一个 CSS 像素合几个设备像素；时间（秒）
  canvas: vec2f,
  pixelRatio: f32,
  time: f32,
  // 平移（CSS 像素）、缩放、旋转（弧度）
  offset: vec2f,
  scale: f32,
  rotate: f32,
  // 不透明度；三种效果各自的量（见 UiMaterial）
  opacity: f32,
  scan: f32,
  glitch: f32,
  reveal: f32,
  tint: vec4f,
  // 显现时亮边的颜色
  glow: vec4f,
  // 这一层在画布上的左上角和它的大小（CSS 像素）
  rect: vec4f,
  // 层里的滚动区（左、上、宽、高，CSS 像素；宽是 0 就是没有），和它里面的画面该挪多少：
  // 拍这张画面之后又滚了这么远，新画面还没到
  scroll_rect: vec4f,
  scroll_shift: vec2f,
}
@group(0) @binding(0) var<uniform> layer: Layer;
@group(0) @binding(1) var smooth_sampler: sampler;
@group(0) @binding(2) var image: texture_2d<f32>;

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn vertex(@builtin(vertex_index) index: u32) -> Varyings {
  let corner = array(vec2f(0, 0), vec2f(1, 0), vec2f(0, 1), vec2f(1, 1))[index];
  // 绕这一层自己的中心缩放、旋转，再平移
  let size = layer.rect.zw * layer.pixelRatio;
  let center = layer.rect.xy * layer.pixelRatio + size * 0.5;
  let local = (corner - 0.5) * size * layer.scale;
  let c = cos(layer.rotate);
  let s = sin(layer.rotate);
  let pixel = center + vec2f(local.x * c - local.y * s, local.x * s + local.y * c)
    + layer.offset * layer.pixelRatio;
  return Varyings(
    vec4f(pixel.x / layer.canvas.x * 2 - 1, 1 - pixel.y / layer.canvas.y * 2, 0, 1),
    corner,
  );
}

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

@fragment fn fragment(in: Varyings) -> @location(0) vec4f {
  // 贴图里的像素位置（按 CSS 像素算：效果的粗细不跟着屏幕的缩放比变）
  let at = in.uv * layer.rect.zw;
  var uv = in.uv;
  // 滚动区里面：取挪过之后的位置；挪出了滚动区的（刚露出来、还没拍到的那一条）先空着
  var blank = false;
  let region = layer.scroll_rect;
  if (region.z > 0 && all(at >= region.xy) && all(at < region.xy + region.zw)) {
    let moved = at + layer.scroll_shift;
    blank = any(moved < region.xy) || any(moved >= region.xy + region.zw);
    uv = moved / layer.rect.zw;
  }
  // 下面几个分支的条件只看这一层的参数（整层一样），所以里面可以取贴图
  if (layer.glitch > 0) {
    // 错位：每隔一小会儿，十行里有一两行整行往旁边挪一点
    let row = floor(at.y / 6);
    let beat = floor(layer.time * 18);
    let shift = (hash(vec2f(row, beat)) - 0.5) * step(0.82, hash(vec2f(row * 0.37, beat))) * 0.04;
    uv.x += shift * layer.glitch;
  }
  var color = textureSample(image, smooth_sampler, uv);
  if (layer.glitch > 0) {
    // 色散：红、蓝两路各往两边偏一点（贴图是预乘过的，直接取分量）
    let spread = vec2f(1.5 * layer.glitch / layer.rect.z, 0);
    color.r = textureSample(image, smooth_sampler, uv + spread).r;
    color.b = textureSample(image, smooth_sampler, uv - spread).b;
  }
  if (layer.scan > 0) {
    // 扫描线往下走，整体轻微闪烁，偏一点冷色
    let line = 0.82 + 0.18 * sin(at.y * 2.1 - layer.time * 5);
    let flicker = 0.97 + 0.03 * sin(layer.time * 37);
    let lit = color.rgb * line * flicker + vec3f(0.0, 0.03, 0.05) * color.a;
    color = vec4f(mix(color.rgb, lit, layer.scan), color.a);
  }
  if (layer.reveal < 1) {
    // 显现：每个小格有个随机的门槛，reveal 越过它这一格才出来；刚出来的边缘亮一下。
    // 乘得比 1 多一截：快到 1 的时候所有格子都已经出来、边缘的亮也都过去了
    let progress = layer.reveal * 1.25;
    let threshold = hash(floor(at / 4));
    let shown = smoothstep(threshold - 0.04, threshold, progress);
    let edge = shown * (1 - smoothstep(threshold, threshold + 0.07, progress));
    color = color * shown + vec4f(layer.glow.rgb, 0) * edge * color.a;
  }
  // 贴图是预乘过的：颜色、不透明度都直接乘
  return color * vec4f(layer.tint.rgb * layer.tint.a, layer.tint.a) * layer.opacity
    * select(1.0, 0.0, blank);
}
`;

/** 贴法摊成一排数（都能插值），顺序就是着色器里从 offset 到 tint 的顺序 */
const numbersOf = (m: UiMaterial): number[] => [
  m.x,
  m.y,
  m.scale,
  m.rotate,
  m.opacity,
  m.scan,
  m.glitch,
  m.reveal,
  ...m.tint,
];
/** 这排数里不透明度、颜色的不透明度在第几个 */
const OPACITY = 4;
const TINT_ALPHA = 11;
/** 这排数从着色器参数的第几个浮点数开始放（前面是画布尺寸、像素比、时间） */
const NUMBERS_AT = 4;

interface LayerState {
  order: number;
  pixelRatio: number;
  /** 左上角在画布上的位置（CSS 像素） */
  x: number;
  y: number;
  /** 过渡：从 from 到 to，start 是开始的时刻（毫秒），duration 是 0 时直接是 to */
  from: number[];
  to: number[];
  start: number;
  duration: number;
  /** 等下一帧开始才知道“现在”是什么时候：收到过渡的消息时先记下，画的时候补上起点 */
  pendingStart: boolean;
  /** 层里的滚动区：它占哪一块、现在滚到哪、手里这张画面是滚到哪的时候拍的 */
  scroll?: { rect: readonly number[]; x: number; y: number; shotX: number; shotY: number };
  texture?: GPUTexture;
  uniform?: GPUBuffer;
  bindings?: GPUBindGroup;
  /** 这一层现在的画面：留着，位置变了要拿它再画一遍（见文件头） */
  image?: ElementImage;
  /** 上一次告诉浏览器的位置（x、y、平移、缩放、旋转拼成的一串）：没变就不用再说 */
  placed?: string;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export function createUiCompositor(options: UiCompositorOptions = {}): UiCompositor {
  const layers = new Map<number, LayerState>();
  /** 按 order 排好的层：有增删才重排 */
  let ordered: LayerState[] = [];
  let gpu: { device: GPUDevice; pipeline: GPURenderPipeline; sampler: GPUSampler } | undefined;
  /** 界面画布：把拍下来的界面画成像素的地方 */
  let surface:
    | { canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D & ElementImageContext }
    | undefined;
  const uniformData = new Float32Array(UNIFORM_FLOATS);
  uniformData.set(options.glow ?? [0.7, 0.7, 0.7], GLOW_AT);
  let lastNow = 0;

  const layerOf = (id: number): LayerState => {
    let layer = layers.get(id);
    if (!layer) {
      const plain = numbersOf(PLAIN_MATERIAL);
      layer = {
        order: 0,
        pixelRatio: 1,
        x: 0,
        y: 0,
        from: plain,
        to: plain,
        start: 0,
        duration: 0,
        pendingStart: false,
      };
      layers.set(id, layer);
    }
    return layer;
  };

  const reorder = () => {
    ordered = [...layers.values()].sort((a, b) => a.order - b.order);
  };

  /** 这一层此刻的贴法（过渡到一半时是中间值） */
  const current = (layer: LayerState, nowMs: number): number[] => {
    if (layer.duration <= 0) return layer.to;
    const t = ease(Math.min(1, Math.max(0, (nowMs - layer.start) / layer.duration)));
    return layer.to.map((to, index) => {
      const from = layer.from[index]!;
      return from + (to - from) * t;
    });
  };

  const release = (layer: LayerState) => {
    layer.texture?.destroy();
    layer.uniform?.destroy();
    layer.texture = undefined;
    layer.uniform = undefined;
    layer.bindings = undefined;
  };
  /** 这一层没有画面了（被藏起来、拿掉了） */
  const forget = (layer: LayerState) => {
    release(layer);
    layer.image?.close();
    layer.image = undefined;
    layer.placed = undefined;
  };

  /**
   * 告诉浏览器这一层在页面上的哪里：按它真正的位置（层的位置加贴法里的平移，绕自己的中心缩放、旋转）
   * 整块画一遍再清掉。numbers 是这一层此刻的贴法
   */
  function place(layer: LayerState, numbers: number[]) {
    if (!surface || !layer.image || !layer.texture) return;
    const [offsetX, offsetY, scale, rotate] = numbers as [number, number, number, number];
    const key = [layer.x, layer.y, offsetX, offsetY, scale, rotate, layer.pixelRatio].join();
    if (key === layer.placed) return;
    layer.placed = key;
    const { canvas, context } = surface;
    const ratio = layer.pixelRatio;
    const width = layer.texture.width / ratio;
    const height = layer.texture.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.translate(layer.x + offsetX + width / 2, layer.y + offsetY + height / 2);
    context.rotate(rotate);
    context.scale(scale, scale);
    context.translate(-width / 2, -height / 2);
    context.drawElementImage(layer.image, 0, 0, width, height, 0, 0, width, height);
    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function upload(layer: LayerState, image: ElementImage, width: number, height: number) {
    if (!gpu || !surface) return;
    const { device, pipeline, sampler } = gpu;
    if (layer.texture?.width !== width || layer.texture.height !== height) {
      release(layer);
      layer.texture = device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      layer.uniform = device.createBuffer({
        size: UNIFORM_FLOATS * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      layer.bindings = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: layer.uniform } },
          { binding: 1, resource: sampler },
          { binding: 2, resource: layer.texture.createView() },
        ],
      });
    }
    // 一块一块地画、一块一块地拷：一块最大是界面画布那么大，比它大的层（很高的内容）就分几块
    const { canvas, context } = surface;
    const ratio = layer.pixelRatio;
    for (let y = 0; y < height; y += canvas.height) {
      for (let x = 0; x < width; x += canvas.width) {
        const w = Math.min(canvas.width, width - x);
        const h = Math.min(canvas.height, height - y);
        context.clearRect(0, 0, w, h);
        context.drawElementImage(image, x / ratio, y / ratio, w / ratio, h / ratio, 0, 0, w, h);
        device.queue.copyExternalImageToTexture(
          { source: canvas },
          { texture: layer.texture, origin: [x, y], premultipliedAlpha: true },
          [w, h],
        );
      }
    }
    // 它盖在画面上面：留着刚画的东西的话，这一层会在页面上多显示一份
    context.clearRect(0, 0, canvas.width, canvas.height);
    // 刚才是画在画布的角上的：浏览器现在以为这一层在那里，下一帧按真正的位置再说一遍
    layer.placed = undefined;
  }

  return {
    attach(device, format) {
      const module = device.createShaderModule({ code: SHADER });
      gpu = {
        device,
        sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
        pipeline: device.createRenderPipeline({
          layout: 'auto',
          vertex: { module, entryPoint: 'vertex' },
          fragment: {
            module,
            entryPoint: 'fragment',
            targets: [
              {
                format,
                // 贴图是预乘过的
                blend: {
                  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                },
              },
            ],
          },
          primitive: { topology: 'triangle-strip' },
        }),
      };
      // 上一台设备上的贴图都作废了
      for (const layer of layers.values()) release(layer);
      options.onNeedImages?.();
    },
    detach() {
      for (const layer of layers.values()) release(layer);
      gpu = undefined;
    },
    handle(message) {
      switch (message.type) {
        case 'ui-canvas': {
          const context = message.canvas.getContext('2d');
          if (!context) throw new Error('界面画布拿不到 2D 上下文');
          surface = {
            canvas: message.canvas,
            context: context as OffscreenCanvasRenderingContext2D & ElementImageContext,
          };
          break;
        }
        case 'ui-resize': {
          // 改尺寸会清空画布：没变就别动
          if (!surface) break;
          const { canvas } = surface;
          if (canvas.width !== message.width) canvas.width = message.width;
          if (canvas.height !== message.height) canvas.height = message.height;
          break;
        }
        case 'ui-image': {
          const layer = layerOf(message.layer);
          if (layer.order !== message.order) {
            layer.order = message.order;
            reorder();
          } else if (!ordered.includes(layer)) {
            reorder();
          }
          layer.pixelRatio = message.pixelRatio;
          if (layer.scroll && message.scroll) {
            layer.scroll.shotX = message.scroll.x;
            layer.scroll.shotY = message.scroll.y;
          }
          layer.image?.close();
          layer.image = message.image;
          upload(layer, message.image, Math.max(1, message.width), Math.max(1, message.height));
          break;
        }
        case 'ui-material': {
          const layer = layerOf(message.layer);
          // 从画面上现在的样子接着走，不跳
          layer.from = current(layer, lastNow);
          layer.to = numbersOf(message.material);
          layer.duration = Math.max(0, message.durationMs);
          layer.pendingStart = layer.duration > 0;
          layer.start = lastNow;
          break;
        }
        case 'ui-place': {
          const layer = layerOf(message.layer);
          layer.x = message.x;
          layer.y = message.y;
          break;
        }
        case 'ui-scroll': {
          const layer = layerOf(message.layer);
          // 头一回听说：手里的画面就当是这时候拍的（不挪）
          layer.scroll = {
            shotX: message.x,
            shotY: message.y,
            ...layer.scroll,
            rect: message.rect,
            x: message.x,
            y: message.y,
          };
          break;
        }
        case 'ui-clear': {
          const layer = layers.get(message.layer);
          if (layer) forget(layer);
          break;
        }
        case 'ui-remove': {
          const layer = layers.get(message.layer);
          if (layer) forget(layer);
          layers.delete(message.layer);
          reorder();
          break;
        }
      }
    },
    draw(encoder, target, width, height, nowMs) {
      lastNow = nowMs;
      if (!gpu || ordered.length === 0) return;
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: target, loadOp: 'load', storeOp: 'store' }],
      });
      pass.setPipeline(gpu.pipeline);
      for (const layer of ordered) {
        if (!layer.bindings || !layer.uniform || !layer.texture) continue;
        if (layer.pendingStart) {
          layer.start = nowMs;
          layer.pendingStart = false;
        }
        const numbers = current(layer, nowMs);
        // 过渡走到头了（或者本来就没有）才告诉浏览器位置：过渡当中每帧都说一遍就是每帧把整层白画一遍
        if (layer.duration <= 0 || nowMs >= layer.start + layer.duration) place(layer, numbers);
        if (numbers[OPACITY]! <= 0 || numbers[TINT_ALPHA]! <= 0) continue;
        uniformData.set([width, height, layer.pixelRatio, nowMs / 1000]);
        uniformData.set(numbers, NUMBERS_AT);
        uniformData.set(
          [
            layer.x,
            layer.y,
            layer.texture.width / layer.pixelRatio,
            layer.texture.height / layer.pixelRatio,
          ],
          RECT_AT,
        );
        const { scroll } = layer;
        uniformData.set(scroll?.rect ?? [0, 0, 0, 0], SCROLL_RECT_AT);
        uniformData.set(
          scroll ? [scroll.x - scroll.shotX, scroll.y - scroll.shotY] : [0, 0],
          SCROLL_SHIFT_AT,
        );
        gpu.device.queue.writeBuffer(layer.uniform, 0, uniformData);
        pass.setBindGroup(0, layer.bindings);
        pass.draw(4);
      }
      pass.end();
    },
  };
}
