/** Worker 入口用的：把对存档柜的 HTTP 请求（约定见 net 包的 vault.ts）交给钥匙对应的那个柜子 */
import { VAULT_ITEM_ID, VAULT_KEY, VAULT_META_HEADER, type VaultItem } from '@rune-engine/net';
import type { VaultObject } from './vault-object.ts';

const text = (status: number, message: string) => new Response(message, { status });

/** 柜子的名字是钥匙的 SHA-256：服务端哪里都不存钥匙本身，看得到存储的人也反推不出钥匙 */
async function vaultName(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 请求头里的说明：解出来得是个 JSON 对象；不对返回 null */
function readMeta(request: Request): string | null {
  try {
    const meta = decodeURIComponent(request.headers.get(VAULT_META_HEADER) ?? '');
    const value: unknown = JSON.parse(meta);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? meta : null;
  } catch {
    return null;
  }
}

/**
 * @param path 地址里柜子后面的那一段：'' 是整个柜子，'/<id>' 是其中一份
 * @param maxBytes 一份内容的上限：超了的在读进内存之前就拒掉（柜子自己还会再核对一次）
 */
export async function vaultRequest(
  request: Request,
  vaults: DurableObjectNamespace<VaultObject>,
  path: string,
  maxBytes = 512 * 1024,
): Promise<Response> {
  const key = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!key || !VAULT_KEY.test(key)) return text(401, 'missing or malformed key');
  const vault = vaults.get(vaults.idFromName(await vaultName(key)));

  if (path === '') {
    if (request.method !== 'GET') return text(405, 'method not allowed');
    const rows = await vault.list();
    const items: VaultItem[] = rows.map((row) => ({ ...row, meta: JSON.parse(row.meta) }));
    return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const id = path.slice(1);
  if (!path.startsWith('/') || !VAULT_ITEM_ID.test(id)) return text(400, 'bad item id');

  switch (request.method) {
    case 'GET': {
      const data = await vault.read(id);
      if (!data) return text(404, 'no such item');
      return new Response(data, {
        headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
      });
    }
    case 'PUT': {
      const meta = readMeta(request);
      if (meta === null) return text(400, 'bad meta');
      if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) {
        return text(413, 'too large');
      }
      const data = await request.arrayBuffer();
      const result = await vault.write(id, meta, data);
      return result === 'ok' ? new Response(null, { status: 204 }) : text(413, 'too large');
    }
    case 'DELETE':
      await vault.remove(id);
      return new Response(null, { status: 204 });
    default:
      return text(405, 'method not allowed');
  }
}
