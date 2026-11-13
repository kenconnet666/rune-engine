import type { Port } from '@rune-engine/net';

/** 能发消息、有 onmessage 的东西：Worker、MessagePort、Worker 里的 self */
export interface MessageTarget {
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
  // 各种目标的 onmessage 参数类型各不相同（MessageEvent 的不同子类型），这里只需要能赋值
  onmessage: unknown;
}

/** 把 Worker、MessagePort 包成会话用的消息通道（net 包按结构定义通道，不认识浏览器的类型） */
export function asPort<Incoming, Outgoing>(target: MessageTarget): Port<Incoming, Outgoing> {
  let handler: Port<Incoming, Outgoing>['onmessage'] = null;
  return {
    postMessage: (message, transfer = []) => target.postMessage(message, transfer),
    get onmessage() {
      return handler;
    },
    set onmessage(next) {
      handler = next;
      target.onmessage = next && ((event: { data: Incoming }) => next({ data: event.data }));
    },
  };
}
