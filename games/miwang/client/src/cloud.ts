/**
 * 云存档：把存档（对局记录）放到服务端的存档柜里，换一台设备也能接着打。
 * 不用账号——这台设备生成一个“同步码”（存档柜的钥匙），存在本机；在另一台设备上填同一个码，看到的就是同一个柜子。
 * 记录是一大段 JSON，压过（gzip）再传。取回来的东西和导入的文件一样对待：先核对，再用。
 * 柜子的约定和客户端在 net、transport 包里；这里只是把“存档”装进去、取出来。
 */
import type { OutbreakView } from '@miwang/sim';
import { toWire } from '@rune-engine/core';
import { VAULT_KEY, vaultKey } from '@rune-engine/net';
import { jsonStore } from '@rune-engine/runtime';
import { connectVault, gunzipText, gzipText, VaultError } from '@rune-engine/transport';
import type { GameRecording } from './messages.ts';
import { describeSave, parseRecording, readSaveMeta, type SaveMeta } from './saves.ts';
import { API_URL, secureRandom } from './service.ts';

/** 有没有云存档服务 */
export const CLOUD = API_URL !== undefined;

const keyStore = jsonStore<string>('miwang:cloud-key', 'device');

/** 这台设备上的同步码；没开云存档是 null */
export function cloudKey(): string | null {
  const key = keyStore.load();
  return typeof key === 'string' && VAULT_KEY.test(key) ? key : null;
}

/** 开启云存档：生成一个新的同步码 */
export function enableCloud(): string {
  const key = vaultKey(secureRandom);
  keyStore.save(key);
  return key;
}

/** 改用另一台设备上的同步码；写得不对返回 false（抄的时候带进来的空格、连字符、大写不算错） */
export function adoptCloudKey(text: string): boolean {
  const key = text.replace(/[\s-]/g, '').toLowerCase();
  if (!VAULT_KEY.test(key)) return false;
  keyStore.save(key);
  return true;
}

/** 这台设备不再用云存档（云端的存档还在，凭同步码还能找回来） */
export const forgetCloudKey = () => keyStore.clear();

function vault() {
  const key = cloudKey();
  if (!API_URL || !key) throw new VaultError('unauthorized');
  return connectVault({ url: `${API_URL}/saves`, key });
}

/** 云端的存档，新的在前。说明是自己放进去的，但毕竟是外面回来的东西：样子不对的略过 */
export async function listCloudSaves(): Promise<SaveMeta[]> {
  const items = await vault().list();
  return items.flatMap((item) => {
    const meta = readSaveMeta({ ...(item.meta as object), id: item.id, savedAt: item.savedAt });
    return meta ? [meta] : [];
  });
}

export async function uploadCloudSave(recording: GameRecording, view: OutbreakView) {
  const meta = describeSave(recording, view);
  await vault().write(meta.id, meta, await gzipText(JSON.stringify(toWire(recording))));
}

/** 取回一份；没有了、解不开、或者和现在的数据对不上，返回 null */
export async function downloadCloudSave(id: string): Promise<GameRecording | null> {
  const bytes = await vault().read(id);
  if (!bytes) return null;
  try {
    return parseRecording(await gunzipText(bytes));
  } catch {
    return null;
  }
}

export const deleteCloudSave = (id: string) => vault().remove(id);
