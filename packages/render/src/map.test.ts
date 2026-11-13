import { describe, expect, it } from 'vitest';
import {
  clampCamera,
  fitCamera,
  mapToScreen,
  panBy,
  screenToMap,
  zoomAround,
  type MapBounds,
} from './map-view.ts';
import { luminance, MAP_PALETTES, rampColor } from './map-palette.ts';
import { decodeRegionMesh, encodeRegionMesh, type RegionMeshData } from './mesh-format.ts';
import { createRegionPicker } from './region-picker.ts';

/** 两个并排的正方形地区：0 号在 x 0–1，1 号在 x 2–3，中间空着 */
const mesh: RegionMeshData = {
  bounds: [0, 0, 3, 1],
  vertices: Float32Array.from(
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [2, 0, 1],
      [3, 0, 1],
      [3, 1, 1],
      [2, 1, 1],
    ].flat(),
  ),
  indices: Uint32Array.from([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
  lines: Uint32Array.from([0, 1, 1, 2, 2, 3, 3, 0]),
};

describe('地区网格的二进制格式', () => {
  it('写出再读回来，内容不变', () => {
    const copy = decodeRegionMesh(encodeRegionMesh(mesh).buffer as ArrayBuffer);
    expect([...copy.vertices]).toEqual([...mesh.vertices]);
    expect([...copy.indices]).toEqual([...mesh.indices]);
    expect([...copy.lines]).toEqual([...mesh.lines]);
    expect([...copy.bounds]).toEqual([...mesh.bounds]);
  });
});

describe('点选', () => {
  const pick = createRegionPicker(mesh);
  it('落在地区里返回它的下标，落在空处或地图外返回 -1', () => {
    expect(pick(0.5, 0.5)).toBe(0);
    expect(pick(0.9, 0.1)).toBe(0);
    expect(pick(2.5, 0.75)).toBe(1);
    expect(pick(1.5, 0.5)).toBe(-1);
    expect(pick(-1, 0.5)).toBe(-1);
    expect(pick(0.5, 2)).toBe(-1);
  });
});

describe('地图视野', () => {
  const bounds: MapBounds = [0, 0, 3, 1];
  const viewport = { width: 600, height: 400 };

  it('地图坐标和屏幕坐标一来一回不变，北在上', () => {
    const camera = { x: 1.2, y: 0.4, zoom: 2.5 };
    const [sx, sy] = mapToScreen(bounds, viewport, camera, 2, 0.9);
    const [x, y] = screenToMap(bounds, viewport, camera, sx, sy);
    expect(x).toBeCloseTo(2);
    expect(y).toBeCloseTo(0.9);
    expect(mapToScreen(bounds, viewport, camera, 2, 1)[1]).toBeLessThan(
      mapToScreen(bounds, viewport, camera, 2, 0)[1],
    );
  });

  it('整张地图居中时，四个角都在视口里', () => {
    const camera = fitCamera(bounds);
    for (const [x, y] of [
      [0, 0],
      [3, 1],
    ] as const) {
      const [sx, sy] = mapToScreen(bounds, viewport, camera, x, y);
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThanOrEqual(600);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sy).toBeLessThanOrEqual(400);
    }
  });

  it('以一点为中心缩放：那一点下面的地图位置不动', () => {
    const camera = { x: 1.5, y: 0.5, zoom: 1 };
    const before = screenToMap(bounds, viewport, camera, 450, 120);
    const after = screenToMap(
      bounds,
      viewport,
      zoomAround(bounds, viewport, camera, 4, 450, 120),
      450,
      120,
    );
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('拖动时内容跟着手指走；相机不出地图、缩放不出上下限', () => {
    const camera = { x: 1.5, y: 0.5, zoom: 1 };
    const grabbed = screenToMap(bounds, viewport, camera, 300, 200);
    const moved = panBy(bounds, viewport, camera, 40, -25);
    const [sx, sy] = mapToScreen(bounds, viewport, moved, grabbed[0], grabbed[1]);
    expect(sx).toBeCloseTo(340);
    expect(sy).toBeCloseTo(175);
    expect(clampCamera(bounds, { x: 99, y: -5, zoom: 100 }, 1, 12)).toEqual({
      x: 3,
      y: 0,
      zoom: 12,
    });
  });
});

describe('地图的色带', () => {
  /** 沿色带从 0 走到 1，每一步的亮度 */
  const lightness = (name: keyof typeof MAP_PALETTES) =>
    Array.from({ length: 41 }, (_, step) => luminance(rampColor(MAP_PALETTES[name], step / 40)));

  it('色觉友好的那一套：越重越亮，亮度一路往上走，轻重不靠色相也分得出', () => {
    const values = lightness('safe');
    for (let step = 1; step < values.length; step++) {
      expect(values[step], `第 ${step} 步`).toBeGreaterThan(values[step - 1]!);
    }
    // 两头差得够开：最重的地方比陆地的底色亮得多
    expect(values.at(-1)! / values[0]!).toBeGreaterThan(20);
  });

  it('标准的那一套不是这样：到顶的红比中间的琥珀暗——这正是要另做一套的原因', () => {
    const values = lightness('standard');
    expect(values.at(-1)).toBeLessThan(Math.max(...values));
  });

  it('两套的两头都是给定的颜色', () => {
    for (const palette of Object.values(MAP_PALETTES)) {
      for (const [value, expected] of [
        [0, palette.land],
        [1, palette.hot],
      ] as const) {
        rampColor(palette, value).forEach((channel, index) =>
          expect(channel).toBeCloseTo(expected[index]!, 6),
        );
      }
    }
  });
});
