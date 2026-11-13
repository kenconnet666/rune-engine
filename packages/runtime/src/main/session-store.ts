/**
 * 对局记录的暂存（sessionStorage，随标签页）：开发时改了模拟的代码页面会整页刷新，
 * 刷新后拿着记录重放到刚才那一步——同一局在新规则下会走成什么样，立刻看得到。
 */
import { fromWire, toWire } from '@rune-engine/core';

export interface SessionStore<T> {
  load(): T | null;
  save(value: T): void;
  clear(): void;
}

export function sessionStore<T>(key: string): SessionStore<T> {
  return {
    load() {
      try {
        const text = sessionStorage.getItem(key);
        return text ? (fromWire(JSON.parse(text)) as T) : null;
      } catch {
        // 存的东西读不出来（格式变了、隐私模式）：当作没有
        return null;
      }
    },
    save(value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(toWire(value)));
      } catch {
        // 存不下（超出配额、隐私模式）不影响游戏，只是刷新后不能接着玩
      }
    },
    clear() {
      sessionStorage.removeItem(key);
    },
  };
}
