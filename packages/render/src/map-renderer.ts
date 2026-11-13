/**
 * 地区地图：每个地区是一组三角形，颜色不写在顶点里，而是按地区下标去一张小小的数据纹理里查。
 * 数值变了只改那张纹理（几 KB），网格不动；新旧数值之间在着色器里过渡，地图的颜色是“化开”的而不是跳变。
 * 地区下面有一张底图（海面、经纬网），上面有一层弧线（地区之间的连线），着色器见 map-shaders.ts。
 *
 * 显卡设备会丢（驱动重启、显卡进程崩溃、标签页在后台太久被回收）：丢了以后设备上的东西全部作废。
 * 这里把“要画什么”（各地区的数值、弧线、相机、高亮）留在 CPU 这头，设备丢了就自己重建一套再接着画，调用方不用管。
 */
import {
  ARC_FLOATS,
  ARC_SEGMENTS,
  ARC_SHADER,
  BACKDROP_SHADER,
  REGION_SHADER,
  VIEW_FLOATS,
} from './map-shaders.ts';
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

/** 一条弧线：地图上两个点之间的连线 */
export interface MapArc {
  readonly from: readonly [x: number, y: number];
  readonly to: readonly [x: number, y: number];
  /** 路线的种类，决定颜色和弯的程度 */
  readonly route: 'land' | 'air' | 'sea';
  /**
   * 静态的路线（一条淡淡的虚线）还是“刚发生的一下”（一道光沿着它走）；
   * 后者要给出它是什么时候开始的（和 render 的 nowMs 同一个钟）
   */
  readonly startMs?: number;
  /** 不透明度（0–1），默认 1 */
  readonly alpha?: number;
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
  /** 要画的弧线，整批换掉 */
  setArcs(arcs: readonly MapArc[]): void;
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
/** 弧线的缓冲一开始放得下多少条，不够了翻倍 */
const ARC_CAPACITY = 64;
const ROUTE_KIND = { land: 0, air: 1, sea: 2 } as const;

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
  /** 地区那一层用的（View 加数据纹理）、底图和弧线用的（只有 View） */
  readonly regionBindings: GPUBindGroup;
  readonly viewBindings: GPUBindGroup;
  readonly backdropPipeline: GPURenderPipeline;
  readonly fillPipeline: GPURenderPipeline;
  readonly outlinePipeline: GPURenderPipeline;
  readonly arcPipeline: GPURenderPipeline;
}

const ALPHA_BLEND: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
};

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

  const viewEntry: GPUBindGroupLayoutEntry = {
    binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: {},
  };
  const viewLayout = device.createBindGroupLayout({ entries: [viewEntry] });
  const regionLayout = device.createBindGroupLayout({
    entries: [
      viewEntry,
      // 32 位浮点纹理不能过滤：这里只按整数坐标取
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' },
      },
    ],
  });

  /** 建一条管线：各层的差别只在着色器、顶点怎么排、画什么图元、混不混合 */
  const pipeline = (
    layout: GPUBindGroupLayout,
    code: string,
    fragment: string,
    topology: GPUPrimitiveTopology,
    buffers: GPUVertexBufferLayout[],
    blend?: GPUBlendState,
  ) => {
    const module = device.createShaderModule({ code });
    return device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: 'vertex', buffers },
      fragment: { module, entryPoint: fragment, targets: [{ format, blend }] },
      primitive: { topology },
      multisample: { count: SAMPLES },
    });
  };
  const regionVertices: GPUVertexBufferLayout = {
    arrayStride: 12,
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' },
      { shaderLocation: 1, offset: 8, format: 'float32' },
    ],
  };
  const arcInstances: GPUVertexBufferLayout = {
    arrayStride: ARC_FLOATS * 4,
    stepMode: 'instance',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' },
      { shaderLocation: 1, offset: 8, format: 'float32x2' },
      { shaderLocation: 2, offset: 16, format: 'float32x4' },
    ],
  };
  const [backdropPipeline, fillPipeline, outlinePipeline, arcPipeline] = await Promise.all([
    pipeline(viewLayout, BACKDROP_SHADER, 'fragment', 'triangle-list', []),
    pipeline(regionLayout, REGION_SHADER, 'fill', 'triangle-list', [regionVertices]),
    pipeline(regionLayout, REGION_SHADER, 'outline', 'line-list', [regionVertices], ALPHA_BLEND),
    pipeline(viewLayout, ARC_SHADER, 'fragment', 'triangle-strip', [arcInstances], ALPHA_BLEND),
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
    regionBindings: device.createBindGroup({
      layout: regionLayout,
      entries: [
        { binding: 0, resource: { buffer: viewBuffer } },
        { binding: 1, resource: regionTexture.createView() },
      ],
    }),
    viewBindings: device.createBindGroup({
      layout: viewLayout,
      entries: [{ binding: 0, resource: { buffer: viewBuffer } }],
    }),
    backdropPipeline,
    fillPipeline,
    outlinePipeline,
    arcPipeline,
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
  /** 弧线在 CPU 这头的副本，和有几条 */
  let arcData = new Float32Array(ARC_CAPACITY * ARC_FLOATS);
  let arcCount = 0;
  let arcsDirty = false;

  let gpu: Gpu | undefined;
  let multisampled: GPUTexture | undefined;
  let arcBuffer: GPUBuffer | undefined;
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

  /** 弧线的缓冲：放不下了、设备换了都要重开 */
  const allocateArcs = () => {
    arcBuffer?.destroy();
    arcBuffer = gpu?.device.createBuffer({
      size: arcData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    arcsDirty = true;
  };

  const adopt = (next: Gpu) => {
    gpu = next;
    dirty = true;
    allocateTarget();
    allocateArcs();
    void next.device.lost.then((info) => {
      if (destroyed || gpu !== next) return;
      gpu = undefined;
      multisampled = undefined;
      arcBuffer = undefined;
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
    setArcs(arcs) {
      if (arcs.length * ARC_FLOATS > arcData.length) {
        let capacity = arcData.length / ARC_FLOATS;
        while (capacity < arcs.length) capacity *= 2;
        arcData = new Float32Array(capacity * ARC_FLOATS);
        allocateArcs();
      }
      arcs.forEach((arc, index) => {
        arcData.set(
          [
            arc.from[0],
            arc.from[1],
            arc.to[0],
            arc.to[1],
            (arc.startMs ?? 0) / 1000,
            ROUTE_KIND[arc.route],
            arc.alpha ?? 1,
            arc.startMs === undefined ? 1 : 0,
          ],
          index * ARC_FLOATS,
        );
      });
      arcCount = arcs.length;
      arcsDirty = true;
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
      if (arcsDirty && arcBuffer && arcCount > 0) {
        device.queue.writeBuffer(arcBuffer, 0, arcData, 0, arcCount * ARC_FLOATS);
      }
      arcsDirty = false;
      const pixels = mapScale(mesh.bounds, canvas, camera.zoom);
      viewData.set([
        (pixels * 2) / canvas.width,
        (pixels * 2) / canvas.height,
        camera.x,
        camera.y,
        blendAt(nowMs),
        nowMs / 1000,
        canvas.width,
        canvas.height,
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
      // 底图
      pass.setBindGroup(0, gpu.viewBindings);
      pass.setPipeline(gpu.backdropPipeline);
      pass.draw(3);
      // 地区：先填色，再描边界
      pass.setBindGroup(0, gpu.regionBindings);
      pass.setVertexBuffer(0, gpu.vertexBuffer);
      pass.setPipeline(gpu.fillPipeline);
      pass.setIndexBuffer(gpu.indexBuffer, 'uint32');
      pass.drawIndexed(mesh.indices.length);
      pass.setPipeline(gpu.outlinePipeline);
      pass.setIndexBuffer(gpu.lineBuffer, 'uint32');
      pass.drawIndexed(mesh.lines.length);
      // 弧线：每条是一个实例，一条带子
      if (arcBuffer && arcCount > 0) {
        pass.setBindGroup(0, gpu.viewBindings);
        pass.setPipeline(gpu.arcPipeline);
        pass.setVertexBuffer(0, arcBuffer);
        pass.draw((ARC_SEGMENTS + 1) * 2, arcCount);
      }
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
      arcBuffer = undefined;
    },
  };
}
