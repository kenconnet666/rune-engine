/**
 * 一条双向的消息通道，按结构定义：Worker、MessagePort 包一层就满足它；走网络的（WebRTC 数据通道、WebSocket）
 * 先是一条收发字节的线，再包成它（见 wire.ts）。
 * 这个包不引用任何宿主环境的类型，所以在浏览器、Worker、Node 里都能用。
 */
export interface Port<Incoming, Outgoing> {
  /** transfer 里的缓冲区转移给对面（零拷贝），不支持转移的通道可以忽略它 */
  postMessage(message: Outgoing, transfer?: ArrayBuffer[]): void;
  /** 收到消息时调用；再设一次就换掉上一个 */
  onmessage: ((event: { data: Incoming }) => void) | null;
}

/** 同一个线程里直接相连的一对通道（测试、同线程的 AI 用）：消息在下一个微任务送达，和真通道一样是异步的 */
export function createPortPair<A, B>(): [Port<A, B>, Port<B, A>] {
  const make = <In, Out>(peer: () => Port<Out, In>): Port<In, Out> => ({
    onmessage: null,
    postMessage(message) {
      void Promise.resolve().then(() => peer().onmessage?.({ data: message }));
    },
  });
  const first: Port<A, B> = make(() => second);
  const second: Port<B, A> = make(() => first);
  return [first, second];
}
