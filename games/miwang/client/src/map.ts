/**
 * 地图在主线程这头的控制器：相机归它管（拖动、缩放、飞到某个地区），指针的位置报给渲染线程去点选，
 * 界面要的东西（指针停在哪个地区、选中了哪个、地图上一点在屏幕的哪里）从它读。
 *
 * 相机的每一次变化都发给渲染线程；主线程用同一套换算（@rune-engine/render/map-view）摆界面，
 * 所以压在地图上的提示和地图本身对得上。
 */
import { bounds as worldBounds, regions } from '@miwang/content';
import { observeGestures, type GesturePoint } from '@rune-engine/input';
import {
  clampCamera,
  fitCamera,
  mapToScreen,
  panBy,
  zoomAround,
  type MapBounds,
  type MapCamera,
} from '@rune-engine/render/map-view';
import { shallowRef, type ShallowRef } from 'vue';
import type { RenderLink } from './session/index.ts';

const MIN_ZOOM = 1;
const MAX_ZOOM = 14;
/** 飞到一个地区：至少放大到这个倍数，用时这么久 */
const FOCUS_ZOOM = 3.2;
const FLY_MS = 520;

export interface MapController {
  readonly camera: ShallowRef<MapCamera>;
  /** 指针停在哪个地区上（下标），不在任何地区上是 -1 */
  readonly hovered: ShallowRef<number>;
  /** 选中的地区（下标），没有是 -1 */
  readonly selected: ShallowRef<number>;
  /** 鼠标在画布上的位置（CSS 像素）；不在画布上、或者是触屏时是 null */
  readonly pointer: ShallowRef<GesturePoint | null>;
  /** 选中一个地区（-1 是取消）；fly 为 true 时相机飞过去 */
  select(region: number, fly?: boolean): void;
  /** 以画布中心为准放大、缩小 */
  zoomBy(factor: number): void;
  /** 回到整张地图 */
  reset(): void;
  /** 地图上的一点在画布上的位置（CSS 像素） */
  toScreen(x: number, y: number): [x: number, y: number];
  dispose(): void;
}

export function createMapController(canvas: HTMLCanvasElement, link: RenderLink): MapController {
  const bounds = worldBounds as unknown as MapBounds;
  const camera = shallowRef<MapCamera>(fitCamera(bounds));
  const hovered = shallowRef(-1);
  const selected = shallowRef(-1);
  const pointer = shallowRef<GesturePoint | null>(null);
  const viewport = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });

  let flight = 0;
  const cancelFlight = () => cancelAnimationFrame(flight);

  function move(next: MapCamera) {
    camera.value = clampCamera(bounds, next, MIN_ZOOM, MAX_ZOOM);
    link.send({ type: 'camera', camera: camera.value });
  }

  /** 相机在 FLY_MS 里滑到 target：先快后慢 */
  function flyTo(target: MapCamera) {
    cancelFlight();
    const from = camera.value;
    const started = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / FLY_MS);
      const eased = 1 - (1 - t) ** 3;
      move({
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
        zoom: from.zoom + (target.zoom - from.zoom) * eased,
      });
      if (t < 1) flight = requestAnimationFrame(frame);
    };
    flight = requestAnimationFrame(frame);
  }

  const report = (at: GesturePoint | null, tap: boolean) => {
    const { width, height } = viewport();
    link.send({ type: 'pointer', at: at && { x: at.x / width, y: at.y / height }, tap });
  };

  function select(region: number, fly = false) {
    selected.value = region;
    link.send({ type: 'select', region });
    const center = regions[region]?.center;
    if (fly && center) {
      flyTo({ x: center[0]!, y: center[1]!, zoom: Math.max(camera.value.zoom, FOCUS_ZOOM) });
    }
  }

  link.onRegion = (region, picked) => {
    hovered.value = region;
    // 点在海上是取消选中
    if (picked) select(region);
  };

  const stopGestures = observeGestures(canvas, {
    pan(dx, dy) {
      cancelFlight();
      move(panBy(bounds, viewport(), camera.value, dx, dy));
    },
    zoom(factor, at) {
      cancelFlight();
      move(zoomAround(bounds, viewport(), camera.value, camera.value.zoom * factor, at.x, at.y));
      // 缩放之后指针下面换了地方：重新报一次位置
      if (pointer.value) report(pointer.value, false);
    },
    tap: (at) => report(at, true),
    hover(at) {
      pointer.value = at;
      report(at, false);
    },
    leave() {
      pointer.value = null;
      report(null, false);
    },
    reset: () => flyTo(fitCamera(bounds)),
  });

  return {
    camera,
    hovered,
    selected,
    pointer,
    select,
    zoomBy(factor) {
      const { width, height } = viewport();
      flyTo(
        clampCamera(
          bounds,
          zoomAround(
            bounds,
            viewport(),
            camera.value,
            camera.value.zoom * factor,
            width / 2,
            height / 2,
          ),
          MIN_ZOOM,
          MAX_ZOOM,
        ),
      );
    },
    reset: () => flyTo(fitCamera(bounds)),
    toScreen: (x, y) => mapToScreen(bounds, viewport(), camera.value, x, y),
    dispose() {
      cancelFlight();
      stopGestures();
      link.onRegion = null;
    },
  };
}
