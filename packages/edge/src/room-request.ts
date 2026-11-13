/** Worker 入口用的：把“连某个房间”的请求交给那个房间的对象 */
import { ROOM_CODE } from '@rune-engine/net';

/**
 * 请求是不是自己的页面发的：浏览器发 WebSocket 请求时带着页面的来源（Origin），
 * 别的网站的页面想借用这个服务会在这里被挡下。本机开发的页面（localhost）放行；
 * 不带来源的是脚本、测试这类不经浏览器的请求，它们本来就能随便填来源，挡了没有意义。
 */
function fromOwnPage(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) return true;
  const host = URL.parse(origin)?.hostname;
  return (
    host === new URL(request.url).hostname ||
    host === request.headers.get('Host')?.split(':')[0] ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

/** 同一个房间号总是落到同一个对象上：先到的人把它叫醒，后到的人找到的就是它 */
export function roomRequest(
  request: Request,
  rooms: DurableObjectNamespace,
  code: string,
): Response | Promise<Response> {
  if (!ROOM_CODE.test(code)) return new Response('bad room code', { status: 400 });
  if (!fromOwnPage(request)) return new Response('forbidden origin', { status: 403 });
  return rooms.get(rooms.idFromName(code)).fetch(request);
}
