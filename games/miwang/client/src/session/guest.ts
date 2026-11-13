/**
 * 客人（地址里带 ?join=房间号）：不起主机，经房间连到主人的主机上（房间和网络见 room.ts）。
 * 状态从网络来，界面和渲染各要一份：主线程收到后转一份给渲染线程。
 * 开局、读档、回放、换边都是主人的事，客人这头这些操作什么都不做。
 */
import type { GameSession, SessionCore } from './core.ts';
import { joinGuestRoom } from './room.ts';

export function guestSession(core: SessionCore, code: string): GameSession {
  const { shared } = core;
  const picture = new MessageChannel();
  core.toRender({ type: 'connect', port: picture.port2 }, [picture.port2]);
  const joined = joinGuestRoom({
    code,
    onseat: (seat) => (shared.player.value = seat),
    onchange: (info) => (shared.room.value = info),
  });
  core.connect(joined.port, (message) => picture.port1.postMessage(message));
  core.cleanups.push(() => joined.close());

  return {
    ...shared,
    role: 'guest',
    setPlayer() {},
    setAiLevel() {},
    openRoom() {},
    closeRoom() {},
    handOver() {},
    restart() {},
    recording: () => null,
    load() {},
    watch() {},
    seek() {},
    stopWatching() {},
  };
}
