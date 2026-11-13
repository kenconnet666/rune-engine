/**
 * 多语言。文案不是“键 → 字符串”的表，而是每种语言一个同样形状的对象：
 * 固定的话是字符串，带变量的话是函数（`day: (n) => \`第 ${n} 天\``）。
 * 这样用错键、漏翻译、参数不对都是类型错误，也不需要运行时的占位符解析。
 *
 *   const i18n = createI18n({
 *     catalogs: { zh, en },            // en 的类型要和 zh 一样
 *     tags: { zh: 'zh-CN', en: 'en' },
 *     fallback: 'zh',
 *     storageKey: 'miwang:locale',
 *   });
 *   i18n.messages.value.status.day(12)   // 在组件的渲染函数里读，切换语言时自己重画
 *   i18n.formats.value.compact(1.4e9)
 *   i18n.locale.value = 'en'
 */
import { computed, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue';
import { formatsFor, type Formats } from './formats.ts';

export interface I18nOptions<Locale extends string, Messages> {
  /** 各语言的文案，形状要一样 */
  readonly catalogs: Readonly<Record<Locale, Messages>>;
  /** 各语言的 BCP 47 标签，数字和日期的写法按它来 */
  readonly tags: Readonly<Record<Locale, string>>;
  /** 没有记住的选择、浏览器的语言也对不上时用它 */
  readonly fallback: NoInfer<Locale>;
  /** 给了它就把选的语言记在 localStorage 的这个键下 */
  readonly storageKey?: string;
}

export interface I18n<Locale extends string, Messages> {
  /** 现在的语言；赋值就切换 */
  readonly locale: ShallowRef<Locale>;
  readonly locales: readonly Locale[];
  readonly messages: ComputedRef<Messages>;
  readonly formats: ComputedRef<Formats>;
}

/** 没有 localStorage 的地方（Worker、Node、隐私模式下被禁用）当它不存在 */
function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createI18n<Locale extends string, Messages>(
  options: I18nOptions<Locale, Messages>,
): I18n<Locale, Messages> {
  const { catalogs, tags, fallback, storageKey } = options;
  const locales = Object.keys(catalogs) as Locale[];
  const known = (value: string | null | undefined): value is Locale =>
    value != null && locales.includes(value as Locale);

  /** 开始时用哪种语言：记住的选择 → 浏览器的语言（按标签的前缀对）→ 默认 */
  const initial = (): Locale => {
    const saved = storageKey ? storage()?.getItem(storageKey) : null;
    if (known(saved)) return saved;
    for (const preferred of globalThis.navigator?.languages ?? []) {
      const match = locales.find(
        (locale) =>
          preferred.toLowerCase().split('-')[0] === tags[locale].toLowerCase().split('-')[0],
      );
      if (match) return match;
    }
    return fallback;
  };

  const locale = shallowRef(initial()) as ShallowRef<Locale>;
  if (storageKey) {
    watch(locale, (next) => storage()?.setItem(storageKey, next), { flush: 'sync' });
  }
  return {
    locale,
    locales,
    messages: computed(() => catalogs[locale.value] ?? catalogs[fallback]),
    formats: computed(() => formatsFor(tags[locale.value] ?? tags[fallback])),
  };
}
