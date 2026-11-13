/**
 * 这个游戏的多语言：界面的文案（text/）加内容的文案（content 包里），中文为默认、英文可切换。
 * 在组件的渲染函数里调下面这几个函数取当前语言的东西——切换语言时用到它们的组件自己重画。
 */
import { CONTENT_TEXT, regionName, type Locale } from '@miwang/content';
import { createI18n } from '@rune-engine/i18n';
import { en } from './text/en.ts';
import { zh } from './text/zh.ts';

export const i18n = createI18n({
  catalogs: {
    zh: { ui: zh, content: CONTENT_TEXT.zh },
    en: { ui: en, content: CONTENT_TEXT.en },
  },
  tags: { zh: 'zh-CN', en: 'en' },
  fallback: 'zh',
  storageKey: 'miwang:locale',
});

/** 各语言在切换按钮上怎么写（用它自己的文字写，不跟着当前语言变） */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { zh: '中文', en: 'EN' };

/** 界面的文案 */
export const useUi = () => i18n.messages.value.ui;
/** 内容的文案：性状、科技、措施、事件的名字和说明 */
export const useContent = () => i18n.messages.value.content;
/** 数字、日期的写法 */
export const useFormats = () => i18n.formats.value;
/** 地区的名字 */
export const placeName = (region: number) => regionName(region, i18n.locale.value);
