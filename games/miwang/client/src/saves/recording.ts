/**
 * 存档里放的东西：一局游戏的存档就是它的对局记录（配置加上所有命令），读档是照着记录重算一遍。
 * 这里是和“放在哪”无关的部分——一份存档的说明长什么样、记录还能不能用、导出成文件和从文件读回来。
 * 放在本机的见 local.ts，放在云端的见 cloud.ts。
 *
 * 记录只有在世界数据没变时才重放得出原来那一局：地图、人口、航线、病原体档案、规则的数值换过之后，
 * 照旧的配置算出来的已经对不上现在的界面了。所以读档、导入之前都先核对一遍（matchesWorld）。
 */
import { CHAPTERS, createConfig, PATHOGENS } from '@miwang/content';
import { ATTACKER, DEFENDER, type OutbreakView } from '@miwang/sim';
import { fromWire, toWire, type PlayerId } from '@rune-engine/core';
import type { GameRecording } from '../messages.ts';

/** 一份存档的说明（列表里显示用，不含记录本身） */
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

/** 存档位（本机、云端都是）最多留这么多份：再存就把最旧的挤掉 */
export const SAVE_LIMIT = 8;

/**
 * 这份记录是不是用现在的数据打的：拿记录里的种子、日期、病原体、起源地、章节按现在的数据再生成一份配置，
 * 看和记录里存的是不是一模一样。
 */
export function matchesWorld({ config }: GameRecording): boolean {
  const pathogen = PATHOGENS.find((candidate) => candidate.id === config.pathogen?.id);
  const chapter = CHAPTERS.find((candidate) => candidate.id === config.scenario?.id);
  if (!pathogen || (config.scenario && !chapter)) return false;
  return (
    JSON.stringify(
      createConfig(config.seed, config.startDate, {
        pathogen,
        origin: config.origin,
        chapter,
        conditions: config.conditions,
      }),
    ) === JSON.stringify(config)
  );
}

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
