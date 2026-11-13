/**
 * 地图的着色器（WGSL）。三层从下往上画：
 *   底图  整屏一张：深色的海面、四周压暗一点、淡淡的经纬网
 *   地区  每个地区一组三角形，颜色按地区下标去数据纹理里查；再用线画一遍边界
 *   弧线  地区之间的连线（航线、海运、疾病跳过去的那一下），在着色器里弯成弧、展成有宽度的带子
 * 三层共用一个 View：相机、时间、画布的像素尺寸。
 */

/** View 的大小（按 f32 数） */
export const VIEW_FLOATS = 8;
/** 一条弧线的数据占几个 f32：from.xy、to.xy、起始时间、路线种类、不透明度、是不是静态的路线 */
export const ARC_FLOATS = 8;
/** 一条弧线切成多少段 */
export const ARC_SEGMENTS = 40;

const VIEW = /* wgsl */ `
struct View {
  scale: vec2f,
  center: vec2f,
  blend: f32,
  time: f32,
  viewport: vec2f,
};
@group(0) @binding(0) var<uniform> view: View;
`;

export const BACKDROP_SHADER = /* wgsl */ `
${VIEW}

// 一个盖住整屏的大三角形，不用顶点缓冲
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
  return vec4f(corner * 2.0 - 1.0, 0.0, 1.0);
}

const DEEP = vec3f(0.030, 0.043, 0.060);
const SHALLOW = vec3f(0.043, 0.062, 0.086);
const PI = 3.14159265;

// 一组等距的线：value 每到整数处一条，粗细约一个像素
fn gridLine(value: f32) -> f32 {
  let distance = abs(fract(value + 0.5) - 0.5) / max(fwidth(value), 1e-6);
  return 1.0 - clamp(distance, 0.0, 1.0);
}

@fragment fn fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / view.viewport;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  // 这个像素在地图上的位置；米勒投影下 x 就是经度（弧度），y 反解出纬度
  let map = ndc / view.scale + view.center;
  let latitude = 2.5 * (atan(exp(0.8 * map.y)) - PI / 4.0);

  // 中间亮一点、四周暗下去
  let edge = length(ndc * vec2f(0.85, 1.0));
  var color = mix(SHALLOW, DEEP, smoothstep(0.2, 1.25, edge));

  // 每 30° 一条经线、一条纬线，只画在真有地球的范围里
  let onGlobe = step(abs(map.x), PI) * step(abs(latitude), PI / 2.0);
  let lines = max(gridLine(map.x / (PI / 6.0)), gridLine(latitude / (PI / 6.0)));
  color += vec3f(0.35, 0.5, 0.62) * lines * onGlobe * 0.07;
  return vec4f(color, 1.0);
}`;

export const REGION_SHADER = /* wgsl */ `
${VIEW}
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

export const ARC_SHADER = /* wgsl */ `
${VIEW}

const SEGMENTS = ${ARC_SEGMENTS}.0;
/** 带子的半宽（像素）：中间是实的，往两边淡出去 */
const HALF_WIDTH = 3.5;
/** 一道光从头走到尾要几秒 */
const TRAVEL_SECONDS = 2.2;

struct AOut {
  @builtin(position) position: vec4f,
  /** 沿着弧线走到了哪里（0–1）、离中线多远（-1–1） */
  @location(0) along: vec2f,
  @location(1) @interpolate(flat) params: vec4f,
};

// 一条弧线是一个实例：head、tail 是出发地、目的地在地图上的位置（from、target 这些词是 WGSL 的保留字，不能用）；params 是起始时间、路线种类（0 陆路、1 航线、2 海运）、
// 不透明度、是不是静态的路线（1 是：只画一条淡淡的虚线；0 是疾病跳过去的那一下：一道光沿着它走）
@vertex fn vertex(
  @builtin(vertex_index) index: u32,
  @location(0) head: vec2f,
  @location(1) tail: vec2f,
  @location(2) params: vec4f,
) -> AOut {
  let t = f32(index / 2u) / SEGMENTS;
  let side = f32(index % 2u) * 2.0 - 1.0;

  // 弯成一段二次曲线：控制点在两头连线的中点往“上”抬。飞机抬得高，船和陆路贴着走
  let chord = tail - head;
  let span = length(chord);
  let normal = vec2f(-chord.y, chord.x) / max(span, 1e-6);
  let up = select(-normal, normal, normal.y >= 0.0);
  let lift = select(select(0.04, 0.2, params.y == 1.0), 0.09, params.y == 2.0);
  let control = (head + tail) * 0.5 + up * span * lift;
  let a = mix(head, control, t);
  let b = mix(control, tail, t);
  let point = mix(a, b, t);
  let tangent = b - a;

  // 在屏幕上把线展成带子：缩放地图时粗细不变
  let clip = (point - view.center) * view.scale;
  let direction = normalize(tangent * view.scale * view.viewport + vec2f(1e-6, 0.0));
  let offset = vec2f(-direction.y, direction.x) * side * HALF_WIDTH * 2.0 / view.viewport;

  var out: AOut;
  out.position = vec4f(clip + offset, 0.0, 1.0);
  out.along = vec2f(t, side);
  out.params = params;
  return out;
}

@fragment fn fragment(in: AOut) -> @location(0) vec4f {
  let t = in.along.x;
  let across = 1.0 - smoothstep(0.35, 1.0, abs(in.along.y));
  var color = vec3f(0.80, 0.84, 0.88);
  if (in.params.y == 1.0) { color = vec3f(1.0, 0.82, 0.52); }
  if (in.params.y == 2.0) { color = vec3f(0.45, 0.78, 0.92); }

  var alpha = 0.0;
  if (in.params.w == 1.0) {
    // 静态的路线：慢慢流动的虚线，两头淡出
    let dash = step(0.5, fract(t * 14.0 - view.time * 0.25));
    alpha = 0.6 * dash * smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
  } else {
    // 跳过去的那一下：一道光从出发地走到目的地，后面拖一条尾巴；走过的地方留下淡淡的痕迹
    let light = fract(max(view.time - in.params.x, 0.0) / TRAVEL_SECONDS) * 1.25 - 0.1;
    let behind = light - t;
    let glow = exp(-behind * behind * 500.0) + select(0.0, exp(-behind * 7.0) * 0.5, behind > 0.0);
    alpha = 0.3 + glow;
    color = mix(color, vec3f(1.0), clamp(glow - 0.5, 0.0, 1.0));
  }
  return vec4f(color, alpha * across * in.params.z);
}`;
