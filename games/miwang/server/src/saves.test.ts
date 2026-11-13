/**
 * 云存档的测试：和房间的测试一样，把这个 Worker 在本机真的起起来，用浏览器那套客户端去存取。
 */
import { fileURLToPath } from 'node:url';
import { connectVault, gunzipText, gzipText, VaultError } from '@rune-engine/transport';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';

const server = createTestHarness({
  workers: [{ configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)) }],
});
let url = '';

beforeAll(async () => {
  const listening = await server.listen();
  url = `${listening.url.origin}/api/saves`;
}, 60_000);
afterAll(() => server.close());

/** 每个测试用自己的钥匙，互不相干 */
const vault = (name: string) => connectVault({ url, key: name.padEnd(24, '0') });
const bytes = (...values: number[]) => new Uint8Array(values);

describe('云存档', () => {
  it('放进去、列出来、取回来、拿掉；说明和内容都原样', async () => {
    const mine = vault('roundtrip');
    expect(await mine.list()).toEqual([]);

    const meta = { day: 42, pathogen: '流感型', winner: null };
    await mine.write('save1', meta, await gzipText('{"记录":"内容"}'));
    const items = await mine.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'save1', meta });
    expect(items[0]?.size).toBeGreaterThan(0);
    expect(Math.abs((items[0]?.savedAt ?? 0) - Date.now())).toBeLessThan(60_000);

    const data = await mine.read('save1');
    expect(data && (await gunzipText(data))).toBe('{"记录":"内容"}');
    expect(await mine.read('nothing')).toBeNull();

    // 同名再放一次是换掉，不是多一份
    await mine.write('save1', { day: 43 }, bytes(1, 2, 3));
    expect((await mine.list()).map((item) => item.meta)).toEqual([{ day: 43 }]);
    expect(await mine.read('save1')).toEqual(bytes(1, 2, 3));

    await mine.remove('save1');
    expect(await mine.list()).toEqual([]);
  });

  it('一把钥匙一个柜子：换一把钥匙看不到别人的东西', async () => {
    await vault('alice').write('save1', { who: 'alice' }, bytes(1));
    expect(await vault('bob').list()).toEqual([]);
    expect(await vault('bob').read('save1')).toBeNull();
    expect((await vault('alice').list()).map((item) => item.meta)).toEqual([{ who: 'alice' }]);
  });

  it('放满了挤掉最旧的：最多留八份', async () => {
    const mine = vault('crowded');
    for (let n = 0; n < 10; n++) await mine.write(`save${n}`, { n }, bytes(n));
    const kept = (await mine.list()).map((item) => item.id);
    expect(kept).toHaveLength(8);
    expect(kept).not.toContain('save0');
    expect(kept).not.toContain('save1');
    expect(kept).toContain('save9');
  });

  it('不合约定的请求进不来：没有钥匙、钥匙太短、东西太大、名字和说明写错', async () => {
    expect((await server.fetch('/api/saves')).status).toBe(401);
    await expect(connectVault({ url, key: 'short' }).list()).rejects.toMatchObject({
      reason: 'unauthorized',
    });

    const mine = vault('strict');
    const tooLarge = mine.write('huge', {}, new Uint8Array(600 * 1024));
    await expect(tooLarge).rejects.toBeInstanceOf(VaultError);
    await expect(tooLarge).rejects.toMatchObject({ reason: 'too-large' });
    expect(await mine.list()).toEqual([]);

    const authorized = { Authorization: `Bearer ${'strict'.padEnd(24, '0')}` };
    const badId = await server.fetch('/api/saves/Bad_Name', { headers: authorized });
    expect(badId.status).toBe(400);
    const badMeta = await server.fetch('/api/saves/save1', {
      method: 'PUT',
      headers: { ...authorized, 'X-Vault-Meta': 'not json' },
      body: 'x',
    });
    expect(badMeta.status).toBe(400);
    expect(
      (await server.fetch('/api/saves', { method: 'DELETE', headers: authorized })).status,
    ).toBe(405);
  });
});
