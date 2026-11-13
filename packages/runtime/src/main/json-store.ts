/**
 * 把一个值存在浏览器里的小工具：按键存取，值过线程边界的那套编码（Decimal、日期也能存）。
 * 两个去处：
 *   'tab'     跟着标签页（sessionStorage）：关掉标签页就没了，适合“刷新之后接着刚才的”
 *   'device'  留在这台设备上（localStorage）：存档、设置
 * 存不进去（超出配额、隐私模式）、读不出来（格式变了）都不抛错：存档丢了不该让游戏起不来。
 */
import { fromWire, toWire } from '@rune-engine/core';

export interface JsonStore<T> {
  load(): T | null;
  /** 存进去了返回 true；没存进去（配额满了之类）返回 false */
  save(value: T): boolean;
  clear(): void;
}

function storageOf(where: 'tab' | 'device'): Storage | undefined {
  try {
    return where === 'tab' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function jsonStore<T>(key: string, where: 'tab' | 'device' = 'tab'): JsonStore<T> {
  return {
    load() {
      try {
        const text = storageOf(where)?.getItem(key);
        return text ? (fromWire(JSON.parse(text)) as T) : null;
      } catch {
        return null;
      }
    },
    save(value) {
      try {
        const storage = storageOf(where);
        storage?.setItem(key, JSON.stringify(toWire(value)));
        return storage !== undefined;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storageOf(where)?.removeItem(key);
      } catch {
        // 没有存储可用：本来就没有东西可清
      }
    },
  };
}
