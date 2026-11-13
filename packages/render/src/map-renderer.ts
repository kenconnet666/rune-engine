/**
 * 地区地图：每个地区是一组三角形，颜色不写在顶点里，而是按地区下标去一张小小的数据纹理里查。
 * 数值变了只改那张纹理（几 KB），网格不动；新旧数值之间在着色器里过渡，地图的颜色是“化开”的而不是跳变。
 */
import type { RegionMeshData } from './mesh-format.ts';

export interface MapCamera {
  /** 视野中心（地图坐标） */
  x: number;
  y: number;
  /** 1 是整张地图刚好放进画布 */
  zoom: number;
}

export interface MapRendererOptions {
  canvas: OffscreenCanvas;
  mesh: RegionMeshData;
  regionCount: number;
}

export interface MapRenderer {
  /** 画布的像素尺寸变了 */
  resize(width: number, height: number): void;
  /** 各地区的数值（0–1）：从现在画面上的颜色过渡过去 */
  setValues(values: Float32Array, nowMs: number): void;
  /** 各地区的标记，按位：1 画斜纹（封锁） */
  setFlags(flags: Uint8Array): void;
  setCamera(camera: MapCamera): void;
  render(nowMs: number): void;
  destroy(): void;
}

/** 数值过渡的时长 */
const BLEND_MS = 700;
const SAMPLES = 4;

const SHADER = /* wgsl */ `
struct View {
  scale: vec2f,
  center: vec2f,
  blend: f32,
  time: f32,
};
@group(0) @binding(0) var<uniform> view: View;
// 每个地区一个像素：r 是过渡前的数值，g 是目标数值，b 是标记
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
  return vec4f(color, 1.0);
}

@fragment fn outline(in: VOut) -> @location(0) vec4f {
  return vec4f(0.62, 0.72, 0.82, 0.22);
}`;

export async function createMapRenderer(options: MapRendererOptions): Promise<MapRenderer> {
  const { canvas, mesh, regionCount } = options;
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
  const vertexBuffer = upload(mesh.vertices, GPUBufferUsage.VERTEX);
  const indexBuffer = upload(mesh.indices, GPUBufferUsage.INDEX);
  const lineBuffer = upload(mesh.lines, GPUBufferUsage.INDEX);

  const viewData = new Float32Array(8);
  const viewBuffer = device.createBuffer({
    size: viewData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const regionTexture = device.createTexture({
    size: [regionCount, 1],
    format: 'rgba32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  /** 数据纹理在 CPU 这头的副本：r 过渡前、g 目标、b 标记 */
  const regionData = new Float32Array(regionCount * 4);

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
  const bindGroup = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: viewBuffer } },
      { binding: 1, resource: regionTexture.createView() },
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

  const camera: MapCamera = {
    x: (mesh.bounds[0] + mesh.bounds[2]) / 2,
    y: (mesh.bounds[1] + mesh.bounds[3]) / 2,
    zoom: 1,
  };
  let multisampled: GPUTexture | undefined;
  let blendStart = -BLEND_MS;
  let dirty = true;

  const blendAt = (nowMs: number) => Math.min(1, (nowMs - blendStart) / BLEND_MS);

  return {
    resize(width, height) {
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      multisampled?.destroy();
      multisampled = device.createTexture({
        size: [canvas.width, canvas.height],
        format,
        sampleCount: SAMPLES,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
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
    setCamera(next) {
      Object.assign(camera, next);
    },
    render(nowMs) {
      if (!multisampled) return;
      if (dirty) {
        device.queue.writeTexture(
          { texture: regionTexture },
          regionData,
          { bytesPerRow: regionCount * 16 },
          [regionCount, 1],
        );
        dirty = false;
      }
      // 整张地图刚好放进画布时每个地图单位占多少像素，再乘缩放
      const pixels =
        Math.min(
          canvas.width / (mesh.bounds[2] - mesh.bounds[0]),
          canvas.height / (mesh.bounds[3] - mesh.bounds[1]),
        ) *
        0.94 *
        camera.zoom;
      viewData.set([
        (pixels * 2) / canvas.width,
        (pixels * 2) / canvas.height,
        camera.x,
        camera.y,
        blendAt(nowMs),
        nowMs / 1000,
      ]);
      device.queue.writeBuffer(viewBuffer, 0, viewData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: multisampled.createView(),
            resolveTarget: context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.05, b: 0.07, a: 1 },
            loadOp: 'clear',
            storeOp: 'discard',
          },
        ],
      });
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setPipeline(fillPipeline);
      pass.setIndexBuffer(indexBuffer, 'uint32');
      pass.drawIndexed(mesh.indices.length);
      pass.setPipeline(outlinePipeline);
      pass.setIndexBuffer(lineBuffer, 'uint32');
      pass.drawIndexed(mesh.lines.length);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      multisampled?.destroy();
      regionTexture.destroy();
      for (const buffer of [vertexBuffer, indexBuffer, lineBuffer, viewBuffer]) buffer.destroy();
      device.destroy();
    },
  };
}
