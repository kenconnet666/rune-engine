/**
 * 一个存档柜（Durable Object，每把钥匙一个）：约定见 net 包的 vault.ts。
 * 东西存在对象自带的 SQLite 里（免费额度里的那一种），一份一行。
 * Worker 入口经 RPC 调下面这几个方法（见 vault-request.ts）；每碰一次柜子，“多久没人碰就清掉”的钟重新走。
 */
import { DurableObject } from 'cloudflare:workers';

/** 柜子里的一行（不含内容）。说明是 JSON 文本，原样存、原样给，由入口那头解开 */
export interface VaultRow {
  id: string;
  meta: string;
  size: number;
  savedAt: number;
}

/** 这么久没人碰就整个清掉：没有账号，丢了钥匙的柜子没人能再打开，不能永远占着地方 */
const KEEP_MS = 180 * 24 * 3600_000;

export class VaultObject extends DurableObject {
  /** 最多放几份；再放就挤掉最旧的。游戏的服务入口按自己的需要改 */
  protected readonly maxItems: number = 8;
  /** 一份内容最多多少字节 */
  protected readonly maxBytes: number = 512 * 1024;
  /** 一份的说明最多多少字符 */
  protected readonly maxMetaLength: number = 2048;

  private get sql() {
    return this.ctx.storage.sql;
  }

  /** 用之前确保表在：柜子被清掉（alarm）之后这个对象可能还活着 */
  private async open() {
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY, meta TEXT NOT NULL, data BLOB NOT NULL, saved_at INTEGER NOT NULL
      )`,
    );
    await this.ctx.storage.setAlarm(Date.now() + KEEP_MS);
  }

  async list(): Promise<VaultRow[]> {
    await this.open();
    return this.sql
      .exec<VaultRow & Record<string, SqlStorageValue>>(
        'SELECT id, meta, length(data) AS size, saved_at AS savedAt FROM items ORDER BY saved_at DESC',
      )
      .toArray();
  }

  /** 取一份的内容；没有这一份返回 null */
  async read(id: string): Promise<ArrayBuffer | null> {
    await this.open();
    const rows = this.sql
      .exec<{ data: ArrayBuffer }>('SELECT data FROM items WHERE id = ?', id)
      .toArray();
    return rows[0]?.data ?? null;
  }

  /** 放一份进去（已有就换掉）。meta 是 JSON 文本，调用方已经核对过它是个对象 */
  async write(id: string, meta: string, data: ArrayBuffer): Promise<'ok' | 'too-large'> {
    if (data.byteLength > this.maxBytes || meta.length > this.maxMetaLength) return 'too-large';
    await this.open();
    this.sql.exec(
      'INSERT OR REPLACE INTO items (id, meta, data, saved_at) VALUES (?, ?, ?, ?)',
      id,
      meta,
      data,
      Date.now(),
    );
    // 放满了：只留最新的几份
    this.sql.exec(
      'DELETE FROM items WHERE id NOT IN (SELECT id FROM items ORDER BY saved_at DESC LIMIT ?)',
      this.maxItems,
    );
    return 'ok';
  }

  async remove(id: string): Promise<void> {
    await this.open();
    this.sql.exec('DELETE FROM items WHERE id = ?', id);
  }

  override async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
