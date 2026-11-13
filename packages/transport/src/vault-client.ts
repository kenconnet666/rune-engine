/**
 * 存档柜在浏览器这头的样子（云存档）：约定见 net 包的 vault.ts。
 * 柜子里放的是字节；存档这类文字的东西先压一下再放（gzipText / gunzipText），省流量也省服务端的地方。
 */
import { VAULT_META_HEADER, type VaultItem } from '@rune-engine/net';

/** 没办成的原因 */
export type VaultFailure =
  /** 连不上服务（没网、服务没部署） */
  | 'unreachable'
  /** 钥匙不对（格式不合） */
  | 'unauthorized'
  /** 这一份太大了 */
  | 'too-large'
  /** 别的（服务端出错、请求不合约定） */
  | 'failed';

export class VaultError extends Error {
  readonly reason: VaultFailure;
  constructor(reason: VaultFailure) {
    super(`vault: ${reason}`);
    this.reason = reason;
  }
}

export interface VaultClient {
  /** 柜子里有什么，新的在前 */
  list(): Promise<VaultItem[]>;
  /** 取一份的内容；没有这一份是 null */
  read(id: string): Promise<Uint8Array | null>;
  /** 放一份进去（已有就换掉；放满了会挤掉最旧的） */
  write(id: string, meta: object, data: Uint8Array): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ConnectVaultOptions {
  /** 存档柜的地址，可以是相对的（'/api/saves'） */
  readonly url: string;
  readonly key: string;
}

const FAILURES: Record<number, VaultFailure> = { 401: 'unauthorized', 413: 'too-large' };

export function connectVault({ url, key }: ConnectVaultOptions): VaultClient {
  const base = url.replace(/\/$/, '');

  /** 发一个请求；allowMissing 时 404 不算错（返回 null） */
  async function call(
    path: string,
    init: { method: string; headers?: Record<string, string>; body?: BodyInit },
    allowMissing = false,
  ) {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${key}` },
      });
    } catch {
      throw new VaultError('unreachable');
    }
    if (response.ok) return response;
    if (response.status === 404 && allowMissing) return null;
    // 502、504 是中间的转发找不到后面的服务
    if (response.status === 502 || response.status === 504) throw new VaultError('unreachable');
    throw new VaultError(FAILURES[response.status] ?? 'failed');
  }

  return {
    async list() {
      const response = await call('', { method: 'GET' });
      const body = (await response?.json()) as { items?: unknown } | undefined;
      if (!Array.isArray(body?.items)) throw new VaultError('failed');
      return body.items as VaultItem[];
    },
    async read(id) {
      const response = await call(`/${id}`, { method: 'GET' }, true);
      return response ? new Uint8Array(await response.arrayBuffer()) : null;
    },
    async write(id, meta, data) {
      await call(`/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          [VAULT_META_HEADER]: encodeURIComponent(JSON.stringify(meta)),
        },
        body: data as Uint8Array<ArrayBuffer>,
      });
    },
    async remove(id) {
      await call(`/${id}`, { method: 'DELETE' });
    },
  };
}

const pipe = async (bytes: Uint8Array, through: GenericTransformStream) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(through),
    ).arrayBuffer(),
  );

/** 把一段文字压成 gzip 的字节 */
export const gzipText = (text: string) =>
  pipe(new TextEncoder().encode(text), new CompressionStream('gzip'));

/** 解回文字；不是 gzip 的字节会抛错 */
export const gunzipText = async (bytes: Uint8Array) =>
  new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
