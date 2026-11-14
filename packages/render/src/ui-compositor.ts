/**
 * 界面合成器：把主线程拍下来的一层层界面贴到这一帧上（约定见 ui-types.ts）。
 * 每层一张贴图（和这一层一样大），按 order 从下往上画在它该在的位置；贴的时候可以带透明度、平移缩放旋转、颜色和几种效果。
 * 拍下来的界面先在界面画布（2D）上画成像素，再拷进这一层的贴图：界面画布在这里只当工具用，画完就清空，自己不显示东西。
 *
 * “这一层在页面上的哪里”（点击、悬停、量位置都靠它）也归这里管：在 2D 的画布上，浏览器认的是**最后一次把它画在哪**——
 * 主线程说的位置会被这边的下一次画盖掉。而且只有画过的那一块点得到。所以每层的画面留着不关，
 * 位置定下来（新画面到了、挪了地方、过渡走完）就按它真正的位置整块画一遍再清掉：像素不留，位置和能点的范围留下了。
 * 贴法的过渡在这里逐帧插值——主线程只说“用 300 毫秒变成这样”，之后它忙不忙都不影响动画。
 *
 * 滚动层（内容比露出来的那块长）的贴图是一条**带子**：切成一格格，比露出来的上下各多备几格，首尾相接着用
 * （内容里的第 i 格放在带子的第 i mod n 格，取样到头绕回来）。滚动的时候只是挪取样的位置，新露出来的格子才画——
 * 每帧把露出来的整块重新画成像素的话，显卡一帧要多干五到二十毫秒，滚起来渲染线程只剩三四十帧。
 * 它在页面上的位置另外说：按真正的位置“画”一遍、但裁得只剩一个像素——浏览器照样认这个位置，像素一个不出。
 */
import type { ElementImageContext, FrameLayer } from './frame-layer.ts';
import {
  PLAIN_MATERIAL,
  type ElementImage,
  type UiMaterial,
  type UiMessage,
  type UiReport,
} from './ui-types.ts';

export interface UiCompositor extends FrameLayer {
  /** 主线程来的一条消息 */
  handle(message: UiMessage): void;
}

export interface UiCompositorOptions {
  /** 要回给主线程的话（见 UiReport）：使用方原样发回去，交给舞台的 receive */
  report?: (message: UiReport) => void;
  /** 一块块显现（reveal）时，刚出来的格子边上亮一下的颜色（RGB，各 0–1）。默认是不带色的亮 */
  glow?: readonly [number, number, number];
}

/** 一层的参数在着色器那头的样子：见 SHADER 里的 Layer */
const UNIFORM_FLOATS = 28;
/** 亮边的颜色、这一层的位置和大小、取贴图的哪一块各从第几个浮点数开始放 */
const GLOW_AT = 16;
const RECT_AT = 20;
const SAMPLE_AT = 24;
/** 滚动层的带子一格多高（设备像素）；露出来的上下各多备几格 */
const TILE = 256;
const SPARE_TILES = 2;
/** 内容刚换过的这段时间（毫秒）里不备多的格子：它多半马上又要换（悬停的过渡、动画），备了也白备 */
const SPARE_AFTER_MS = 120;
/** 缓着滚：每过这么久（毫秒），离目的地的距离缩到原来的 1/e */
const SCROLL_EASE_MS = 45;

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
  // 取贴图的哪一块：左上角、大小（整张贴图是 1）。滚动层的贴图是首尾相接的带子，纵向取到头会绕回来
  sample: vec4f,
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
  var uv = layer.sample.xy + in.uv * layer.sample.zw;
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
  /**
   * 滚动层：画面上露出多大一块（CSS 像素）、要滚到哪（x、y）、现在画的是哪（shownX、shownY，缓着跟过去）、
   * 这一帧要不要重画那一块（内容换了、滚了、挪了地方）
   */
  scroll?: {
    width: number;
    height: number;
    x: number;
    y: number;
    shownX: number;
    shownY: number;
    /** 位置要重新告诉浏览器（滚了、挪了地方、内容换了） */
    dirty: boolean;
    /** 带子的每一格现在装的是内容里的第几格（-1 是空的） */
    held: number[];
    /** 带子里的画面是按哪个横向位置、多高的格子画的（设备像素）：变了就全部作废 */
    heldX: number;
    tile: number;
    /** 上一次往哪边滚：多备的格子先备那一边 */
    heading: 1 | -1;
    /** 内容是什么时候换的（毫秒） */
    changedAt: number;
  };
  /** 整份内容多高（设备像素）：滚动层用，内容以外的格子不用备 */
  contentHeight?: number;
  /** 画出来多大（设备像素）：平常就是贴图的大小，滚动层是露出来的那块 */
  size?: { width: number; height: number };
  /** 贴图是不是纵向首尾相接着取样的（滚动层的带子） */
  wrapped?: boolean;
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
  let gpu:
    | {
        device: GPUDevice;
        pipeline: GPURenderPipeline;
        sampler: GPUSampler;
        /** 纵向取到头绕回来的：滚动层的带子用 */
        wrapSampler: GPUSampler;
      }
    | undefined;
  /** 界面画布：把拍下来的界面画成像素的地方 */
  let surface:
    | { canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D & ElementImageContext }
    | undefined;
  const uniformData = new Float32Array(UNIFORM_FLOATS);
  uniformData.set(options.glow ?? [0.7, 0.7, 0.7], GLOW_AT);
  let lastNow = 0;
  /** 上一帧之后有新画面到的层：这一帧画完告诉主线程“画上了” */
  const arrived = new Set<number>();

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
  /** 一层的位置拼成的一串：和上次说的一样就不用再说 */
  const placeKey = (layer: LayerState, numbers: number[]) =>
    [layer.x, layer.y, ...numbers.slice(0, 4), layer.pixelRatio].join();

  function place(layer: LayerState, numbers: number[]) {
    if (!surface || !layer.image || !layer.texture) return;
    const [offsetX, offsetY, scale, rotate] = numbers as [number, number, number, number];
    const key = placeKey(layer, numbers);
    if (key === layer.placed) return;
    layer.placed = key;
    const { context } = surface;
    const ratio = layer.pixelRatio;
    const width = layer.texture.width / ratio;
    const height = layer.texture.height / ratio;
    // 只为了说位置：裁得只剩一个像素，浏览器照样认这个位置，像素不用真画出来
    context.save();
    context.beginPath();
    context.rect(0, 0, 1, 1);
    context.clip();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.translate(layer.x + offsetX + width / 2, layer.y + offsetY + height / 2);
    context.rotate(rotate);
    context.scale(scale, scale);
    context.translate(-width / 2, -height / 2);
    context.drawElementImage(layer.image, 0, 0, width, height, 0, 0, width, height);
    context.restore();
    context.clearRect(0, 0, 1, 1);
  }

  /** 这一层的贴图是这么大（设备像素）、这么取样：不是就重建（重建了是 true） */
  function ensureTexture(layer: LayerState, width: number, height: number, wrapped = false) {
    if (!gpu) return false;
    const { device, pipeline } = gpu;
    if (
      layer.texture?.width === width &&
      layer.texture.height === height &&
      layer.wrapped === wrapped
    ) {
      return false;
    }
    release(layer);
    layer.wrapped = wrapped;
    const sampler = wrapped ? gpu.wrapSampler : gpu.sampler;
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
    return true;
  }

  function upload(layer: LayerState, image: ElementImage, width: number, height: number) {
    if (!gpu || !surface) return;
    const { device } = gpu;
    ensureTexture(layer, width, height);
    if (!layer.texture) return;
    layer.size = { width, height };
    const { canvas, context } = surface;
    const ratio = layer.pixelRatio;
    // 平常的情况（没有缩放旋转、整层都在画布里面）：直接画在它真正在的地方再拷走。
    // 浏览器认的是最后一次把它画在哪——先画在角上、下一帧才按真位置画的话，中间那一帧点击和悬停都落在错的地方
    // （侧栏的菜单：指针不动，悬停却在两项之间来回跳，一跳又引出一次重拍）
    const numbers = current(layer, lastNow);
    const [offsetX, offsetY, scale, rotate] = numbers as [number, number, number, number];
    const dx = Math.round((layer.x + offsetX) * ratio);
    const dy = Math.round((layer.y + offsetY) * ratio);
    if (
      scale === 1 &&
      rotate === 0 &&
      dx >= 0 &&
      dy >= 0 &&
      dx + width <= canvas.width &&
      dy + height <= canvas.height
    ) {
      context.clearRect(dx, dy, width, height);
      context.drawElementImage(image, 0, 0, width / ratio, height / ratio, dx, dy, width, height);
      device.queue.copyExternalImageToTexture(
        { source: canvas, origin: [dx, dy] },
        { texture: layer.texture, premultipliedAlpha: true },
        [width, height],
      );
      context.clearRect(0, 0, canvas.width, canvas.height);
      layer.placed = placeKey(layer, numbers);
      return;
    }
    // 不然一块一块地画、一块一块地拷：一块最大是界面画布那么大，比它大的层就分几块
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

  /**
   * 滚动层：带子里缺的格子补上，位置变了就重新告诉浏览器。露出来的格子缺了当场补；多备的一帧最多补一格
   * （先补正在滚去的那边）。moving 是这一帧还在往要去的地方滚
   */
  function prepare(layer: LayerState, nowMs: number, moving: boolean) {
    const { scroll, image } = layer;
    if (!gpu || !surface || !scroll || !image) return;
    const { canvas, context } = surface;
    const ratio = layer.pixelRatio;
    const width = Math.min(canvas.width, Math.max(1, Math.round(scroll.width * ratio)));
    const height = Math.min(canvas.height, Math.max(1, Math.round(scroll.height * ratio)));
    // 一格不能比界面画布还高：格子是在它上面画的
    const tile = Math.min(TILE, canvas.height);
    const limit = Math.floor(gpu.device.limits.maxTextureDimension2D / tile);
    const slots = Math.min(limit, Math.ceil(height / tile) + 1 + SPARE_TILES * 2);
    const rebuilt = ensureTexture(layer, width, slots * tile, true);
    if (!layer.texture) return;
    layer.size = { width, height };
    // 按整个设备像素滚：停在半个像素上字是糊的
    const left = Math.round(scroll.shownX * ratio);
    const top = Math.round(scroll.shownY * ratio);
    if (rebuilt || scroll.held.length !== slots || scroll.heldX !== left || scroll.tile !== tile) {
      scroll.held = new Array<number>(slots).fill(-1);
      scroll.heldX = left;
      scroll.tile = tile;
    }
    const { held } = scroll;
    const slotOf = (index: number) => ((index % slots) + slots) % slots;
    const missing = (index: number) => index >= 0 && held[slotOf(index)] !== index;
    const first = Math.floor(top / tile);
    const last = Math.floor((top + height - 1) / tile);
    const wanted: number[] = [];
    for (let index = first; index <= last; index++) if (missing(index)) wanted.push(index);
    if (wanted.length === 0 && (moving || nowMs - scroll.changedAt >= SPARE_AFTER_MS)) {
      // 露出来的都有了：多备一格。内容以外的不用备
      const end = Math.ceil((layer.contentHeight ?? 0) / tile);
      const spare = Math.min(SPARE_TILES, Math.floor((slots - (last - first + 1)) / 2));
      for (let step = 1; step <= spare && wanted.length === 0; step++) {
        const ahead = scroll.heading > 0 ? last + step : first - step;
        const behind = scroll.heading > 0 ? first - step : last + step;
        for (const index of [ahead, behind]) {
          if (index < end && missing(index)) {
            wanted.push(index);
            break;
          }
        }
      }
    }
    // 连着的几格一次画完、一次拷走（带子上也得是连着的，而且不比界面画布高）
    for (let at = 0; at < wanted.length;) {
      const start = wanted[at]!;
      const slot = slotOf(start);
      let count = 1;
      while (
        wanted[at + count] === start + count &&
        slot + count < slots &&
        (count + 1) * tile <= canvas.height
      ) {
        count++;
      }
      const rows = count * tile;
      context.clearRect(0, 0, width, rows);
      context.drawElementImage(
        image,
        left / ratio,
        (start * tile) / ratio,
        width / ratio,
        rows / ratio,
        0,
        0,
        width,
        rows,
      );
      gpu.device.queue.copyExternalImageToTexture(
        { source: canvas },
        { texture: layer.texture, origin: [0, slot * tile], premultipliedAlpha: true },
        [width, rows],
      );
      for (let step = 0; step < count; step++) held[slot + step] = start + step;
      at += count;
    }
    if (wanted.length > 0) context.clearRect(0, 0, canvas.width, canvas.height);
    else if (!scroll.dirty) return;
    // 告诉浏览器内容现在在哪、露出来的是哪一块（刚才画格子是画在角上的，也得重新说）：
    // 点击、悬停、量位置都跟着它，而且正好只有露出来的这一块点得到。裁得只剩一个像素，不用真画
    const dx = Math.min(Math.max(0, Math.round(layer.x * ratio)), canvas.width - width);
    const dy = Math.min(Math.max(0, Math.round(layer.y * ratio)), canvas.height - height);
    context.save();
    context.beginPath();
    context.rect(0, 0, 1, 1);
    context.clip();
    context.drawElementImage(
      image,
      left / ratio,
      top / ratio,
      width / ratio,
      height / ratio,
      dx,
      dy,
      width,
      height,
    );
    context.restore();
    context.clearRect(0, 0, 1, 1);
    scroll.dirty = false;
  }

  return {
    attach(device, format) {
      const module = device.createShaderModule({ code: SHADER });
      gpu = {
        device,
        sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
        wrapSampler: device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeV: 'repeat',
        }),
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
      options.report?.({ type: 'ui-request' });
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
          arrived.add(message.layer);
          if (layer.order !== message.order) {
            layer.order = message.order;
            reorder();
          } else if (!ordered.includes(layer)) {
            reorder();
          }
          layer.pixelRatio = message.pixelRatio;
          layer.image?.close();
          layer.image = message.image;
          if (message.view) {
            // 滚动层：不整份画，下一帧起把露出来的格子画出来；带子里原来的都作废
            layer.contentHeight = message.height;
            layer.scroll = {
              x: 0,
              y: 0,
              shownX: 0,
              shownY: 0,
              heldX: 0,
              tile: 0,
              heading: 1,
              ...layer.scroll,
              ...message.view,
              held: [],
              changedAt: lastNow,
              dirty: true,
            };
          } else {
            layer.scroll = undefined;
            upload(layer, message.image, Math.max(1, message.width), Math.max(1, message.height));
          }
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
          if (layer.scroll) layer.scroll.dirty = true;
          break;
        }
        case 'ui-scroll': {
          const scroll = layers.get(message.layer)?.scroll;
          if (!scroll) break;
          scroll.x = message.x;
          scroll.y = message.y;
          if (!message.smooth) {
            scroll.shownX = message.x;
            scroll.shownY = message.y;
          }
          scroll.dirty = true;
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
      const elapsed = nowMs - lastNow;
      lastNow = nowMs;
      if (!gpu || ordered.length === 0) return;
      // 滚动层：往要去的地方缓着靠过去；位置变了、内容换了就把露出来的那块重画
      const step = 1 - Math.exp(-Math.max(0, elapsed) / SCROLL_EASE_MS);
      for (const layer of ordered) {
        const { scroll } = layer;
        if (!scroll) continue;
        for (const [shown, to] of [
          ['shownX', 'x'],
          ['shownY', 'y'],
        ] as const) {
          const gap = scroll[to] - scroll[shown];
          if (gap === 0) continue;
          scroll[shown] = Math.abs(gap) < 0.5 ? scroll[to] : scroll[shown] + gap * step;
          scroll.dirty = true;
          if (to === 'y') scroll.heading = gap > 0 ? 1 : -1;
        }
        prepare(layer, nowMs, scroll.y !== scroll.shownY);
      }
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: target, loadOp: 'load', storeOp: 'store' }],
      });
      pass.setPipeline(gpu.pipeline);
      for (const layer of ordered) {
        if (!layer.bindings || !layer.uniform || !layer.texture || !layer.size) continue;
        if (layer.pendingStart) {
          layer.start = nowMs;
          layer.pendingStart = false;
        }
        const numbers = current(layer, nowMs);
        // 过渡走到头了（或者本来就没有）才告诉浏览器位置：过渡当中每帧都说一遍就是每帧把整层白画一遍。
        // 滚动层不用：它每回都是画在自己真正在的地方的
        if (!layer.scroll && (layer.duration <= 0 || nowMs >= layer.start + layer.duration)) {
          place(layer, numbers);
        }
        if (numbers[OPACITY]! <= 0 || numbers[TINT_ALPHA]! <= 0) continue;
        uniformData.set([width, height, layer.pixelRatio, nowMs / 1000]);
        uniformData.set(numbers, NUMBERS_AT);
        uniformData.set(
          [
            layer.x,
            layer.y,
            layer.size.width / layer.pixelRatio,
            layer.size.height / layer.pixelRatio,
          ],
          RECT_AT,
        );
        // 滚动层：从带子上露出来的那块开始取（内容里的第 r 行在带子的第 r mod 带子高 行）
        const band = layer.scroll && layer.texture.height;
        uniformData.set(
          band
            ? [
                0,
                (Math.round(layer.scroll!.shownY * layer.pixelRatio) % band) / band,
                1,
                layer.size.height / band,
              ]
            : [0, 0, 1, 1],
          SAMPLE_AT,
        );
        gpu.device.queue.writeBuffer(layer.uniform, 0, uniformData);
        pass.setBindGroup(0, layer.bindings);
        pass.draw(4);
      }
      pass.end();
      if (arrived.size > 0) {
        options.report?.({ type: 'ui-drawn', layers: [...arrived] });
        arrived.clear();
      }
    },
  };
}
