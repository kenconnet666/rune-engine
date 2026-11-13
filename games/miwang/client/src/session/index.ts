/**
 * 一局游戏在主线程这头的样子。两种身份，界面拿到的是同一个接口（GameSession）：
 *   core.ts   接口本身，和两种身份共用的那一半（状态、渲染线程、连着主机的会话）
 *   host.ts   主人：主机在这个标签页的 Worker 里；自动存档、读档、回放、开房间
 *   guest.ts  客人：地址里带 ?join=房间号，经房间连到主人的主机上
 *   room.ts   联机时两个页面怎么接上
 */
import { createCore, type GameSession } from './core.ts';
import { guestSession } from './guest.ts';
import { hostSession } from './host.ts';
import { joiningCode } from './room.ts';

export type { GameSession, GameSetup, RenderLink } from './core.ts';
export { inviteUrl, normalizeCode, type RoomInfo } from './room.ts';

export function createGameSession(canvas: HTMLCanvasElement): GameSession {
  const joining = joiningCode();
  const core = createCore(canvas, joining ? 'human' : 'ai');
  return joining ? guestSession(core, joining) : hostSession(core);
}
