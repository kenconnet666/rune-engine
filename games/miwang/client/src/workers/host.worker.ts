/**
 * 主机 Worker：对局唯一的真实状态在这里。主线程的界面、渲染 Worker、电脑对手、另一位玩家都是连上来的客户端，
 * 走的是同一套会话协议——单人和双人的差别只是“另一方是谁在发命令”。
 * 联机的那位玩家也是经主线程递过来的一个 port：网络连接在主线程里（Worker 里建不了 WebRTC 连接）。
 */
import {
  decide,
  outbreak,
  type AiLevel,
  type Command,
  type OutbreakConfig,
  type OutbreakView,
} from '@miwang/sim';
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
import type { GameRecording, HostControl, HostReport } from '../messages.ts';

declare const self: DedicatedWorkerGlobalScope;

type ToHost = ClientMessage<Command>;
type FromHost = HostMessage<OutbreakView>;

let host: Host<GameRecording['config'], Command, OutbreakView> | undefined;
let stopLoop: (() => void) | undefined;
const disconnect = new Map<string, () => void>();
/** 上次把记录交给主线程时的步数与命令数：有新命令立刻交，否则每 20 步交一次 */
let reported = { ticks: -1, commands: -1 };
/** 这一局的配置：电脑对手要查性状表、科技表 */
let config: OutbreakConfig | undefined;
/** 电脑控制的一方（没有时两边都是人）和难度，以及它那条连接 */
let aiPlayer: PlayerId | null = null;
let aiLevel: AiLevel = 1;
let stopAi: (() => void) | undefined;
/** 现在是不是在回放：回放时不往外报记录（不能盖掉正在打的那一局的自动存档），也没有电脑对手 */
let playingBack = false;

const tell = (message: HostReport) => self.postMessage(message);

function report() {
  if (!host || playingBack) return;
  const { recording } = host;
  const due =
    recording.commands.length !== reported.commands || recording.ticks - reported.ticks >= 20;
  if (!due) return;
  reported = { ticks: recording.ticks, commands: recording.commands.length };
  tell({ type: 'recording', recording });
}

/** 电脑对手：同一个线程里的一条连接，每天看一次自己这一方的状态（隔几天出一次手由它自己定） */
function playAi(player: PlayerId | null, level: AiLevel) {
  stopAi?.();
  stopAi = undefined;
  aiPlayer = player;
  aiLevel = level;
  const rules = config;
  if (player === null || !host || !rules || playingBack) return;
  const [hostSide, aiSide] = createPortPair<ToHost, FromHost>();
  const leave = host.connect(hostSide, player);
  let decidedAt = -1;
  const session = connectSession<Command, OutbreakView>(aiSide, {
    view({ view }) {
      if (view.tick === decidedAt) return;
      decidedAt = view.tick;
      for (const command of decide(view, rules, level)) session.send(command);
    },
  });
  stopAi = () => {
    session.close();
    leave();
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
      playingBack = 'playback' in data.start;
      config =
        'config' in data.start
          ? data.start.config
          : 'recording' in data.start
            ? data.start.recording.config
            : data.start.playback.config;
      host = createHost({
        sim: outbreak,
        start: data.start,
        stepMs: data.stepMs,
        // 这些数组每次都是新建的：直接转移给对面，不拷贝（广播通道不支持转移，会忽略它）
        transfer: (view) =>
          [view.intensity, view.measures, view.cases, view.deaths, view.immune, view.happening].map(
            (array) => array.buffer as ArrayBuffer,
          ),
      });
      tell({ type: 'started', replayedTicks: host.tick, replayMs: performance.now() - began });
      reported = { ticks: -1, commands: -1 };
      playAi(aiPlayer, aiLevel);
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
    case 'disconnect':
      disconnect.get(data.id)?.();
      disconnect.delete(data.id);
      break;
    case 'ai':
      playAi(data.player, data.level);
      break;
  }
};
