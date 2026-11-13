/**
 * 一局游戏在主线程这头的样子。两种身份：
 *   - 主人：起主机 Worker，自己是它的一个客户端；另一方默认由电脑控制，开了房间、有人接进来之后换成那位玩家；
 *   - 客人（地址里带 ?join=房间号）：不起主机，经房间的通道连到主人的主机上。
 * 渲染 Worker 两种身份都有：它也是主机的一个只读客户端，状态不经过主线程。
 *
 * 主人正在打的这一局随时自动存着（见 saves.ts）：关掉页面再打开、开发时改了代码页面刷新，都照着记录重算到刚才那一步接着走。
 * 主人还可以回放一份记录：从头一天一天地放，能调速、暂停、跳到任意一天，但不能下命令。
 */
import { createConfig, DEFAULT_PATHOGEN, PATHOGENS, regions } from '@miwang/content';
import detailUrl from '@miwang/content/generated/world-mesh-detail.bin?url';
import meshUrl from '@miwang/content/generated/world-mesh.bin?url';
import { ATTACKER, DEFENDER, type AiLevel, type Command, type OutbreakView } from '@miwang/sim';
import type { PlayerId } from '@rune-engine/core';
import {
  connectSession,
  type ClientMessage,
  type HostMessage,
  type Session,
} from '@rune-engine/net';
import { asPort, observeCanvasSize } from '@rune-engine/runtime';
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
import { autosave, matchesWorld } from './saves.ts';

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
  /** 正在回放的话，那份记录一共多少天；不是回放是 null */
  readonly playback: ShallowRef<{ readonly length: number } | null>;
  /** 到目前为止的对局记录（存档、导出用）；还没有时是 null。回放时是正在放的那份 */
  recording(): GameRecording | null;
  /** 读档：照着一份记录重算到最后一步，接着打（只有主人可以） */
  load(recording: GameRecording): void;
  /** 回放一份记录，从头放起（只有主人可以） */
  watch(recording: GameRecording): void;
  /** 回放时跳到第几天 */
  seek(day: number): void;
  /** 退出回放，回到自动存着的那一局（没有就新开一局） */
  stopWatching(): void;
  send(command: Command): void;
  setSpeed(speed: number): void;
  setPaused(paused: boolean): void;
  /** 换一方来扮演（只有主人、对面是电脑时可以） */
  setPlayer(player: PlayerId): void;
  /** 换电脑对手的难度（只有主人可以） */
  setAiLevel(level: AiLevel): void;
  /** 开一个房间，返回另一位玩家打开就能加入的地址 */
  openRoom(): string;
  /** 丢掉当前这局，换个种子重新开始（只有主人可以）；可以顺便换病原体、换扮演的一方、换电脑的难度 */
  restart(setup?: GameSetup): void;
  dispose(): void;
}

/** 开一局时可以选的东西；没写的沿用现在的 */
export interface GameSetup {
  /** 病原体档案的 id */
  readonly pathogen?: string;
  readonly player?: PlayerId;
  readonly level?: AiLevel;
}

export interface RenderLink {
  send(message: RenderControl): void;
  /** 渲染线程报告指针停在、点在哪个地区上；地图控制器接上它 */
  onRegion: ((region: number, picked: boolean) => void) | null;
}

const profileOf = (id: string) => PATHOGENS.find((pathogen) => pathogen.id === id);
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
  const playback = shallowRef<{ readonly length: number } | null>(null);

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
    else if (data.type === 'stats') console.info('渲染线程', data);
  };
  // 开发时在控制台里用：__miwang.loseDevice() 试显卡设备丢了能不能自己恢复，__miwang.stats() 看渲染线程画得多快
  if (import.meta.env.DEV) {
    Object.assign(globalThis, {
      __miwang: {
        loseDevice: () => toRender({ type: 'lose-device' }),
        stats: () => toRender({ type: 'stats' }),
      },
    });
  }
  const offscreen = canvas.transferControlToOffscreen();
  toRender({ type: 'init', canvas: offscreen, meshUrl, detailUrl, regionCount: regions.length }, [
    offscreen,
  ]);
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
    playback,
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
      recording: () => null,
      load() {},
      watch() {},
      seek() {},
      stopWatching() {},
    };
  }

  // ───── 主人：主机在这个标签页的 Worker 里 ─────
  const host = new Worker(new URL('./workers/host.worker.ts', import.meta.url), { type: 'module' });
  const toHost = (message: HostControl, transfer: Transferable[] = []) =>
    host.postMessage(message, transfer);
  cleanups.push(() => host.terminate());

  /** 主机最近报上来的对局记录；回放时是正在放的那份 */
  let latest: GameRecording | null = null;

  host.onmessage = ({ data }: MessageEvent<HostReport>) => {
    switch (data.type) {
      case 'recording':
        latest = data.recording;
        autosave.save(data.recording);
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
    if (opponent.value === 'ai' && !playback.value) {
      toHost({ type: 'ai', player: other(player.value), level: aiLevel.value });
    }
  }

  function start(recording: GameRecording | null, pathogen = DEFAULT_PATHOGEN) {
    playback.value = null;
    latest = recording;
    const today = new Date().toISOString().slice(0, 10);
    const seed = Math.floor(Math.random() * 0x7fffffff);
    toHost({
      type: 'start',
      start: recording ? { recording } : { config: createConfig(seed, today, { pathogen }) },
      stepMs: STEP_MS,
    });
    connect();
    if (room.value) toHost({ type: 'open-room', room: room.value });
  }

  /** 回放：从第 from 天放起。跳到某一天也是它——主机照着记录重算到那一天再接着放 */
  function play(recording: GameRecording, from: number) {
    const wasPaused = paused.value;
    const wasSpeed = speed.value;
    playback.value = { length: recording.ticks };
    latest = recording;
    view.value = null;
    toHost({ type: 'start', start: { playback: recording, from }, stepMs: STEP_MS });
    connect();
    // 新起的主机是 1 倍速、没暂停的：跳转之后保持原来的快慢
    session?.setSpeed(wasSpeed);
    session?.setPaused(wasPaused);
  }

  const saved = autosave.load();
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
    recording: () => latest,
    load(recording) {
      view.value = null;
      start(recording);
    },
    watch(recording) {
      paused.value = false;
      speed.value = 3;
      play(recording, 0);
    },
    seek(day) {
      if (playback.value && latest) play(latest, day);
    },
    stopWatching() {
      const own = autosave.load();
      view.value = null;
      start(own && matchesWorld(own) ? own : null);
    },
    restart(setup = {}) {
      autosave.clear();
      view.value = null;
      // 换边、换难度要在开局之前定下来：开局时就按它们把电脑接到另一方
      if (setup.level !== undefined) aiLevel.value = setup.level;
      if (setup.player !== undefined && opponent.value === 'ai') player.value = setup.player;
      start(null, (setup.pathogen && profileOf(setup.pathogen)) || DEFAULT_PATHOGEN);
    },
  };
}
