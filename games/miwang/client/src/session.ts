/**
 * 一局游戏在主线程这头的样子。两种身份：
 *   - 主人：起主机 Worker，自己是它的一个客户端；另一方默认由电脑控制，开了房间、有人接进来之后换成那位玩家；
 *   - 客人（地址里带 ?join=房间号）：不起主机，经房间的通道连到主人的主机上。
 * 渲染 Worker 两种身份都有：它也是主机的一个只读客户端，状态不经过主线程。
 *
 * 主人的对局记录暂存在 sessionStorage：开发时改了模拟的代码、页面刷新后，照着记录重放到刚才那一步接着走。
 */
import { createConfig, regions } from '@miwang/content';
import meshUrl from '@miwang/content/generated/world-mesh.bin?url';
import { ATTACKER, DEFENDER, type AiLevel, type Command, type OutbreakView } from '@miwang/sim';
import type { PlayerId } from '@rune-engine/core';
import {
  connectSession,
  type ClientMessage,
  type HostMessage,
  type Session,
} from '@rune-engine/net';
import { asPort, observeCanvasSize, sessionStore } from '@rune-engine/runtime';
import { shallowRef, type ShallowRef } from 'vue';
import {
  clientChannel,
  roomChannel,
  type GameRecording,
  type HostControl,
  type HostReport,
  type RenderControl,
  type RenderReport,
  type RoomMessage,
} from './messages.ts';

/** 一步（一天）在 1 倍速下是现实里的多少毫秒 */
const STEP_MS = 400;

type FromHost = HostMessage<OutbreakView>;
type ToHost = ClientMessage<Command>;

export interface GameSession {
  /** 主人（这个标签页里跑着主机）还是加入别人房间的客人 */
  readonly role: 'host' | 'guest';
  /** 这一方现在能看到的状态；主机还没发来第一份时是 null */
  readonly view: ShallowRef<OutbreakView | null>;
  readonly speed: ShallowRef<number>;
  readonly paused: ShallowRef<boolean>;
  /** 扮演攻方还是守方 */
  readonly player: ShallowRef<PlayerId>;
  /** 对面是电脑还是另一位玩家 */
  readonly opponent: ShallowRef<'ai' | 'human'>;
  /** 电脑对手的难度（0 简单、1 普通、2 困难） */
  readonly aiLevel: ShallowRef<AiLevel>;
  /** 房间号：主人开了房间、或者客人加入的那个 */
  readonly room: ShallowRef<string | null>;
  /** 渲染起不来时的原因（没有 WebGPU 等） */
  readonly renderError: ShallowRef<string | null>;
  /** 和渲染线程说话的口子：地图的相机、指针、选中都经它（见 map.ts） */
  readonly renderLink: RenderLink;
  /** 这一局是照着暂存的记录重放接上的：重放了几步、用了多久；新开的一局是 null */
  readonly resumed: ShallowRef<{ ticks: number; replayMs: number } | null>;
  send(command: Command): void;
  setSpeed(speed: number): void;
  setPaused(paused: boolean): void;
  /** 换一方来扮演（只有主人、对面是电脑时可以） */
  setPlayer(player: PlayerId): void;
  /** 换电脑对手的难度（只有主人可以） */
  setAiLevel(level: AiLevel): void;
  /** 开一个房间，返回另一位玩家打开就能加入的地址 */
  openRoom(): string;
  /** 丢掉当前这局，换个种子重新开始（只有主人可以） */
  restart(): void;
  dispose(): void;
}

export interface RenderLink {
  send(message: RenderControl): void;
  /** 渲染线程报告指针停在、点在哪个地区上；地图控制器接上它 */
  onRegion: ((region: number, picked: boolean) => void) | null;
}

const store = sessionStore<GameRecording>('miwang:recording');
/**
 * 存着的记录只在世界数据没变时才能接着用：地图、人口、航线换过之后，照旧的配置重放出来的已经不是眼前这张图了。
 * 判断办法是拿记录里的种子和日期按现在的数据再生成一份配置，看是不是一模一样。
 */
const matchesWorld = ({ config }: GameRecording) =>
  JSON.stringify(createConfig(config.seed, config.startDate)) === JSON.stringify(config);
const other = (player: PlayerId) => (player === ATTACKER ? DEFENDER : ATTACKER);
const shortId = () => Math.random().toString(36).slice(2, 8);

export function createGameSession(canvas: HTMLCanvasElement): GameSession {
  const params = new URLSearchParams(location.search);
  const joining = params.get('join');

  const view = shallowRef<OutbreakView | null>(null);
  const speed = shallowRef(1);
  const paused = shallowRef(false);
  const player = shallowRef<PlayerId>(joining && params.get('as') === '1' ? DEFENDER : ATTACKER);
  const opponent = shallowRef<'ai' | 'human'>(joining ? 'human' : 'ai');
  const aiLevel = shallowRef<AiLevel>(1);
  const room = shallowRef<string | null>(joining);
  const renderError = shallowRef<string | null>(null);
  const resumed = shallowRef<{ ticks: number; replayMs: number } | null>(null);

  const render = new Worker(new URL('./workers/render.worker.ts', import.meta.url), {
    type: 'module',
  });
  const toRender = (message: RenderControl, transfer: Transferable[] = []) =>
    render.postMessage(message, transfer);
  const renderLink: RenderLink = { send: (message) => toRender(message), onRegion: null };
  render.onmessage = ({ data }: MessageEvent<RenderReport>) => {
    if (data.type === 'error') renderError.value = data.message;
    else if (data.type === 'lost') renderError.value = data.message;
    else if (data.type === 'ready') renderError.value = null;
    else if (data.type === 'region') renderLink.onRegion?.(data.region, data.picked);
  };
  // 开发时在控制台里试“显卡设备丢了能不能自己恢复”：__miwang.loseDevice()
  if (import.meta.env.DEV) {
    Object.assign(globalThis, {
      __miwang: { loseDevice: () => toRender({ type: 'lose-device' }) },
    });
  }
  const offscreen = canvas.transferControlToOffscreen();
  toRender({ type: 'init', canvas: offscreen, meshUrl, regionCount: regions.length }, [offscreen]);
  const stopObserving = observeCanvasSize(canvas, (width, height) =>
    toRender({ type: 'resize', width, height }),
  );

  let session: Session<Command> | undefined;
  const cleanups: (() => void)[] = [stopObserving, () => render.terminate()];

  const handlers = {
    view(message: FromHost) {
      // 开发时看“改完代码到画面接上”要多久：performance.getEntriesByName('miwang:first-view')
      if (!view.value) performance.mark('miwang:first-view');
      // 分出胜负的那一刻把时间停下：之后状态不会再变，没必要让主机空转
      if (message.view.outcome && !view.value?.outcome) session?.setPaused(true);
      view.value = message.view;
      speed.value = message.speed;
      paused.value = message.paused;
    },
  };

  const base = {
    view,
    speed,
    paused,
    player,
    opponent,
    aiLevel,
    room,
    renderError,
    renderLink,
    resumed,
    send: (command: Command) => session?.send(command),
    setSpeed: (next: number) => session?.setSpeed(next),
    setPaused: (next: boolean) => session?.setPaused(next),
    dispose() {
      session?.close();
      for (const cleanup of cleanups) cleanup();
    },
  };

  if (joining) {
    // ───── 客人：经房间的通道连到主人的主机 ─────
    const id = shortId();
    const uiChannel = new BroadcastChannel(clientChannel(joining, `ui-${id}`));
    const lobby = new BroadcastChannel(roomChannel(joining));
    session = connectSession<Command, OutbreakView>(asPort<FromHost, ToHost>(uiChannel), handlers);
    toRender({ type: 'connect-channel', name: clientChannel(joining, `render-${id}`) });
    // 主人那边可能还没开房间：隔一会儿招呼一次，收到第一份状态就停
    const knock = () => {
      if (view.value) return clearInterval(knocking);
      for (const [client, readonly] of [
        [`ui-${id}`, false],
        [`render-${id}`, true],
      ] as const) {
        lobby.postMessage({
          type: 'join',
          client,
          player: player.value,
          readonly,
        } satisfies RoomMessage);
      }
    };
    const knocking = setInterval(knock, 600);
    knock();
    cleanups.push(
      () => clearInterval(knocking),
      () => uiChannel.close(),
      () => lobby.close(),
    );
    return {
      ...base,
      role: 'guest',
      setPlayer() {},
      setAiLevel() {},
      openRoom: () => location.href,
      restart() {},
    };
  }

  // ───── 主人：主机在这个标签页的 Worker 里 ─────
  const host = new Worker(new URL('./workers/host.worker.ts', import.meta.url), { type: 'module' });
  const toHost = (message: HostControl, transfer: Transferable[] = []) =>
    host.postMessage(message, transfer);
  cleanups.push(() => host.terminate());

  host.onmessage = ({ data }: MessageEvent<HostReport>) => {
    switch (data.type) {
      case 'recording':
        store.save(data.recording);
        break;
      case 'started':
        resumed.value =
          data.replayedTicks > 0 ? { ticks: data.replayedTicks, replayMs: data.replayMs } : null;
        break;
      case 'joined':
        opponent.value = 'human';
        break;
    }
  };

  /** 界面和渲染各用一条通道连主机，看的是同一方的视角；换视角就重连 */
  function connect() {
    session?.close();
    const ui = new MessageChannel();
    toHost({ type: 'connect', id: 'ui', player: player.value, readonly: false, port: ui.port2 }, [
      ui.port2,
    ]);
    session = connectSession<Command, OutbreakView>(asPort<FromHost, ToHost>(ui.port1), handlers);
    const picture = new MessageChannel();
    toHost(
      { type: 'connect', id: 'render', player: player.value, readonly: true, port: picture.port1 },
      [picture.port1],
    );
    toRender({ type: 'connect', port: picture.port2 }, [picture.port2]);
    if (opponent.value === 'ai') {
      toHost({ type: 'ai', player: other(player.value), level: aiLevel.value });
    }
  }

  function start(recording: GameRecording | null) {
    const today = new Date().toISOString().slice(0, 10);
    const seed = Math.floor(Math.random() * 0x7fffffff);
    toHost({
      type: 'start',
      start: recording ? { recording } : { config: createConfig(seed, today) },
      stepMs: STEP_MS,
    });
    connect();
    if (room.value) toHost({ type: 'open-room', room: room.value });
  }

  const saved = store.load();
  start(saved && matchesWorld(saved) ? saved : null);

  return {
    ...base,
    role: 'host',
    setAiLevel(level) {
      aiLevel.value = level;
      if (opponent.value === 'ai') toHost({ type: 'ai', player: other(player.value), level });
    },
    setPlayer(next) {
      if (opponent.value === 'human') return;
      player.value = next;
      connect();
    },
    openRoom() {
      room.value ??= String(Math.floor(1000 + Math.random() * 9000));
      toHost({ type: 'open-room', room: room.value });
      const url = new URL(location.href);
      url.search = `?join=${room.value}&as=${other(player.value)}`;
      return url.href;
    },
    restart() {
      store.clear();
      view.value = null;
      start(null);
    },
  };
}
