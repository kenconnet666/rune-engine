/**
 * 存档柜：放在服务端的几份东西（云存档）。没有账号——一把随机的钥匙对应一个柜子，谁拿着钥匙谁就能开；
 * 想在另一台设备上看到同一批存档，把钥匙抄过去就行。柜子不懂里面放的是什么：每份是一段字节，外加一小段说明（meta）。
 *
 * 这里是两头（浏览器里的客户端、服务端的柜子）共用的约定，走普通的 HTTP：
 *   GET    <地址>          列出柜子里有什么（不含内容）      → { items: VaultItem[] }
 *   GET    <地址>/<id>     取一份的内容                      → 字节
 *   PUT    <地址>/<id>     放一份进去（已有就换掉）；说明写在 VAULT_META_HEADER 这个请求头里
 *   DELETE <地址>/<id>     拿掉一份
 * 每个请求都带 `Authorization: Bearer <钥匙>`。放满了会挤掉最旧的一份；太久没人碰的柜子会被整个清掉。
 */

import { roomToken } from './room.ts';

/** 钥匙：24–64 位小写字母与数字。它就是全部的凭据，所以要够长、用猜不到的随机数生成 */
export const VAULT_KEY = /^[a-z0-9]{24,64}$/;
/** 生成一把钥匙；random 给 0–1 的随机数（要用猜不到的那种） */
export const vaultKey = (random: () => number) => roomToken(random, 32);
/** 一份东西的名字：4–32 位小写字母与数字 */
export const VAULT_ITEM_ID = /^[a-z0-9]{4,32}$/;
/** 放东西时，说明写在这个请求头里：JSON 再做一次 URI 编码（请求头里不能直接放中文） */
export const VAULT_META_HEADER = 'X-Vault-Meta';

/** 柜子里的一份东西（列表里的样子，不含内容） */
export interface VaultItem {
  readonly id: string;
  /** 放进去时附的说明：一个 JSON 对象，柜子原样存、原样给 */
  readonly meta: unknown;
  /** 内容有多少字节 */
  readonly size: number;
  /** 什么时候放进去的（毫秒时间戳，服务端的钟） */
  readonly savedAt: number;
}
