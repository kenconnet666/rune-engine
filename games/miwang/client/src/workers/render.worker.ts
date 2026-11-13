/**
 * 渲染 Worker：WebGPU 画在主线程交过来的画布上。它也是主机的一个只读客户端，
 * 对局的状态直接从主机来，不经过主线程——界面再忙，地图照常更新。
 */
import type { Command, OutbreakView } from '@miwang/sim';
import {
  connectSession,
  type ClientMessage,
  type HostMessage,
  type Session,
} from '@rune-engine/net';
import { createMapRenderer, decodeRegionMesh, type MapRenderer } from '@rune-engine/render';
import { asPort } from '@rune-engine/runtime/worker';
import type { RenderControl, RenderReport } from '../messages.ts';

declare const self: DedicatedWorkerGlobalScope;

let renderer: MapRenderer | undefined;
let session: Session<Command> | undefined;
/** 作为客人加入别人的房间时，状态从这条广播通道来 */
let channel: BroadcastChannel | undefined;
/** 渲染器还没建好时先到的东西：建好后补上 */
let pendingSize: { width: number; height: number } | undefined;
let pendingView: OutbreakView | undefined;

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
  renderer = await createMapRenderer({ canvas: data.canvas, mesh, regionCount: data.regionCount });
  renderer.resize(
    pendingSize?.width ?? data.canvas.width,
    pendingSize?.height ?? data.canvas.height,
  );
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
      init(data).catch((error: unknown) => report({ type: 'error', message: String(error) }));
      break;
    case 'resize':
      pendingSize = { width: data.width, height: data.height };
      renderer?.resize(data.width, data.height);
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
