/**
 * 一次直连的尝试：一条 WebRTC 连接和它上面的一条数据通道。
 * 两头商量用的话（offer / answer / 候选地址）经房间递；通了以后数据不再经过任何服务器——
 * 同一个局域网里走的就是内网。打不通（有些网络环境就是不行）或者断了就结束，要不要再试由上层定。
 */

/** 两头经房间递的话。session 标明是哪一次尝试：上一次留下的话晚到了不会搅进这一次 */
export type DirectSignal =
  | { readonly kind: 'offer'; readonly session: string; readonly sdp: string }
  | { readonly kind: 'answer'; readonly session: string; readonly sdp: string }
  | {
      readonly kind: 'candidate';
      readonly session: string;
      readonly candidate: RTCIceCandidateInit;
    }
  /** 主人对客人说：我这边是个新页面，你手里那条直连作废了，重新来 */
  | { readonly kind: 'reset' };

/** 纸条是对面发来的，先核对形状 */
export function parseDirectSignal(data: unknown): DirectSignal | null {
  if (typeof data !== 'object' || data === null) return null;
  const { kind, session, sdp, candidate } = data as Record<string, unknown>;
  if (kind === 'reset') return { kind };
  if (typeof session !== 'string') return null;
  if ((kind === 'offer' || kind === 'answer') && typeof sdp === 'string') {
    return { kind, session, sdp };
  }
  if (kind === 'candidate' && typeof candidate === 'object' && candidate !== null) {
    return { kind, session, candidate: candidate as RTCIceCandidateInit };
  }
  return null;
}

/** 只用来问“我在公网上是什么地址”（STUN）；不提供中转（TURN），中转由房间代劳 */
export const PUBLIC_STUN: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

/** 这么久还没通就不等了 */
const CONNECT_TIMEOUT_MS = 20_000;

export interface DirectOptions {
  readonly session: string;
  /** 对面的 offer；没有的话这一头是发起方 */
  readonly offer?: string;
  readonly iceServers: RTCIceServer[];
  /** 把要递给对面的话交出去 */
  signal(message: DirectSignal): void;
  onopen(): void;
  /** 没打通，或者通了以后断了；只会叫一次，自己调 close() 的不叫 */
  onclose(): void;
  onmessage(bytes: Uint8Array): void;
}

export interface Direct {
  readonly session: string;
  /** 数据通道通着 */
  readonly open: boolean;
  /** 发送队列里还压着多少字节 */
  readonly buffered: number;
  send(bytes: Uint8Array): void;
  /** 对面递来的话（answer、候选地址） */
  handle(message: DirectSignal): void;
  close(): void;
}

export function createDirect(options: DirectOptions): Direct {
  const { session } = options;
  const connection = new RTCPeerConnection({ iceServers: options.iceServers });
  let channel: RTCDataChannel | undefined;
  let done = false;
  /** 对面的描述还没设上时到的候选地址：先攒着 */
  let early: RTCIceCandidateInit[] | null = [];

  const shut = () => {
    done = true;
    clearTimeout(timeout);
    connection.close();
  };
  const fail = () => {
    if (done) return;
    shut();
    options.onclose();
  };
  const timeout = setTimeout(() => {
    if (channel?.readyState !== 'open') fail();
  }, CONNECT_TIMEOUT_MS);

  const adopt = (next: RTCDataChannel) => {
    channel = next;
    next.binaryType = 'arraybuffer';
    next.onopen = () => !done && options.onopen();
    next.onclose = fail;
    next.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (!done && data instanceof ArrayBuffer) options.onmessage(new Uint8Array(data));
    };
  };

  connection.onicecandidate = ({ candidate }) => {
    if (candidate) options.signal({ kind: 'candidate', session, candidate: candidate.toJSON() });
  };
  connection.onconnectionstatechange = () => {
    if (connection.connectionState === 'failed') fail();
  };

  const setRemote = async (description: RTCSessionDescriptionInit) => {
    await connection.setRemoteDescription(description);
    for (const candidate of early ?? []) await connection.addIceCandidate(candidate);
    early = null;
  };

  const negotiate = async () => {
    if (options.offer === undefined) {
      // 默认的通道：按顺序、不丢（丢一条命令比慢一点糟得多）
      adopt(connection.createDataChannel('game'));
      await connection.setLocalDescription();
      options.signal({ kind: 'offer', session, sdp: connection.localDescription?.sdp ?? '' });
    } else {
      connection.ondatachannel = (event) => adopt(event.channel);
      await setRemote({ type: 'offer', sdp: options.offer });
      await connection.setLocalDescription();
      options.signal({ kind: 'answer', session, sdp: connection.localDescription?.sdp ?? '' });
    }
  };
  negotiate().catch(fail);

  return {
    session,
    get open() {
      return !done && channel?.readyState === 'open';
    },
    get buffered() {
      return channel?.bufferedAmount ?? 0;
    },
    send(bytes) {
      try {
        channel?.send(bytes as Uint8Array<ArrayBuffer>);
      } catch {
        fail();
      }
    },
    handle(message) {
      if (done || message.kind === 'reset' || message.session !== session) return;
      if (message.kind === 'answer') {
        setRemote({ type: 'answer', sdp: message.sdp }).catch(fail);
      } else if (message.kind === 'candidate') {
        if (early) early.push(message.candidate);
        // 个别候选地址加不上不要紧，还有别的
        else connection.addIceCandidate(message.candidate).catch(() => {});
      }
    },
    close: shut,
  };
}
