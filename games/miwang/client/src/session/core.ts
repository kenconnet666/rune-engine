/**
 * 一局游戏在主线程这头的样子（GameSession），和主人、客人两种身份共用的那一半：
 * 界面看的那些状态、渲染线程、连着主机的那条会话。两种身份各自的那一半见 host.ts、guest.ts。
 */
import { regions, type ChapterId } from '@miwang/content';
import detailUrl from '@miwang/content/generated/world-mesh-detail.bin?url';
import meshUrl from '@miwang/content/generated/world-mesh.bin?url';
import { ATTACKER, DEFENDER, type AiLevel, type Command, type OutbreakView } from '@miwang/sim';
import type { PlayerId } from '@rune-engine/core';
import {
  connectSession,
  type ClientMessage,
  type HostMessage,
  type Port,
  type Session,
} from '@rune-engine/net';
import { observeCanvasSize } from '@rune-engine/runtime';
import { shallowRef, watchEffect, type ShallowRef } from 'vue';
import type { UiReport } from '@rune-engine/render/ui-types';
import type { GameRecording, RenderControl, RenderReport } from '../messages.ts';
import { palette } from '../palette.ts';
import type { RoomInfo } from './room.ts';

export type FromHost = HostMessage<OutbreakView>;
export type ToHost = ClientMessage<Command>;

export const other = (player: PlayerId) => (player === ATTACKER ? DEFENDER : ATTACKER);

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
  /** 联机的房间：主人开着的、或者客人加入的那个，和它现在的状态；没有房间是 null */
  readonly room: ShallowRef<RoomInfo | null>;
  /** 渲染起不来时的原因（没有 WebGPU 等） */
  readonly renderError: ShallowRef<string | null>;
  /** 渲染线程的画面现在是不是好的：是的话界面可以交给它合成（画进画布） */
  readonly renderLive: ShallowRef<boolean>;
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
  /** 换一方来扮演（只有主人可以；对面是另一位玩家时，它跟着换到另一方） */
  setPlayer(player: PlayerId): void;
  /** 换电脑对手的难度（只有主人可以） */
  setAiLevel(level: AiLevel): void;
  /** 开一个房间等另一位玩家进来（只有主人可以）；已经开着就什么都不做 */
  openRoom(): void;
  /** 关掉房间：对面由电脑接着控制 */
  closeRoom(): void;
  /** 另一位玩家掉线了，让电脑先接手；房间还开着，它回来就换回去 */
  handOver(): void;
  /** 丢掉当前这局，换个种子重新开始（只有主人可以）；可以顺便换病原体、换扮演的一方、换电脑的难度 */
  restart(setup?: GameSetup): void;
  dispose(): void;
}

/** 开一局时可以选的东西；没写的沿用现在的 */
export interface GameSetup {
  /** 打哪一章；不写是普通对局（章节自己定了用哪种病原体） */
  readonly chapter?: ChapterId;
  /** 病原体档案的 id */
  readonly pathogen?: string;
  readonly player?: PlayerId;
  readonly level?: AiLevel;
  /** 不要世界条件（普通对局默认按种子抽两条） */
  readonly plain?: boolean;
}

export interface RenderLink {
  /** transfer 是要转移过去的东西（拍下来的界面） */
  send(message: RenderControl, transfer?: Transferable[]): void;
  /** 渲染线程报告指针停在、点在哪个地区上；地图控制器接上它 */
  onRegion: ((region: number, picked: boolean) => void) | null;
  /** 渲染线程在界面这条线上回的话（贴图没了要重拍、哪几层画上了）；舞台接上它 */
  onUi: ((report: UiReport) => void) | null;
}

/** GameSession 里两种身份做法一样的那些成员 */
type SharedMembers =
  | 'view'
  | 'speed'
  | 'paused'
  | 'player'
  | 'opponent'
  | 'aiLevel'
  | 'room'
  | 'renderError'
  | 'renderLive'
  | 'renderLink'
  | 'resumed'
  | 'playback'
  | 'send'
  | 'setSpeed'
  | 'setPaused'
  | 'dispose';

export interface SessionCore {
  readonly shared: Pick<GameSession, SharedMembers>;
  toRender(message: RenderControl, transfer?: Transferable[]): void;
  /** 经这条通道连主机，换掉上一条；tap 是收到每份状态时另外要做的事 */
  connect(port: Port<FromHost, ToHost>, tap?: (message: FromHost) => void): void;
  /** 现在连着主机的那条会话 */
  readonly session: Session<Command> | undefined;
  /** 这一局结束（页面卸载）时要做的收尾，各自往里加 */
  readonly cleanups: (() => void)[];
}

/** 界面两次跟着主机换状态之间至少隔这么久（毫秒）：一秒十次，够看清数字在变，又不至于把主线程占满 */
const VIEW_GAP_MS = 100;

export function createCore(canvas: HTMLCanvasElement, opponent: 'ai' | 'human'): SessionCore {
  const view = shallowRef<OutbreakView | null>(null);
  const speed = shallowRef(1);
  const paused = shallowRef(false);
  const renderError = shallowRef<string | null>(null);
  /** 渲染线程的画面现在是不是好的（建好了、没丢设备、没报错） */
  const renderLive = shallowRef(false);

  // ───── 渲染线程 ─────
  const render = new Worker(new URL('../workers/render.worker.ts', import.meta.url), {
    type: 'module',
  });
  const toRender = (message: RenderControl, transfer: Transferable[] = []) =>
    render.postMessage(message, transfer);
  const renderLink: RenderLink = { send: toRender, onRegion: null, onUi: null };
  render.onmessage = ({ data }: MessageEvent<RenderReport>) => {
    if (data.type === 'error' || data.type === 'lost') {
      renderError.value = data.message;
      renderLive.value = false;
    } else if (data.type === 'ready') {
      renderError.value = null;
      renderLive.value = true;
    } else if (data.type === 'region') renderLink.onRegion?.(data.region, data.picked);
    else if (data.type === 'ui-request' || data.type === 'ui-drawn') renderLink.onUi?.(data);
    else if (data.type === 'stats') console.info('渲染线程', data);
  };
  // 渲染线程里没接住的错（每帧的循环里抛出来的）：线程自己报不了，主线程这头接着——否则就是一张不再动的画面
  render.onerror = (event) => {
    renderError.value = event.message;
    renderLive.value = false;
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
  // 地图的色带跟着设置里选的配色走
  const stopPalette = watchEffect(() => toRender({ type: 'palette', name: palette.value }));

  // ───── 连着主机的会话 ─────
  let session: Session<Command> | undefined;
  const cleanups: (() => void)[] = [
    stopObserving,
    stopPalette,
    () => render.terminate(),
    () => clearTimeout(holding),
  ];

  function apply(message: FromHost) {
    // 开发时看“改完代码到画面接上”要多久：performance.getEntriesByName('miwang:first-view')
    if (!view.value) performance.mark('miwang:first-view');
    // 分出胜负的那一刻把时间停下：之后状态不会再变，没必要让主机空转
    if (message.view.outcome && !view.value?.outcome) session?.setPaused(true);
    view.value = message.view;
    speed.value = message.speed;
    paused.value = message.paused;
    appliedAt = performance.now();
  }

  /**
   * 主机每走一天发来一份状态。界面不用每一份都跟：10 倍速时一秒二十多份，每跟一次整套面板就要重新排版、绘制一遍
   * （十几到二十几毫秒），主线程有一半时间花在这上面，数字也跳得看不清。所以两次之间至少隔 VIEW_GAP_MS，
   * 中间来的只留最新的一份。地图不受影响：它在渲染线程里另有一路数据。
   * 这几种情况不等，马上换：头一份；日子没往前走的（下了命令、换了边、新开了一局）；暂停、倍速变了；分出了胜负。
   */
  let appliedAt = -Infinity;
  let held: FromHost | undefined;
  let holding: ReturnType<typeof setTimeout> | undefined;
  function onView(message: FromHost) {
    const shown = view.value;
    const wait = appliedAt + VIEW_GAP_MS - performance.now();
    const urgent =
      !shown ||
      message.view.tick <= shown.tick ||
      message.view.player !== shown.player ||
      message.paused !== paused.value ||
      message.speed !== speed.value ||
      (message.view.outcome !== null) !== (shown.outcome !== null);
    if (urgent || wait <= 0) {
      clearTimeout(holding);
      holding = undefined;
      held = undefined;
      apply(message);
      return;
    }
    held = message;
    holding ??= setTimeout(() => {
      holding = undefined;
      const next = held;
      held = undefined;
      // 这期间要是换了一局（状态被清掉了），留着的那份是上一局的：不要了
      if (next && view.value) apply(next);
    }, wait);
  }

  return {
    shared: {
      view,
      speed,
      paused,
      player: shallowRef<PlayerId>(ATTACKER),
      opponent: shallowRef(opponent),
      aiLevel: shallowRef<AiLevel>(1),
      room: shallowRef<RoomInfo | null>(null),
      renderError,
      renderLive,
      renderLink,
      resumed: shallowRef<{ ticks: number; replayMs: number } | null>(null),
      playback: shallowRef<{ readonly length: number } | null>(null),
      send: (command) => session?.send(command),
      setSpeed: (next) => session?.setSpeed(next),
      setPaused: (next) => session?.setPaused(next),
      dispose() {
        session?.close();
        for (const cleanup of cleanups) cleanup();
      },
    },
    toRender,
    connect(port, tap) {
      session?.close();
      session = connectSession<Command, OutbreakView>(port, {
        view(message) {
          onView(message);
          tap?.(message);
        },
      });
    },
    get session() {
      return session;
    },
    cleanups,
  };
}
