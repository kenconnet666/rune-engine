/**
 * 《迷惘》的服务端入口（Cloudflare Worker）。现在只有一件事：联机的房间。
 *   /api/rooms/<房间号>   WebSocket，进房间
 */
import { RoomObject, roomRequest } from '@rune-engine/edge';

/** 两个人的游戏：一位主人、一位客人 */
export class Room extends RoomObject {
  protected override readonly maxGuests = 1;
}

interface Env {
  readonly ROOMS: DurableObjectNamespace;
}

export default {
  fetch(request, env) {
    const room = /^\/api\/rooms\/([^/]+)$/.exec(new URL(request.url).pathname);
    if (room?.[1]) return roomRequest(request, env.ROOMS, room[1]);
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
