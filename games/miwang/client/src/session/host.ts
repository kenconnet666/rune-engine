/**
 * 主人：主机在这个标签页的 Worker 里，自己是它的一个客户端；渲染线程是它的另一个只读客户端，状态不经过主线程。
 * 另一方默认由电脑控制，开了房间、有人进来之后换成那位玩家（房间和网络见 room.ts）。
 *
 * 正在打的这一局随时自动存着（见 saves/local.ts）：关掉页面再打开、开发时改了代码页面刷新，都照着记录重算到刚才那一步接着走。
 * 还可以回放一份记录：从头一天一天地放，能调速、暂停、跳到任意一天，但不能下命令。
 */
import {
  CHAPTERS,
  createConfig,
  DEFAULT_PATHOGEN,
  PATHOGENS,
  type ChapterDef,
} from '@miwang/content';
import { asPort, jsonStore } from '@rune-engine/runtime';
import { shallowRef, watch } from 'vue';
import type { GameRecording, HostControl, HostReport } from '../messages.ts';
import { autosave } from '../saves/local.ts';
import { matchesWorld } from '../saves/recording.ts';
import { other, type FromHost, type GameSession, type SessionCore, type ToHost } from './core.ts';
import { hostedRoom, newRoom, openHostRoom, type HostedRoom, type OpenRoom } from './room.ts';

/** 一步（一天）在 1 倍速下是现实里的多少毫秒 */
const STEP_MS = 400;

const profileOf = (id: string) => PATHOGENS.find((pathogen) => pathogen.id === id);

/** 这一局里自己扮的是哪一方、电脑的难度：和自动存档放在一起，刷新页面接着打时还是原来那样 */
const seat = jsonStore<{ player: number; level: number }>('miwang:seat', 'device');

export function hostSession(core: SessionCore): GameSession {
  const { shared } = core;
  const { view, speed, paused, player, opponent, aiLevel, room, resumed, playback } = shared;

  const host = new Worker(new URL('../workers/host.worker.ts', import.meta.url), {
    type: 'module',
  });
  const toHost = (message: HostControl, transfer: Transferable[] = []) =>
    host.postMessage(message, transfer);
  core.cleanups.push(() => host.terminate());

  /**
   * 主机最近报上来的对局记录；回放时是正在放的那份。
   * 是响应式的：刚开局时它晚一步才到，界面（存档页的“存下这一局”）要跟着它亮起来
   */
  const latest = shallowRef<GameRecording | null>(null);

  const saved = seat.load();
  if (saved?.player === 0 || saved?.player === 1) player.value = saved.player;
  if (saved?.level === 0 || saved?.level === 1 || saved?.level === 2) aiLevel.value = saved.level;
  core.cleanups.push(
    watch([player, aiLevel], () => seat.save({ player: player.value, level: aiLevel.value })),
  );

  host.onmessage = ({ data }: MessageEvent<HostReport>) => {
    switch (data.type) {
      case 'recording':
        latest.value = data.recording;
        autosave.save(data.recording);
        break;
      case 'started':
        resumed.value =
          data.replayedTicks > 0 ? { ticks: data.replayedTicks, replayMs: data.replayMs } : null;
        break;
    }
  };

  /** 让电脑控制另一方（回放时没有电脑对手） */
  const letAiPlay = () => {
    if (!playback.value) toHost({ type: 'ai', player: other(player.value), level: aiLevel.value });
  };
  /** 开局时告诉主机的那一份：对手是电脑的话，它控制另一方 */
  const aiSeat = () =>
    opponent.value === 'ai' ? { player: other(player.value), level: aiLevel.value } : null;

  // ───── 接到主机上 ─────

  /** 界面和渲染各用一条通道连主机，看的是同一方的视角；换视角就重连 */
  function connect() {
    const ui = new MessageChannel();
    toHost({ type: 'connect', id: 'ui', player: player.value, readonly: false, port: ui.port2 }, [
      ui.port2,
    ]);
    core.connect(asPort<FromHost, ToHost>(ui.port1));
    const picture = new MessageChannel();
    toHost(
      { type: 'connect', id: 'render', player: player.value, readonly: true, port: picture.port1 },
      [picture.port1],
    );
    core.toRender({ type: 'connect', port: picture.port2 }, [picture.port2]);
    // 主机重起、换边之后旧的连接都作废了：联机的那位玩家也重新接上
    hosted?.reseat();
  }

  /** 开局：有记录就照着它接上；没有就新开一局——打某一章，或者用某种病原体的普通对局 */
  function start(
    recording: GameRecording | null,
    fresh: {
      chapter?: ChapterDef;
      pathogen?: typeof DEFAULT_PATHOGEN;
      conditions?: readonly string[];
    } = {},
  ) {
    playback.value = null;
    latest.value = recording;
    const today = new Date().toISOString().slice(0, 10);
    const seed = Math.floor(Math.random() * 0x7fffffff);
    toHost({
      type: 'start',
      start: recording ? { recording } : { config: createConfig(seed, today, fresh) },
      stepMs: STEP_MS,
      ai: aiSeat(),
    });
    connect();
  }

  /** 回放：从第 from 天放起。跳到某一天也是它——主机照着记录重算到那一天再接着放 */
  function play(recording: GameRecording, from: number) {
    const wasPaused = paused.value;
    const wasSpeed = speed.value;
    playback.value = { length: recording.ticks };
    latest.value = recording;
    view.value = null;
    toHost({ type: 'start', start: { playback: recording, from }, stepMs: STEP_MS, ai: null });
    connect();
    // 新起的主机是 1 倍速、没暂停的：跳转之后保持原来的快慢
    core.session?.setSpeed(wasSpeed);
    core.session?.setPaused(wasPaused);
  }

  /** 接上自动存着的那一局；没有（或者数据换过版本对不上了）就新开一局 */
  const resume = () => {
    const saved = autosave.load();
    start(saved && matchesWorld(saved) ? saved : null);
  };

  // ───── 联机的房间 ─────

  /** 开着的房间；没开是 undefined */
  let hosted: OpenRoom | undefined;
  /** 第几次开房间：换了房间之后，上一个房间晚到的状态不算数 */
  let hosting = 0;

  /** 开房间。房间号撞上别人正在用的就换一个再开（attempt 是换过几次了） */
  function openRoomAs(entry: HostedRoom, attempt = 0) {
    hosted?.close();
    hostedRoom.save(entry);
    const turn = ++hosting;
    hosted = openHostRoom({
      ...entry,
      seat: () => other(player.value),
      attach(seat) {
        const channel = new MessageChannel();
        toHost(
          { type: 'connect', id: 'guest', player: seat, readonly: false, port: channel.port2 },
          [channel.port2],
        );
        return channel.port1;
      },
      detach: () => toHost({ type: 'disconnect', id: 'guest' }),
      onguest(present) {
        if (present) {
          opponent.value = 'human';
          toHost({ type: 'ai', player: null, level: aiLevel.value });
        } else if (opponent.value === 'human') {
          // 对面掉线了：先把时间停下，等它回来，或者由玩家决定让电脑接手
          core.session?.setPaused(true);
        }
      },
      onchange(info) {
        if (turn !== hosting) return;
        if (info.state === 'closed' && info.reason === 'taken' && attempt < 5) {
          openRoomAs(newRoom(), attempt + 1);
          return;
        }
        room.value = info;
      },
    });
  }
  core.cleanups.push(() => hosted?.close());

  resume();
  // 刷新之前开着房间：接着开同一个，另一位玩家会自己连回来
  const kept = hostedRoom.load();
  if (kept) openRoomAs(kept);

  return {
    ...shared,
    role: 'host',
    setAiLevel(level) {
      aiLevel.value = level;
      if (opponent.value === 'ai') letAiPlay();
    },
    setPlayer(next) {
      player.value = next;
      connect();
      // 换了边：电脑去管另一边
      if (opponent.value === 'ai') letAiPlay();
    },
    openRoom() {
      if (!hosted) openRoomAs(newRoom());
    },
    closeRoom() {
      hosting++;
      hosted?.close();
      hosted = undefined;
      hostedRoom.clear();
      room.value = null;
      opponent.value = 'ai';
      letAiPlay();
    },
    handOver() {
      opponent.value = 'ai';
      letAiPlay();
    },
    recording: () => latest.value,
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
      if (playback.value && latest.value) play(latest.value, day);
    },
    stopWatching() {
      view.value = null;
      resume();
    },
    restart(setup = {}) {
      autosave.clear();
      view.value = null;
      // 换边、换难度要在开局之前定下来：开局时就按它们把电脑接到另一方
      if (setup.level !== undefined) aiLevel.value = setup.level;
      if (setup.player !== undefined) player.value = setup.player;
      const chapter = CHAPTERS.find((candidate) => candidate.id === setup.chapter);
      start(
        null,
        chapter
          ? { chapter }
          : {
              pathogen: (setup.pathogen && profileOf(setup.pathogen)) || DEFAULT_PATHOGEN,
              // 不写就按种子抽；不要条件的写成空的
              ...(setup.plain && { conditions: [] }),
            },
      );
    },
  };
}
