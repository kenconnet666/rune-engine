/**
 * 地区地图：每个地区是一组三角形，颜色不写在顶点里，而是按地区下标去一张小小的数据纹理里查。
 * 数值变了只改那张纹理（几 KB），网格不动；新旧数值之间在着色器里过渡，地图的颜色是“化开”的而不是跳变。
 *
 * 显卡设备会丢（驱动重启、显卡进程崩溃、标签页在后台太久被回收）：丢了以后设备上的东西全部作废。
 * 这里把“要画什么”（各地区的数值、相机、高亮）留在 CPU 这头，设备丢了就自己重建一套再接着画，调用方不用管。
 */
import { fitCamera, mapScale, type MapCamera } from './map-view.ts';
import type { RegionMeshData } from './mesh-format.ts';

export interface MapRendererOptions {
  canvas: OffscreenCanvas;
  mesh: RegionMeshData;
  regionCount: number;
  /** 显卡设备丢了，画面停了；重建是自动的，没建成之前每试一次失败也会再报一次原因 */
  onLost?: (reason: string) => void;
  /** 重建好了，画面接上了 */
  onRestored?: () => void;
}

export interface MapRenderer {
  /** 画布的像素尺寸变了 */
  resize(width: number, height: number): void;
  /** 各地区的数值（0–1）：从现在画面上的颜色过渡过去 */
  setValues(values: Float32Array, nowMs: number): void;
  /** 各地区的标记，按位：1 画斜纹（封锁） */
  setFlags(flags: Uint8Array): void;
  /** 指针停在哪个地区上、选中了哪个地区（下标，没有时给 -1）：停留的提亮，选中的描边 */
  setHighlight(hovered: number, selected: number): void;
  setCamera(camera: MapCamera): void;
  render(nowMs: number): void;
  /** 测试用：把设备弄丢，看能不能自己恢复 */
  loseDevice(): void;
  destroy(): void;
}

/** 数值过渡的时长 */
const BLEND_MS = 700;
const SAMPLES = 4;
/** 重建设备失败后隔多久再试 */
const RETRY_MS = 1500;
/** 着色器里 View 的大小（按 f32 数；对齐到 8 个） */
const VIEW_FLOATS = 8;

const SHADER = /* wgsl */ `
struct View {
  scale: vec2f,
  center: vec2f,
  blend: f32,
  time: f32,
};
@group(0) @binding(0) var<uniform> view: View;
// 每个地区一个像素：r 是过渡前的数值，g 是目标数值，b 是玩法的标记（1 封锁），a 是界面的标记（1 指针停留、2 选中）
@group(0) @binding(1) var regions: texture_2d<f32>;

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) region: u32,
};

@vertex fn vertex(@location(0) position: vec2f, @location(1) region: f32) -> VOut {
  var out: VOut;
  out.position = vec4f((position - view.center) * view.scale, 0.0, 1.0);
  out.region = u32(region);
  return out;
}

const LAND = vec3f(0.105, 0.145, 0.185);
const WARM = vec3f(0.949, 0.639, 0.227);
const HOT = vec3f(0.898, 0.282, 0.302);

@fragment fn fill(in: VOut) -> @location(0) vec4f {
  let data = textureLoad(regions, vec2i(i32(in.region), 0), 0);
  let eased = view.blend * view.blend * (3.0 - 2.0 * view.blend);
  let value = mix(data.r, data.g, eased);
  var color = mix(LAND, WARM, smoothstep(0.0, 0.55, value));
  color = mix(color, HOT, smoothstep(0.45, 1.0, value));
  // 有感染的地区轻微地呼吸，数值越高越明显
  color *= 1.0 + 0.06 * value * sin(view.time * 2.2 + f32(in.region));
  if ((u32(data.b) & 1u) != 0u) {
    // 封锁：屏幕空间的斜纹，缩放地图时粗细不变
    let stripe = fract((in.position.x + in.position.y) / 14.0);
    color = mix(color, vec3f(0.75, 0.85, 0.95), step(0.6, stripe) * 0.35);
  }
  let marks = u32(data.a);
  if ((marks & 1u) != 0u) { color = mix(color, vec3f(1.0), 0.14); }
  if ((marks & 2u) != 0u) { color = mix(color, vec3f(1.0), 0.07 + 0.05 * sin(view.time * 3.0)); }
  return vec4f(color, 1.0);
}

@fragment fn outline(in: VOut) -> @location(0) vec4f {
  let marks = u32(textureLoad(regions, vec2i(i32(in.region), 0), 0).a);
  // 选中的描边用近白色：地区本身可能已经是橙色、红色，信号色的线在上面看不出来
  if ((marks & 2u) != 0u) { return vec4f(1.0, 0.98, 0.92, 1.0); }
  if ((marks & 1u) != 0u) { return vec4f(0.85, 0.92, 1.0, 0.7); }
  return vec4f(0.62, 0.72, 0.82, 0.22);
}`;

/** 跟着设备走的那部分：设备丢了全部作废，要整套重建 */
interface Gpu {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
  readonly vertexBuffer: GPUBuffer;
  readonly indexBuffer: GPUBuffer;
  readonly lineBuffer: GPUBuffer;
  readonly viewBuffer: GPUBuffer;
  readonly regionTexture: GPUTexture;
  readonly bindGroup: GPUBindGroup;
  readonly fillPipeline: GPURenderPipeline;
  readonly outlinePipeline: GPURenderPipeline;
}

async function createGpu({ canvas, mesh, regionCount }: MapRendererOptions): Promise<Gpu> {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('这个浏览器没有可用的 WebGPU');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('画布拿不到 WebGPU 上下文');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const upload = (data: Float32Array | Uint32Array, usage: GPUBufferUsageFlags) => {
    const buffer = device.createBuffer({ size: data.byteLength, usage, mappedAtCreation: true });
    new Uint8Array(buffer.getMappedRange()).set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
    buffer.unmap();
    return buffer;
  };
  const viewBuffer = device.createBuffer({
    size: VIEW_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const regionTexture = device.createTexture({
    size: [regionCount, 1],
    format: 'rgba32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  const layout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {},
      },
      // 32 位浮点纹理不能过滤：这里只按整数坐标取
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' },
      },
    ],
  });
  const module = device.createShaderModule({ code: SHADER });
  const pipeline = (
    entryPoint: string,
    topology: GPUPrimitiveTopology,
    blend: GPUBlendState | undefined,
  ) =>
    device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: {
        module,
        entryPoint: 'vertex',
        buffers: [
          {
            arrayStride: 12,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32' },
            ],
          },
        ],
      },
      fragment: { module, entryPoint, targets: [{ format, blend }] },
      primitive: { topology },
      multisample: { count: SAMPLES },
    });
  const [fillPipeline, outlinePipeline] = await Promise.all([
    pipeline('fill', 'triangle-list', undefined),
    pipeline('outline', 'line-list', {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    }),
  ]);

  return {
    device,
    context,
    format,
    vertexBuffer: upload(mesh.vertices, GPUBufferUsage.VERTEX),
    indexBuffer: upload(mesh.indices, GPUBufferUsage.INDEX),
    lineBuffer: upload(mesh.lines, GPUBufferUsage.INDEX),
    viewBuffer,
    regionTexture,
    bindGroup: device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: viewBuffer } },
        { binding: 1, resource: regionTexture.createView() },
      ],
    }),
    fillPipeline,
    outlinePipeline,
  };
}

export async function createMapRenderer(options: MapRendererOptions): Promise<MapRenderer> {
  const { canvas, mesh, regionCount, onLost, onRestored } = options;

  /** 数据纹理在 CPU 这头的副本：r 过渡前、g 目标、b 玩法的标记、a 界面的标记。设备丢了它还在，重建后整张重传 */
  const regionData = new Float32Array(regionCount * 4);
  const viewData = new Float32Array(VIEW_FLOATS);
  const camera: MapCamera = fitCamera(mesh.bounds);
  let highlight: [hovered: number, selected: number] = [-1, -1];
  let blendStart = -BLEND_MS;
  let dirty = true;

  let gpu: Gpu | undefined;
  let multisampled: GPUTexture | undefined;
  let destroyed = false;

  const blendAt = (nowMs: number) => Math.min(1, (nowMs - blendStart) / BLEND_MS);

  /** 多重采样的那张画布大小的纹理：画布尺寸变了、设备换了都要重开 */
  const allocateTarget = () => {
    multisampled?.destroy();
    multisampled = gpu?.device.createTexture({
      size: [canvas.width, canvas.height],
      format: gpu.format,
      sampleCount: SAMPLES,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  };

  const adopt = (next: Gpu) => {
    gpu = next;
    dirty = true;
    allocateTarget();
    void next.device.lost.then((info) => {
      if (destroyed || gpu !== next) return;
      gpu = undefined;
      multisampled = undefined;
      onLost?.(info.message || info.reason);
      void restore();
    });
  };

  const restore = async () => {
    while (!destroyed) {
      try {
        const next = await createGpu(options);
        if (destroyed) {
          next.device.destroy();
          return;
        }
        adopt(next);
        onRestored?.();
        return;
      } catch (error) {
        // 显卡进程可能还没回来：报一下原因，等一会儿再试
        onLost?.(String(error));
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
    }
  };

  adopt(await createGpu(options));

  return {
    resize(width, height) {
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      allocateTarget();
    },
    setValues(values, nowMs) {
      // 过渡到一半又来了新数值：从画面上现在的样子接着走，不跳
      const t = blendAt(nowMs);
      const eased = t * t * (3 - 2 * t);
      for (let region = 0; region < regionCount; region++) {
        const at = region * 4;
        regionData[at] = regionData[at]! + (regionData[at + 1]! - regionData[at]!) * eased;
        regionData[at + 1] = values[region] ?? 0;
      }
      blendStart = nowMs;
      dirty = true;
    },
    setFlags(flags) {
      for (let region = 0; region < regionCount; region++) {
        regionData[region * 4 + 2] = flags[region] ?? 0;
      }
      dirty = true;
    },
    setHighlight(hovered, selected) {
      for (const region of highlight) if (region >= 0) regionData[region * 4 + 3] = 0;
      highlight = [hovered, selected];
      if (hovered >= 0 && hovered < regionCount) regionData[hovered * 4 + 3]! += 1;
      if (selected >= 0 && selected < regionCount) regionData[selected * 4 + 3]! += 2;
      dirty = true;
    },
    setCamera(next) {
      Object.assign(camera, next);
    },
    render(nowMs) {
      if (!gpu || !multisampled) return;
      const { device } = gpu;
      if (dirty) {
        device.queue.writeTexture(
          { texture: gpu.regionTexture },
          regionData,
          { bytesPerRow: regionCount * 16 },
          [regionCount, 1],
        );
        dirty = false;
      }
      const pixels = mapScale(mesh.bounds, canvas, camera.zoom);
      viewData.set([
        (pixels * 2) / canvas.width,
        (pixels * 2) / canvas.height,
        camera.x,
        camera.y,
        blendAt(nowMs),
        nowMs / 1000,
      ]);
      device.queue.writeBuffer(gpu.viewBuffer, 0, viewData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: multisampled.createView(),
            resolveTarget: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.05, b: 0.07, a: 1 },
            loadOp: 'clear',
            storeOp: 'discard',
          },
        ],
      });
      pass.setBindGroup(0, gpu.bindGroup);
      pass.setVertexBuffer(0, gpu.vertexBuffer);
      pass.setPipeline(gpu.fillPipeline);
      pass.setIndexBuffer(gpu.indexBuffer, 'uint32');
      pass.drawIndexed(mesh.indices.length);
      pass.setPipeline(gpu.outlinePipeline);
      pass.setIndexBuffer(gpu.lineBuffer, 'uint32');
      pass.drawIndexed(mesh.lines.length);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    loseDevice() {
      gpu?.device.destroy();
    },
    destroy() {
      destroyed = true;
      // 设备一销毁，它名下的缓冲、纹理跟着作废
      gpu?.device.destroy();
      gpu = undefined;
      multisampled = undefined;
    },
  };
}
