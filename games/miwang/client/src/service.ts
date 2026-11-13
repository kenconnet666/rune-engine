/**
 * 服务端在哪（联机的房间、云存档都在它下面），和跟它打交道时用的随机数。
 * 地址在构建时定（见 vite.config.ts）：没配的话就是一个纯静态的游戏——
 * 联机退化成同一个浏览器里的标签页互连，云存档不可用。
 */

/** 服务端接口的地址，可以是相对的（'/api'）；没有服务端是 undefined */
export const API_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;

/** 猜不到的随机数（0–1）：房间号、钥匙、同步码这些当凭据用的东西用它生成 */
export const secureRandom = () => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32;
