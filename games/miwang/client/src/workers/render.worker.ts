/**
 * 渲染 Worker：WebGPU 画在主线程交过来的画布上。它也是主机的一个只读客户端，
 * 对局的状态直接从主机来，不经过主线程——界面再忙，地图照常更新。
 *
 * 点选也在这里做：主线程只报指针在画布上的位置，落在哪个地区由这里算（网格在这里），
 * 停留的高亮当场画上，再把结果告诉主线程去显示名字、打开详情。
 */
import type { Command, OutbreakView } from '@miwang/sim';
import {
  connectSession,
  type ClientMessage,
  type HostMessage,
  type Session,
} from '@rune-engine/net';
import {
  createMapRenderer,
  createRegionPicker,
  decodeRegionMesh,
  fitCamera,
  screenToMap,
  type MapBounds,
  type MapCamera,
  type MapRenderer,
} from '@rune-engine/render';
import { asPort } from '@rune-engine/runtime/worker';
import type { RenderControl, RenderReport } from '../messages.ts';

declare const self: DedicatedWorkerGlobalScope;

let renderer: MapRenderer | undefined;
let session: Session<Command> | undefined;
/** 作为客人加入别人的房间时，状态从这条广播通道来 */
let channel: BroadcastChannel | undefined;
/** 渲染器还没建好时先到的东西：建好后补上 */
let pendingView: OutbreakView | undefined;

let size = { width: 1, height: 1 };
let bounds: MapBounds = [0, 0, 1, 1];
let camera: MapCamera = { x: 0, y: 0, zoom: 1 };
let regionAt: (x: number, y: number) => number = () => -1;
let hovered = -1;
let selected = -1;

const report = (message: RenderReport) => self.postMessage(message);

function show(view: OutbreakView) {
  if (!renderer) {
    pendingView = view;
    return;
  }
  renderer.setValues(view.intensity, performance.now());
  renderer.setFlags(view.measures);
}

async function init(data: Extract<RenderControl, { type: 'init' }>) {
  const response = await fetch(data.meshUrl);
  if (!response.ok) throw new Error(`地图网格加载失败：${response.status} ${data.meshUrl}`);
  const mesh = decodeRegionMesh(await response.arrayBuffer());
  bounds = mesh.bounds;
  regionAt = createRegionPicker(mesh);
  // 主线程可能已经发过相机：没发过才用“整张地图居中”
  if (camera.zoom === 1 && camera.x === 0 && camera.y === 0) camera = fitCamera(bounds);
  renderer = await createMapRenderer({ canvas: data.canvas, mesh, regionCount: data.regionCount });
  renderer.resize(size.width, size.height);
  renderer.setCamera(camera);
  renderer.setHighlight(hovered, selected);
  if (pendingView) show(pendingView);
  const frame = (now: number) => {
    renderer?.render(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  report({ type: 'ready' });
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
    case 'select':
      selected = data.region;
      renderer?.setHighlight(hovered, selected);
      break;
    case 'connect':
    case 'connect-channel':
      session?.close();
      channel?.close();
      channel = data.type === 'connect-channel' ? new BroadcastChannel(data.name) : undefined;
      session = connectSession<Command, OutbreakView>(
        asPort<HostMessage<OutbreakView>, ClientMessage<Command>>(
          data.type === 'connect-channel' ? channel! : data.port,
        ),
        { view: (message) => show(message.view) },
      );
      break;
  }
};
