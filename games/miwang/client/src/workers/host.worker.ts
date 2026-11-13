/**
 * 主机 Worker：对局唯一的真实状态在这里。主线程的界面、渲染 Worker、电脑对手、另一位玩家都是连上来的客户端，
 * 走的是同一套会话协议——单人和双人的差别只是“另一方是谁在发命令”。
 */
import { decide, outbreak, type Command, type OutbreakView } from '@miwang/sim';
import type { PlayerId } from '@rune-engine/core';
import {
  connectSession,
  createHost,
  createPortPair,
  type ClientMessage,
  type Host,
  type HostMessage,
} from '@rune-engine/net';
import { asPort, startHostLoop } from '@rune-engine/runtime/worker';
import {
  clientChannel,
  roomChannel,
  type GameRecording,
  type HostControl,
  type HostReport,
  type RoomMessage,
} from '../messages.ts';

declare const self: DedicatedWorkerGlobalScope;

type ToHost = ClientMessage<Command>;
type FromHost = HostMessage<OutbreakView>;

let host: Host<GameRecording['config'], Command, OutbreakView> | undefined;
let stopLoop: (() => void) | undefined;
const disconnect = new Map<string, () => void>();
/** 上次把记录交给主线程时的步数与命令数：有新命令立刻交，否则每 20 步交一次 */
let reported = { ticks: -1, commands: -1 };
/** 电脑控制的一方（没有时两边都是人），以及它那条连接 */
let aiPlayer: PlayerId | null = null;
let stopAi: (() => void) | undefined;
let room: BroadcastChannel | undefined;

const tell = (message: HostReport) => self.postMessage(message);

function report() {
  if (!host) return;
  const { recording } = host;
  const due =
    recording.commands.length !== reported.commands || recording.ticks - reported.ticks >= 20;
  if (!due) return;
  reported = { ticks: recording.ticks, commands: recording.commands.length };
  tell({ type: 'recording', recording });
}

/** 电脑对手：同一个线程里的一条连接，每 3 天看一次自己这一方的状态、决定要不要出手 */
function playAi(player: PlayerId | null) {
  stopAi?.();
  stopAi = undefined;
  aiPlayer = player;
  if (player === null || !host) return;
  const [hostSide, aiSide] = createPortPair<ToHost, FromHost>();
  const leave = host.connect(hostSide, player);
  let decidedAt = -1;
  const session = connectSession<Command, OutbreakView>(aiSide, {
    view({ view }) {
      if (view.tick === decidedAt || view.tick % 3 !== 0) return;
      decidedAt = view.tick;
      const command = decide(view);
      if (command) session.send(command);
    },
  });
  stopAi = () => {
    session.close();
    leave();
  };
}

/** 开房间：听客人的招呼，把它们各自的通道接成客户端；有人接手了电脑控制的那一方，电脑就退下 */
function openRoom(name: string) {
  room?.close();
  room = new BroadcastChannel(roomChannel(name));
  room.onmessage = ({ data }: MessageEvent<RoomMessage>) => {
    if (data.type !== 'join' || !host) return;
    const channel = new BroadcastChannel(clientChannel(name, data.client));
    disconnect.get(data.client)?.();
    const leave = host.connect(asPort<ToHost, FromHost>(channel), data.player, {
      readonly: data.readonly,
    });
    disconnect.set(data.client, () => {
      leave();
      channel.close();
    });
    if (!data.readonly) {
      if (aiPlayer === data.player) playAi(null);
      tell({ type: 'joined', player: data.player });
    }
    room?.postMessage({ type: 'welcome', client: data.client } satisfies RoomMessage);
  };
}

self.onmessage = ({ data }: MessageEvent<HostControl>) => {
  switch (data.type) {
    case 'start': {
      stopLoop?.();
      stopAi?.();
      for (const close of disconnect.values()) close();
      disconnect.clear();
      const began = performance.now();
      host = createHost({
        sim: outbreak,
        start: data.start,
        stepMs: data.stepMs,
        // 这两个数组每次都是新建的：直接转移给对面，不拷贝（广播通道不支持转移，会忽略它）
        transfer: (view) => [
          view.intensity.buffer as ArrayBuffer,
          view.measures.buffer as ArrayBuffer,
        ],
      });
      tell({ type: 'started', replayedTicks: host.tick, replayMs: performance.now() - began });
      reported = { ticks: -1, commands: -1 };
      playAi(aiPlayer);
      stopLoop = startHostLoop(host, 50, report);
      break;
    }
    case 'connect':
      if (!host) return;
      disconnect.get(data.id)?.();
      disconnect.set(
        data.id,
        host.connect(asPort<ToHost, FromHost>(data.port), data.player, {
          readonly: data.readonly,
        }),
      );
      break;
    case 'ai':
      playAi(data.player);
      break;
    case 'open-room':
      openRoom(data.room);
      break;
  }
};
