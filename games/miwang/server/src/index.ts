/**
 * 《迷惘》的服务端入口（Cloudflare Worker）：
 *   /api/rooms/<房间号>     WebSocket，进联机的房间
 *   /api/saves[/<存档名>]   云存档
 * 别的地址是游戏的静态文件（部署时带上，见 package.json 的 deploy），到不了这里。
 */
import { RoomObject, roomRequest, VaultObject, vaultRequest } from '@rune-engine/edge';

/** 两个人的游戏：一位主人、一位客人 */
export class Room extends RoomObject {
  protected override readonly maxGuests = 1;
}

/** 云存档：和本机的存档位一样多 */
export class Vault extends VaultObject {
  protected override readonly maxItems = 8;
}

interface Env {
  readonly ROOMS: DurableObjectNamespace;
  readonly VAULTS: DurableObjectNamespace<Vault>;
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    const room = /^\/api\/rooms\/([^/]+)$/.exec(pathname);
    if (room?.[1]) return roomRequest(request, env.ROOMS, room[1]);
    const saves = /^\/api\/saves(\/[^/]*)?$/.exec(pathname);
    if (saves) return vaultRequest(request, env.VAULTS, saves[1] ?? '');
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
