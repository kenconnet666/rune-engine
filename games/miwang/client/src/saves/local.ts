/**
 * 放在本机的存档（浏览器的 localStorage）：
 *   自动存档  正在打的这一局，随时存着，关掉页面再打开可以接着打
 *   存档位    玩家自己存的几份，可以读档接着打，也可以从头回放
 */
import type { OutbreakView } from '@miwang/sim';
import { jsonStore } from '@rune-engine/runtime';
import type { GameRecording } from '../messages.ts';
import { describeSave, matchesWorld, SAVE_LIMIT, type SaveMeta } from './recording.ts';

export const autosave = jsonStore<GameRecording>('miwang:autosave', 'device');
const index = jsonStore<SaveMeta[]>('miwang:saves', 'device');
const slot = (id: string) => jsonStore<GameRecording>(`miwang:save:${id}`, 'device');

/** 存档位里的存档，新的在前 */
export const listSaves = (): SaveMeta[] => index.load() ?? [];

/** 把一局存进存档位；存不进去（浏览器的配额满了）返回 false */
export function writeSave(recording: GameRecording, view: OutbreakView): boolean {
  const meta = describeSave(recording, view);
  if (!slot(meta.id).save(recording)) return false;
  const all = [meta, ...listSaves()];
  for (const dropped of all.splice(SAVE_LIMIT)) slot(dropped.id).clear();
  return index.save(all);
}

/** 读一份存档；没有了、或者和现在的数据对不上，返回 null */
export function readSave(id: string): GameRecording | null {
  const recording = slot(id).load();
  return recording && matchesWorld(recording) ? recording : null;
}

export function deleteSave(id: string) {
  slot(id).clear();
  index.save(listSaves().filter((meta) => meta.id !== id));
}
