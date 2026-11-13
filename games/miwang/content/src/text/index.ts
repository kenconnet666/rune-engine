/** 内容的文案，每种语言一份；界面用的文案在客户端那边 */
import { en } from './en.ts';
import type { ContentText } from './types.ts';
import { zh } from './zh.ts';

/** 游戏支持的语言：默认中文，也支持英文 */
export type Locale = 'zh' | 'en';

export const CONTENT_TEXT: Readonly<Record<Locale, ContentText>> = { zh, en };

export type { ContentText, Label } from './types.ts';
