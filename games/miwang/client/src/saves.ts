/**
 * 存档：一局游戏的存档就是它的对局记录（配置加上所有命令），读档是照着记录重算一遍。
 *   自动存档  正在打的这一局，随时存着，关掉页面再打开可以接着打
 *   存档位    玩家自己存的几份，可以读档接着打，也可以从头回放
 *   导出导入  把记录存成一个 JSON 文件，拿到别处（或者发给别人）再导入
 *   云存档    同样的记录放到服务端，见 cloud.ts
 *
 * 记录只有在世界数据没变时才重放得出原来那一局：地图、人口、航线、病原体档案、规则的数值换过之后，
 * 照旧的配置算出来的已经对不上现在的界面了。所以读档、导入之前都先核对一遍（matchesWorld）。
 */
import { createConfig, PATHOGENS } from '@miwang/content';
import { ATTACKER, DEFENDER, type OutbreakView } from '@miwang/sim';
import { fromWire, toWire, type PlayerId } from '@rune-engine/core';
import { jsonStore } from '@rune-engine/runtime';
import type { GameRecording } from './messages.ts';

/** 存档位里的一份存档是什么样（列表里显示用，不含记录本身） */
export interface SaveMeta {
  readonly id: string;
  /** 什么时候存的（毫秒时间戳） */
  readonly savedAt: number;
  /** 存的时候是第几天、哪种病原体、扮演的哪一方 */
  readonly day: number;
  readonly pathogen: string;
  readonly player: PlayerId;
  /** 已经分出胜负的：谁赢了；还没打完是 null */
  readonly winner: PlayerId | null;
}

/** 最多留这么多份：再存就把最旧的挤掉 */
export const SAVE_LIMIT = 8;

export const autosave = jsonStore<GameRecording>('miwang:autosave', 'device');
const index = jsonStore<SaveMeta[]>('miwang:saves', 'device');
const slot = (id: string) => jsonStore<GameRecording>(`miwang:save:${id}`, 'device');

/**
 * 这份记录是不是用现在的数据打的：拿记录里的种子、日期、病原体、起源地按现在的数据再生成一份配置，
 * 看和记录里存的是不是一模一样。
 */
export function matchesWorld({ config }: GameRecording): boolean {
  const pathogen = PATHOGENS.find((candidate) => candidate.id === config.pathogen?.id);
  if (!pathogen) return false;
  return (
    JSON.stringify(
      createConfig(config.seed, config.startDate, { pathogen, origin: config.origin }),
    ) === JSON.stringify(config)
  );
}

/** 存档位里的存档，新的在前 */
export const listSaves = (): SaveMeta[] => index.load() ?? [];

/** 给现在要存的这一局写一份说明（起个新名字） */
export function describeSave(recording: GameRecording, view: OutbreakView): SaveMeta {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    savedAt: Date.now(),
    day: view.tick,
    pathogen: recording.config.pathogen.id,
    player: view.player,
    winner: view.outcome ? view.outcome.winner : null,
  };
}

/** 核对一份外面来的说明（云端取回的）：样子对就原样给，不对是 null */
export function readSaveMeta(value: unknown): SaveMeta | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, savedAt, day, pathogen, player, winner } = value as Record<string, unknown>;
  const isPlayer = (it: unknown): it is PlayerId => it === ATTACKER || it === DEFENDER;
  if (typeof id !== 'string' || typeof savedAt !== 'number' || !Number.isInteger(day)) return null;
  if (typeof pathogen !== 'string' || !isPlayer(player)) return null;
  if (winner !== null && !isPlayer(winner)) return null;
  return { id, savedAt, day: day as number, pathogen, player, winner };
}

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

/** 把记录存成一个文件让浏览器下载 */
export function exportRecording(recording: GameRecording, day: number) {
  const blob = new Blob([JSON.stringify(toWire(recording))], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `miwang-${recording.config.pathogen.id}-day${day}.json`;
  link.click();
  // 下载已经交给浏览器了，这个临时地址可以收回
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/**
 * 把导入的文件内容读成记录。文件是外面来的，不能信：样子不对、和现在的数据对不上都返回 null。
 * 记录里的命令不用在这里查——模拟执行每条命令时自己会查，不对的不生效。
 */
export function parseRecording(text: string): GameRecording | null {
  try {
    const value = fromWire(JSON.parse(text)) as Partial<GameRecording> | null;
    const looksRight =
      value != null &&
      typeof value === 'object' &&
      Number.isInteger(value.ticks) &&
      value.ticks! >= 0 &&
      Array.isArray(value.commands) &&
      value.commands.every(
        (entry) =>
          entry != null &&
          Number.isInteger(entry.tick) &&
          (entry.player === ATTACKER || entry.player === DEFENDER) &&
          typeof entry.command === 'object',
      ) &&
      typeof value.config === 'object' &&
      Array.isArray(value.config?.regions);
    if (!looksRight) return null;
    const recording = value as GameRecording;
    return matchesWorld(recording) ? recording : null;
  } catch {
    return null;
  }
}
