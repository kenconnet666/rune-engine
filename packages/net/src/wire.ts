/**
 * 走网络的那一段：一条只会收发字节的线（Wire），和把它包成消息通道（Port）的办法。
 * WebRTC 的数据通道、WebSocket 中转各实现一条 Wire；主机和会话只认 Port，不知道脚下是什么。
 */
import { decodeMessage, encodeMessage } from './codec.ts';
import type { Port } from './port.ts';

/** 一条收发字节的线 */
export interface Wire {
  send(bytes: Uint8Array): void;
  /** 收到一段字节时调用 */
  onmessage: ((bytes: Uint8Array) => void) | null;
}

/**
 * 把一条线包成消息通道：发的时候编码，收的时候解码。
 * 解不出来的（对面发错了、被人篡改了）丢掉并告诉 onBadMessage，不让一条坏消息把通道弄断。
 */
export function portOverWire<Incoming, Outgoing>(
  wire: Wire,
  onBadMessage?: (error: unknown) => void,
): Port<Incoming, Outgoing> {
  const port: Port<Incoming, Outgoing> = {
    onmessage: null,
    postMessage: (message) => wire.send(encodeMessage(message)),
  };
  wire.onmessage = (bytes) => {
    let data: Incoming;
    try {
      data = decodeMessage(bytes) as Incoming;
    } catch (error) {
      onBadMessage?.(error);
      return;
    }
    port.onmessage?.({ data });
  };
  return port;
}

/**
 * 给一条线加上限流：同一种消息在 intervalMs 里只发最新的那一条（“最新的顶掉旧的”）。
 * 主机每一步都发一份完整的状态，快进时一秒几十份，走网络只要最新的那份就够了；
 * keyOf 返回 null 的消息（命令之类，一条都不能丢）立刻照发。
 *
 * 定时器只管“最后一条别落下”：冷却期过了之后来的消息当场就发，不等定时器——
 * 页面在后台时浏览器会把定时器降到一秒一次甚至更慢，不能让发送的节奏跟着它慢下来。
 */
export function throttleLatest<Outgoing>(
  send: (message: Outgoing) => void,
  keyOf: (message: Outgoing) => string | null,
  intervalMs: number,
  now: () => number,
  later: (run: () => void, ms: number) => void,
): (message: Outgoing) => void {
  const lastSent = new Map<string, number>();
  /** 冷却期里压着的最新一条 */
  const waiting = new Map<string, Outgoing>();
  /** 已经约了定时器的 */
  const scheduled = new Set<string>();

  const sendNow = (key: string, message: Outgoing) => {
    waiting.delete(key);
    lastSent.set(key, now());
    send(message);
  };
  const cooldownLeft = (key: string) => intervalMs - (now() - (lastSent.get(key) ?? -Infinity));
  const schedule = (key: string) => {
    scheduled.add(key);
    later(
      () => {
        scheduled.delete(key);
        const message = waiting.get(key);
        if (message === undefined) return;
        // 约的时候之后又当场发过一条：冷却重新算，这一条再等等
        if (cooldownLeft(key) > 0) schedule(key);
        else sendNow(key, message);
      },
      Math.max(0, cooldownLeft(key)),
    );
  };

  return (message) => {
    const key = keyOf(message);
    if (key === null) return send(message);
    if (cooldownLeft(key) <= 0) return sendNow(key, message);
    waiting.set(key, message);
    if (!scheduled.has(key)) schedule(key);
  };
}
