/**
 * 界面合成器：把主线程拍下来的一层层界面贴到这一帧上（约定见 ui-types.ts）。
 * 每层一张和画布一样大的贴图，按 order 从下往上画；贴的时候可以带透明度、平移缩放旋转、颜色和几种效果。
 * 贴法的过渡在这里逐帧插值——主线程只说“用 300 毫秒变成这样”，之后它忙不忙都不影响动画。
 */
import type { ElementImageQueue, FrameLayer } from './frame-layer.ts';
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
const UNIFORM_FLOATS = 20;
/** 亮边的颜色从第几个浮点数开始放 */
const GLOW_AT = 16;

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
  // 绕画布中心缩放、旋转，再平移
  let center = layer.canvas * 0.5;
  let local = (corner * layer.canvas - center) * layer.scale;
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
  let at = in.uv * layer.canvas / layer.pixelRatio;
  var uv = in.uv;
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
    let spread = vec2f(1.5 * layer.glitch * layer.pixelRatio / layer.canvas.x, 0);
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
  return color * vec4f(layer.tint.rgb * layer.tint.a, layer.tint.a) * layer.opacity;
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
  /** 过渡：从 from 到 to，start 是开始的时刻（毫秒），duration 是 0 时直接是 to */
  from: number[];
  to: number[];
  start: number;
  duration: number;
  /** 等下一帧开始才知道“现在”是什么时候：收到过渡的消息时先记下，画的时候补上起点 */
  pendingStart: boolean;
  texture?: GPUTexture;
  uniform?: GPUBuffer;
  bindings?: GPUBindGroup;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export function createUiCompositor(options: UiCompositorOptions = {}): UiCompositor {
  const layers = new Map<number, LayerState>();
  /** 按 order 排好的层：有增删才重排 */
  let ordered: LayerState[] = [];
  let gpu: { device: GPUDevice; pipeline: GPURenderPipeline; sampler: GPUSampler } | undefined;
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

  function upload(layer: LayerState, image: ElementImage, width: number, height: number) {
    if (!gpu) return;
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
    (device.queue as unknown as ElementImageQueue).drawElementImageToTexture(
      { source: image },
      { texture: layer.texture, premultipliedAlpha: true, size: [width, height] },
    );
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
        case 'ui-image': {
          const layer = layerOf(message.layer);
          if (layer.order !== message.order) {
            layer.order = message.order;
            reorder();
          } else if (!ordered.includes(layer)) {
            reorder();
          }
          layer.pixelRatio = message.pixelRatio;
          upload(layer, message.image, Math.max(1, message.width), Math.max(1, message.height));
          message.image.close();
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
        case 'ui-clear': {
          const layer = layers.get(message.layer);
          if (layer) release(layer);
          break;
        }
        case 'ui-remove': {
          const layer = layers.get(message.layer);
          if (layer) release(layer);
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
        if (!layer.bindings || !layer.uniform) continue;
        if (layer.pendingStart) {
          layer.start = nowMs;
          layer.pendingStart = false;
        }
        const numbers = current(layer, nowMs);
        if (numbers[OPACITY]! <= 0 || numbers[TINT_ALPHA]! <= 0) continue;
        uniformData.set([width, height, layer.pixelRatio, nowMs / 1000]);
        uniformData.set(numbers, NUMBERS_AT);
        gpu.device.queue.writeBuffer(layer.uniform, 0, uniformData);
        pass.setBindGroup(0, layer.bindings);
        pass.draw(4);
      }
      pass.end();
    },
  };
}
