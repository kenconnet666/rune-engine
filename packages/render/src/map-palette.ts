/**
 * 地图的色带：一个地区的数值（0–1）涂成什么颜色。两套——
 *   standard  深色的地 → 琥珀 → 红。好看，但红比琥珀暗：分不清红绿的人看，“最重”的地方反而不如“中等”的显眼
 *   safe      深色的地 → 橙 → 浅黄。色觉友好：越重越亮，亮度一路往上走，不靠色相也看得出轻重
 * 颜色在这里定，着色器从这里取（map-shaders.ts）；rampColor 是和着色器里同样的算法，测试用它核对色带。
 */

/** 一个颜色：sRGB 的三个分量，0–1 */
export type Rgb = readonly [number, number, number];

export interface MapPalette {
  /** 数值是 0 的陆地 */
  readonly land: Rgb;
  /** 数值到一半上下 */
  readonly warm: Rgb;
  /** 数值到顶 */
  readonly hot: Rgb;
}

export const MAP_PALETTES = {
  standard: {
    land: [0.105, 0.145, 0.185],
    warm: [0.949, 0.639, 0.227],
    hot: [0.898, 0.282, 0.302],
  },
  safe: {
    land: [0.105, 0.145, 0.185],
    warm: [0.902, 0.56, 0.05],
    hot: [1, 0.95, 0.68],
  },
} as const satisfies Record<string, MapPalette>;

export type MapPaletteName = keyof typeof MAP_PALETTES;

const smoothstep = (low: number, high: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** 数值 → 颜色。和 REGION_SHADER 的 fill 里那两行一模一样，改的时候两边一起改 */
export function rampColor(palette: MapPalette, value: number): Rgb {
  const base = mix(palette.land, palette.warm, smoothstep(0, 0.55, value));
  return mix(base, palette.hot, smoothstep(0.45, 1, value));
}

/** 相对亮度（WCAG 的定义）：0 是黑，1 是白 */
export function luminance([r, g, b]: Rgb): number {
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
