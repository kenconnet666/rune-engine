/**
 * 地图视野的坐标换算：纯计算，不碰 WebGPU。渲染线程用它摆画面，主线程用同一套算法摆压在地图上的界面
 * （提示、标签），两边对同一个相机算出的位置一定重合。
 *
 * 相机与分辨率无关：x、y 是视野中心的地图坐标，zoom 是相对“整张地图刚好放进视口”的倍数。
 * 屏幕坐标原点在左上、y 向下；地图坐标 y 向上（北）。视口的单位随调用方（CSS 像素或设备像素都行）。
 */
export interface MapCamera {
  /** 视野中心（地图坐标） */
  x: number;
  y: number;
  /** 1 是整张地图刚好放进视口 */
  zoom: number;
}

export interface MapViewport {
  width: number;
  height: number;
}

export type MapBounds = readonly [minX: number, minY: number, maxX: number, maxY: number];

/** 整张地图放进视口时四周留的空白（占视口的比例） */
const FIT = 0.94;

/** 每个地图单位占多少屏幕单位 */
export function mapScale(bounds: MapBounds, viewport: MapViewport, zoom: number): number {
  return (
    Math.min(viewport.width / (bounds[2] - bounds[0]), viewport.height / (bounds[3] - bounds[1])) *
    FIT *
    zoom
  );
}

/** 整张地图居中放进视口的相机 */
export function fitCamera(bounds: MapBounds): MapCamera {
  return { x: (bounds[0] + bounds[2]) / 2, y: (bounds[1] + bounds[3]) / 2, zoom: 1 };
}

/** 地图坐标 → 屏幕坐标 */
export function mapToScreen(
  bounds: MapBounds,
  viewport: MapViewport,
  camera: MapCamera,
  x: number,
  y: number,
): [x: number, y: number] {
  const scale = mapScale(bounds, viewport, camera.zoom);
  return [
    viewport.width / 2 + (x - camera.x) * scale,
    viewport.height / 2 - (y - camera.y) * scale,
  ];
}

/** 屏幕坐标 → 地图坐标 */
export function screenToMap(
  bounds: MapBounds,
  viewport: MapViewport,
  camera: MapCamera,
  screenX: number,
  screenY: number,
): [x: number, y: number] {
  const scale = mapScale(bounds, viewport, camera.zoom);
  return [
    camera.x + (screenX - viewport.width / 2) / scale,
    camera.y - (screenY - viewport.height / 2) / scale,
  ];
}

/** 按屏幕上的位移平移（拖动）：内容跟着手指走 */
export function panBy(
  bounds: MapBounds,
  viewport: MapViewport,
  camera: MapCamera,
  screenDx: number,
  screenDy: number,
): MapCamera {
  const scale = mapScale(bounds, viewport, camera.zoom);
  return { ...camera, x: camera.x - screenDx / scale, y: camera.y + screenDy / scale };
}

/** 以屏幕上的一点为中心缩放到 zoom：那一点下面的地图位置缩放前后不动 */
export function zoomAround(
  bounds: MapBounds,
  viewport: MapViewport,
  camera: MapCamera,
  zoom: number,
  screenX: number,
  screenY: number,
): MapCamera {
  const [x, y] = screenToMap(bounds, viewport, camera, screenX, screenY);
  const scale = mapScale(bounds, viewport, zoom);
  return {
    x: x - (screenX - viewport.width / 2) / scale,
    y: y + (screenY - viewport.height / 2) / scale,
    zoom,
  };
}

/** 把相机限制住：缩放在 [minZoom, maxZoom]，视野中心不出地图的范围 */
export function clampCamera(
  bounds: MapBounds,
  camera: MapCamera,
  minZoom: number,
  maxZoom: number,
): MapCamera {
  return {
    x: Math.min(bounds[2], Math.max(bounds[0], camera.x)),
    y: Math.min(bounds[3], Math.max(bounds[1], camera.y)),
    zoom: Math.min(maxZoom, Math.max(minZoom, camera.zoom)),
  };
}
