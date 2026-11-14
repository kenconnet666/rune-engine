/**
 * 渲染 Worker：WebGPU 画在主线程交过来的画布上。它也是主机的一个只读客户端，
 * 对局的状态直接从主机来，不经过主线程——界面再忙，地图照常更新。
 *
 * 点选也在这里做：主线程只报指针在画布上的位置，落在哪个地区由这里算（网格在这里），
 * 停留的高亮当场画上，再把结果告诉主线程去显示名字、打开详情。
 *
 * 画在画布里的界面也在这里贴：主线程把各层拍下来发过来，每一帧画完地图接着贴（引擎的界面合成器）。
 *
 * 地图上的弧线也在这里定：选中的地区画出它的航线和海运；疾病跳到新地区的那一下画一道走动的光（只有攻方看得到）。
 */
import { regions } from '@miwang/content';
import { measureLevel, type Command, type OutbreakView } from '@miwang/sim';
import {
  connectSession,
  type ClientMessage,
  type HostMessage,
  type Session,
} from '@rune-engine/net';
import {
  createMapRenderer,
  createRegionPicker,
  createUiCompositor,
  decodeRegionMesh,
  fitCamera,
  screenToMap,
  type MapArc,
  type MapBounds,
  type MapCamera,
  type MapPaletteName,
  type MapRenderer,
} from '@rune-engine/render';
import { asPort } from '@rune-engine/runtime/worker';
import { layerValues, type MapLayer } from '../layers.ts';
import type { RenderControl, RenderReport } from '../messages.ts';

declare const self: DedicatedWorkerGlobalScope;

let renderer: MapRenderer | undefined;
/** 用哪一套色带：渲染器建好之前先记着 */
let paletteName: MapPaletteName = 'standard';
let session: Session<Command> | undefined;
/** 最近一份状态：渲染器还没建好时先留着，换图层时拿它重画 */
let latestView: OutbreakView | undefined;
/** 地图上涂的是哪一样数 */
let layer: MapLayer = 'infection';
/** 最近一份状态里“跳到新地区”的记录，和各自第一次看到它的时刻（光从那时开始走） */
let hops: OutbreakView['hops'] = [];
let today = 0;
const hopSeenAt = new Map<string, number>();
/** 一跳过了这么多天就从地图上淡掉 */
const HOP_FADE_DAYS = 30;

let size = { width: 1, height: 1 };
let bounds: MapBounds = [0, 0, 1, 1];
let camera: MapCamera = { x: 0, y: 0, zoom: 1 };
let regionAt: (x: number, y: number) => number = () => -1;
let hovered = -1;
let selected = -1;

const report = (message: RenderReport) => self.postMessage(message);

/** 画在画布里的界面：主线程拍下来的各层由它贴到每一帧上（地图画完之后） */
const ui = createUiCompositor({
  onNeedImages: () => report({ type: 'ui-request' }),
  // 界面一块块显现时的亮边：用界面的信号色（橙）
  glow: [0.9, 0.6, 0.2],
});

/** 最近这些帧各花了多久（毫秒）、各是什么时候画的：开发时量性能用 */
const FRAMES_KEPT = 240;
const frameCosts: number[] = [];
const frameTimes: number[] = [];

function frameStats(): Extract<RenderReport, { type: 'stats' }> {
  const span = (frameTimes.at(-1) ?? 0) - (frameTimes[0] ?? 0);
  return {
    type: 'stats',
    fps: span > 0 ? ((frameTimes.length - 1) * 1000) / span : 0,
    frameMs: frameCosts.reduce((sum, cost) => sum + cost, 0) / Math.max(1, frameCosts.length),
    worstMs: Math.max(0, ...frameCosts),
  };
}

const centerOf = (region: number) => regions[region]!.center as [number, number];

/** 重新定一遍要画的弧线：最近的几跳，加上选中地区的航线和海运 */
function updateArcs() {
  if (!renderer) return;
  const arcs: MapArc[] = [];
  const now = performance.now();
  const current = new Set<string>();
  for (const hop of hops) {
    const key = `${hop.tick}:${hop.to}`;
    current.add(key);
    if (!hopSeenAt.has(key)) hopSeenAt.set(key, now);
    arcs.push({
      from: centerOf(hop.from),
      to: centerOf(hop.to),
      route: hop.route,
      startMs: hopSeenAt.get(key)!,
      // 越旧越淡
      alpha: Math.max(0.15, 1 - (today - hop.tick) / HOP_FADE_DAYS),
    });
  }
  // 状态里已经没有的那些跳（过期了、换了一局）不用再记着
  for (const key of hopSeenAt.keys()) if (!current.has(key)) hopSeenAt.delete(key);

  const region = regions[selected];
  if (region) {
    for (const [route, links] of [
      ['air', region.air],
      ['sea', region.sea],
    ] as const) {
      const strongest = Math.max(...links.weight, 1e-9);
      links.to.forEach((to, index) => {
        arcs.push({
          from: centerOf(selected),
          to: centerOf(to),
          route,
          // 往来越多的路线越实
          alpha: 0.35 + 0.65 * (links.weight[index]! / strongest),
        });
      });
    }
  }
  renderer.setArcs(arcs);
}

function show(view: OutbreakView) {
  latestView = view;
  if (!renderer) return;
  renderer.setValues(layerValues(view, layer), performance.now());
  // 地图上现在只画封锁（斜纹，不分档）；别的措施在地区面板里看
  renderer.setFlags(
    Uint8Array.from(view.measures, (bits) => (measureLevel(bits, 'lockdown') > 0 ? 1 : 0)),
  );
  hops = view.hops;
  today = view.tick;
  updateArcs();
}

async function loadMesh(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`地图网格加载失败：${response.status} ${url}`);
  return decodeRegionMesh(await response.arrayBuffer());
}

async function init(data: Extract<RenderControl, { type: 'init' }>) {
  const mesh = await loadMesh(data.meshUrl);
  bounds = mesh.bounds;
  regionAt = createRegionPicker(mesh);
  // 主线程可能已经发过相机：没发过才用“整张地图居中”
  if (camera.zoom === 1 && camera.x === 0 && camera.y === 0) camera = fitCamera(bounds);
  renderer = await createMapRenderer({
    canvas: data.canvas,
    mesh,
    regionCount: data.regionCount,
    onLost: (reason) => report({ type: 'lost', message: reason }),
    onRestored: () => report({ type: 'ready' }),
    onError: (message) => report({ type: 'error', message }),
    overlay: ui,
  });
  renderer.resize(size.width, size.height);
  renderer.setCamera(camera);
  renderer.setPalette(paletteName);
  renderer.setHighlight(hovered, selected);
  updateArcs();
  if (latestView) show(latestView);
  const frame = (now: number) => {
    const started = performance.now();
    renderer?.render(now);
    frameCosts.push(performance.now() - started);
    frameTimes.push(now);
    if (frameCosts.length > FRAMES_KEPT) {
      frameCosts.shift();
      frameTimes.shift();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  report({ type: 'ready' });
  // 画面已经出来了，再去拿细的那份；拿不到也不要紧，放大以后还是粗的
  renderer.setDetail(await loadMesh(data.detailUrl));
}

self.onmessage = ({ data }: MessageEvent<RenderControl>) => {
  switch (data.type) {
    case 'init':
      size = { width: data.canvas.width, height: data.canvas.height };
      init(data).catch((error: unknown) => report({ type: 'error', message: String(error) }));
      break;
    case 'resize':
      size = { width: data.width, height: data.height };
      renderer?.resize(data.width, data.height);
      break;
    case 'camera':
      camera = data.camera;
      renderer?.setCamera(camera);
      break;
    case 'pointer': {
      const region = data.at
        ? regionAt(
            ...screenToMap(bounds, size, camera, data.at.x * size.width, data.at.y * size.height),
          )
        : -1;
      if (region !== hovered || data.tap) {
        hovered = region;
        renderer?.setHighlight(hovered, selected);
        report({ type: 'region', region, picked: data.tap });
      }
      break;
    }
    case 'layer':
      layer = data.layer;
      if (latestView) show(latestView);
      break;
    case 'palette':
      paletteName = data.name;
      renderer?.setPalette(paletteName);
      break;
    case 'select':
      selected = data.region;
      renderer?.setHighlight(hovered, selected);
      updateArcs();
      break;
    case 'ui-canvas':
    case 'ui-resize':
    case 'ui-image':
    case 'ui-material':
    case 'ui-place':
    case 'ui-scroll':
    case 'ui-clear':
    case 'ui-remove':
      ui.handle(data);
      break;
    case 'lose-device':
      renderer?.loseDevice();
      break;
    case 'stats':
      report(frameStats());
      break;
    case 'connect':
      session?.close();
      session = connectSession<Command, OutbreakView>(
        asPort<HostMessage<OutbreakView>, ClientMessage<Command>>(data.port),
        { view: (message) => show(message.view) },
      );
      break;
  }
};
