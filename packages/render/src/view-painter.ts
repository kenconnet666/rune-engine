/**
 * 照着显示列表把界面画出来（约定见 view-types.ts）。它是“往一帧上接着画的一层”：只有界面的页面单独用它，
 * 有自己画面的（地图、三维场景）在主画面之后接着画它，同一帧出来。
 *
 * 整张表一次画完：矩形（圆角、边线）和文字是同一批四边形，片元里按种类分两种算法；每一项自己带着裁剪框，
 * 不用为了裁剪、为了先后把批次打断。
 *
 * 文字：一段字整段交给浏览器的文字引擎，画进一张图集（一块 2D 画布，按设备像素画，字是清楚的），显卡那头是它的一张贴图。
 * 图集里只存“有没有墨”，颜色是画的时候乘上去的，所以同一段字换颜色不用重画。新画进去的只把那几行传给显卡——
 * 整张重传的话，连着滚动时每帧都在传几千万像素。图集满了就整张清掉、把这一帧用到的重新画一遍。
 */
import type { FrameLayer } from './frame-layer.ts';
import {
  VIEW_ITEM,
  VIEW_ITEM_FLOATS,
  VIEW_KIND_TEXT,
  viewFontString,
  type ViewMessage,
  type ViewRun,
} from './view-types.ts';

export interface ViewPainter extends FrameLayer {
  /** 主线程来的一条消息 */
  handle(message: ViewMessage): void;
}

export interface ViewPainterOptions {
  /** 文字图集的边长（设备像素），默认 2048 */
  atlasSize?: number;
}

/** 显卡那头一项占几个数：位置大小、裁剪框、颜色、参数、边线颜色、种类（各 4 个） */
const INSTANCE_FLOATS = 24;
/** 图集里每段字四周留的空（设备像素）：相邻两段的墨不会串到对方的四边形里 */
const RUN_PAD = 1;

const SHADER = /* wgsl */ `
struct Globals {
  // 画布、图集各多大（像素）
  canvas: vec2f,
  atlas: vec2f,
}
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var atlas_sampler: sampler;
@group(0) @binding(2) var atlas: texture_2d<f32>;

struct Varyings {
  @builtin(position) position: vec4f,
  // 这个像素在这一项里的位置（从左上角起，像素）
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) size: vec2f,
  @location(2) @interpolate(flat) clip: vec4f,
  @location(3) @interpolate(flat) color: vec4f,
  @location(4) @interpolate(flat) param: vec4f,
  @location(5) @interpolate(flat) border: vec4f,
  @location(6) @interpolate(flat) kind: f32,
}

@vertex fn vertex(
  @builtin(vertex_index) index: u32,
  @location(0) rect: vec4f,
  @location(1) clip: vec4f,
  @location(2) color: vec4f,
  @location(3) param: vec4f,
  @location(4) border: vec4f,
  @location(5) extra: vec4f,
) -> Varyings {
  let corner = array(vec2f(0, 0), vec2f(1, 0), vec2f(0, 1), vec2f(1, 1))[index];
  let local = corner * rect.zw;
  let pixel = rect.xy + local;
  var out: Varyings;
  out.position = vec4f(pixel.x / globals.canvas.x * 2 - 1, 1 - pixel.y / globals.canvas.y * 2, 0, 1);
  out.local = local;
  out.size = rect.zw;
  out.clip = clip;
  out.color = color;
  out.param = param;
  out.border = border;
  out.kind = extra.x;
  return out;
}

@fragment fn fragment(in: Varyings) -> @location(0) vec4f {
  // 裁剪框以外的不画（按像素中心算）
  let at = in.position.xy;
  if (at.x < in.clip.x || at.y < in.clip.y || at.x >= in.clip.z || at.y >= in.clip.w) {
    discard;
  }
  if (in.kind > 0.5) {
    // 文字：图集里那一块的墨，乘上字的颜色。四边形和图集都对齐在整像素上，一个像素取一个像素
    let ink = textureSampleLevel(atlas, atlas_sampler, (in.param.xy + in.local) / globals.atlas, 0).a;
    let alpha = ink * in.color.a;
    return vec4f(in.color.rgb * alpha, alpha);
  }
  // 圆角矩形：到边的距离（里面是负的），边上半个像素之内过渡
  let radius = in.param.x;
  let half = in.size * 0.5;
  let q = abs(in.local - half) - (half - radius);
  let distance = length(max(q, vec2f(0))) + min(max(q.x, q.y), 0) - radius;
  let cover = clamp(0.5 - distance, 0, 1);
  let fill = vec4f(in.color.rgb * in.color.a, in.color.a);
  if (in.param.y <= 0) {
    return fill * cover;
  }
  // 有边线：离边 borderWidth 以内是边线的颜色，再往里是底色
  let inside = clamp(0.5 - (distance + in.param.y), 0, 1);
  let edge = vec4f(in.border.rgb * in.border.a, in.border.a);
  return mix(edge, fill, inside) * cover;
}
`;

/** 一段字在图集里的位置（设备像素，已经含四周留的空） */
interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 图集里的一行“架子”：同样高的字段排在同一行 */
interface Shelf {
  y: number;
  height: number;
  used: number;
}

export function createViewPainter({ atlasSize = 2048 }: ViewPainterOptions = {}): ViewPainter {
  let pixelRatio = 1;
  const runs = new Map<number, ViewRun>();
  const placements = new Map<number, Placement>();
  let shelves: Shelf[] = [];
  let shelfEnd = 0;
  /** 图集里这一帧画脏了的行：只把这一条传给显卡 */
  let dirtyFrom = Infinity;
  let dirtyTo = 0;
  const atlasCanvas = new OffscreenCanvas(atlasSize, atlasSize);
  const pen = atlasCanvas.getContext('2d');
  if (!pen) throw new Error('文字图集拿不到 2D 上下文');
  pen.textBaseline = 'alphabetic';
  pen.fillStyle = '#fff';

  /** 最新的一张显示列表，和它有没有变过（变了才重新算显卡那头的数据） */
  let items: Float32Array | undefined;
  let count = 0;
  let stale = false;
  let instances = new Float32Array(INSTANCE_FLOATS * 1024);
  let instanceCount = 0;

  let gpu:
    | {
        device: GPUDevice;
        pipeline: GPURenderPipeline;
        globals: GPUBuffer;
        texture: GPUTexture;
        bindings: GPUBindGroup;
        buffer: GPUBuffer;
      }
    | undefined;
  const globalsData = new Float32Array(4);

  function resetAtlas() {
    pen!.clearRect(0, 0, atlasSize, atlasSize);
    placements.clear();
    shelves = [];
    shelfEnd = 0;
    dirtyFrom = 0;
    dirtyTo = atlasSize;
  }

  /** 这段字在图集里的位置；还没画过就现在画。图集放不下了是 undefined */
  function place(id: number): Placement | undefined {
    const placed = placements.get(id);
    if (placed) return placed;
    const run = runs.get(id);
    if (!run) return undefined;
    pen!.font = viewFontString(run.font, pixelRatio);
    const metrics = pen!.measureText(run.text);
    const width = Math.min(atlasSize, Math.ceil(metrics.width) + RUN_PAD * 2);
    const height = Math.min(atlasSize, Math.ceil(run.lineHeight * pixelRatio) + RUN_PAD * 2);
    let shelf = shelves.find((each) => each.height === height && each.used + width <= atlasSize);
    if (!shelf) {
      if (shelfEnd + height > atlasSize) return undefined;
      shelf = { y: shelfEnd, height, used: 0 };
      shelves.push(shelf);
      shelfEnd += height;
    }
    const next = { x: shelf.used, y: shelf.y, width, height };
    shelf.used += width;
    // 字在这一行里竖着居中：按字体自己的上下沿算，同一种字体的各段基线对得齐
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    const baseline = Math.round((height - (ascent + descent)) / 2 + ascent);
    pen!.fillText(run.text, next.x + RUN_PAD, next.y + baseline);
    dirtyFrom = Math.min(dirtyFrom, next.y);
    dirtyTo = Math.max(dirtyTo, next.y + height);
    placements.set(id, next);
    return next;
  }

  /** 照显示列表算出显卡那头的数据。图集中途满了是 false（清掉图集再来一遍） */
  function build(): boolean {
    if (!items) return true;
    if (instances.length < count * INSTANCE_FLOATS) {
      instances = new Float32Array(INSTANCE_FLOATS * Math.ceil((count * 1.5) / 1024) * 1024);
    }
    const ratio = pixelRatio;
    let written = 0;
    for (let index = 0; index < count; index++) {
      const from = index * VIEW_ITEM_FLOATS;
      const to = written * INSTANCE_FLOATS;
      const isText = items[from + VIEW_ITEM.kind] === VIEW_KIND_TEXT;
      let left = Math.round(items[from + VIEW_ITEM.x]! * ratio);
      let top = Math.round(items[from + VIEW_ITEM.y]! * ratio);
      let width: number;
      let height: number;
      if (isText) {
        const placed = place(items[from + VIEW_ITEM.run]!);
        if (!placed) {
          // 没有这段字的定义：跳过；图集满了：从头再来
          if (runs.has(items[from + VIEW_ITEM.run]!)) return false;
          continue;
        }
        left -= RUN_PAD;
        top -= RUN_PAD;
        width = placed.width;
        height = placed.height;
        instances[to + 12] = placed.x;
        instances[to + 13] = placed.y;
      } else {
        // 两条边各自对齐到整像素：相邻的盒子之间不会出缝、也不会叠出一条深色的线
        const x = items[from + VIEW_ITEM.x]!;
        const y = items[from + VIEW_ITEM.y]!;
        width = Math.round((x + items[from + VIEW_ITEM.width]!) * ratio) - left;
        height = Math.round((y + items[from + VIEW_ITEM.height]!) * ratio) - top;
        if (width <= 0 || height <= 0) continue;
        const border = items[from + VIEW_ITEM.borderWidth]!;
        instances[to + 12] = items[from + VIEW_ITEM.radius]! * ratio;
        // 有边线的话至少一个像素宽
        instances[to + 13] = border > 0 ? Math.max(1, Math.round(border * ratio)) : 0;
        for (let channel = 0; channel < 4; channel++) {
          instances[to + 16 + channel] = items[from + VIEW_ITEM.borderColor + channel]!;
        }
      }
      instances[to] = left;
      instances[to + 1] = top;
      instances[to + 2] = width;
      instances[to + 3] = height;
      instances[to + 4] = Math.round(items[from + VIEW_ITEM.clipLeft]! * ratio);
      instances[to + 5] = Math.round(items[from + VIEW_ITEM.clipTop]! * ratio);
      instances[to + 6] = Math.round(items[from + VIEW_ITEM.clipRight]! * ratio);
      instances[to + 7] = Math.round(items[from + VIEW_ITEM.clipBottom]! * ratio);
      for (let channel = 0; channel < 4; channel++) {
        instances[to + 8 + channel] = items[from + VIEW_ITEM.color + channel]!;
      }
      instances[to + 20] = isText ? 1 : 0;
      written++;
    }
    instanceCount = written;
    return true;
  }

  return {
    attach(device, format) {
      const module = device.createShaderModule({ code: SHADER });
      const vec4 = (shaderLocation: number): GPUVertexAttribute => ({
        shaderLocation,
        offset: shaderLocation * 16,
        format: 'float32x4',
      });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module,
          entryPoint: 'vertex',
          buffers: [
            {
              arrayStride: INSTANCE_FLOATS * 4,
              stepMode: 'instance',
              attributes: [vec4(0), vec4(1), vec4(2), vec4(3), vec4(4), vec4(5)],
            },
          ],
        },
        fragment: {
          module,
          entryPoint: 'fragment',
          targets: [
            {
              format,
              // 片元出来的颜色是预乘过的
              blend: {
                color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              },
            },
          ],
        },
        primitive: { topology: 'triangle-strip' },
      });
      const globals = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const texture = device.createTexture({
        size: [atlasSize, atlasSize],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      gpu = {
        device,
        pipeline,
        globals,
        texture,
        bindings: device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: globals } },
            { binding: 1, resource: device.createSampler() },
            { binding: 2, resource: texture.createView() },
          ],
        }),
        buffer: device.createBuffer({
          size: instances.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        }),
      };
      // 新的贴图是空的：图集里已经画了的整个重传一遍
      dirtyFrom = 0;
      dirtyTo = shelfEnd;
      stale = true;
    },
    detach() {
      gpu?.texture.destroy();
      gpu?.buffer.destroy();
      gpu?.globals.destroy();
      gpu = undefined;
    },
    handle(message) {
      switch (message.type) {
        case 'view-scale':
          if (message.pixelRatio === pixelRatio) break;
          pixelRatio = message.pixelRatio;
          // 字是按设备像素画的：换了比例都要重画
          resetAtlas();
          stale = true;
          break;
        case 'view-runs':
          for (const run of message.runs) runs.set(run.id, run);
          break;
        case 'view-drop-runs':
          // 图集里占的地方先不收：等图集满了整张清的时候一起腾出来
          for (const id of message.ids) {
            runs.delete(id);
            placements.delete(id);
          }
          break;
        case 'view-frame':
          items = message.items;
          count = message.count;
          stale = true;
          break;
      }
    },
    draw(encoder, target, width, height) {
      if (!gpu || !items) return;
      const { device } = gpu;
      if (stale) {
        if (!build()) {
          resetAtlas();
          // 清过还放不下的（一帧里的字比整张图集还多）就只能少画几段
          build();
        }
        stale = false;
        if (gpu.buffer.size < instanceCount * INSTANCE_FLOATS * 4) {
          gpu.buffer.destroy();
          gpu.buffer = device.createBuffer({
            size: instances.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          });
        }
        device.queue.writeBuffer(gpu.buffer, 0, instances, 0, instanceCount * INSTANCE_FLOATS);
      }
      if (dirtyTo > dirtyFrom) {
        device.queue.copyExternalImageToTexture(
          { source: atlasCanvas, origin: [0, dirtyFrom] },
          { texture: gpu.texture, origin: [0, dirtyFrom], premultipliedAlpha: true },
          [atlasSize, dirtyTo - dirtyFrom],
        );
        dirtyFrom = Infinity;
        dirtyTo = 0;
      }
      if (instanceCount === 0) return;
      globalsData.set([width, height, atlasSize, atlasSize]);
      device.queue.writeBuffer(gpu.globals, 0, globalsData);
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: target, loadOp: 'load', storeOp: 'store' }],
      });
      pass.setPipeline(gpu.pipeline);
      pass.setBindGroup(0, gpu.bindings);
      pass.setVertexBuffer(0, gpu.buffer);
      pass.draw(4, instanceCount);
      pass.end();
    },
  };
}
