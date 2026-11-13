/**
 * 跑在 Cloudflare Workers 上的服务端积木。游戏的服务入口（一个 Worker）把它们拼起来：
 *   房间     联机时让两头找到彼此、商量直连、直连不通时中转
 *   存档柜   云存档
 * 每样都是“一个 Durable Object 类 + 一个把请求交给它的函数”。
 */
export { RoomObject } from './room-object.ts';
export { roomRequest } from './room-request.ts';
export { VaultObject } from './vault-object.ts';
export { vaultRequest } from './vault-request.ts';
