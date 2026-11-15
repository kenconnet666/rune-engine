/**
 * 主题：一套颜色和几个尺寸。组件画的时候读“现在的主题”，换主题（setTheme）界面跟着换。
 *
 * 组件的样式是按主题算好、记住的（themed）：同一个主题下每次渲染拿到的是同一批样式对象——
 * 节点认“样式没变”靠的是“是不是同一个对象”，每次都新建的话每次渲染都要比一遍、重排一遍。
 */
import type { ViewStyle } from '@rune-engine/view';
import { shallowRef } from 'vue';

export interface Theme {
  readonly name: string;
  readonly colors: {
    /** 页面的底色、面板的底色、面板上再浮起来一层的底色 */
    readonly page: string;
    readonly surface: string;
    readonly raised: string;
    /** 指着、按着时垫的一层 */
    readonly hover: string;
    readonly active: string;
    readonly border: string;
    /** 正文、次要的字、更淡的字 */
    readonly text: string;
    readonly muted: string;
    readonly faint: string;
    /** 强调色：底、指着时的底、它上面的字、当字的颜色用、淡淡的一层底 */
    readonly accent: string;
    readonly accentHover: string;
    readonly accentContrast: string;
    readonly accentText: string;
    readonly accentSoft: string;
    readonly danger: string;
    readonly dangerSoft: string;
    readonly success: string;
    readonly successSoft: string;
    readonly warning: string;
    readonly warningSoft: string;
    /** 代码块的底色 */
    readonly code: string;
  };
}

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    page: '#111214',
    surface: '#18191c',
    raised: '#1f2126',
    hover: '#25272e',
    active: '#2d3039',
    border: '#2b2d34',
    text: '#ececee',
    muted: '#a0a3ad',
    faint: '#6f727c',
    accent: '#3e63dd',
    accentHover: '#5472e4',
    accentContrast: '#ffffff',
    accentText: '#9eb1ff',
    accentSoft: '#1d2a5c',
    danger: '#e5484d',
    dangerSoft: '#3b1219',
    success: '#46a758',
    successSoft: '#12301f',
    warning: '#f5a524',
    warningSoft: '#3a2a10',
    code: '#16171a',
  },
};

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    page: '#ffffff',
    surface: '#f9f9fb',
    raised: '#ffffff',
    hover: '#eeeef2',
    active: '#e3e4e9',
    border: '#dcdde3',
    text: '#1c2024',
    muted: '#60646c',
    faint: '#8b8d98',
    accent: '#3e63dd',
    accentHover: '#3358d4',
    accentContrast: '#ffffff',
    accentText: '#3a5bc7',
    accentSoft: '#e1e9ff',
    danger: '#ce2c31',
    dangerSoft: '#feebec',
    success: '#2a7e3b',
    successSoft: '#e6f6eb',
    warning: '#ab6400',
    warningSoft: '#fff7c2',
    code: '#f4f4f7',
  },
};

/** 现在的主题（渲染时读它，换了会重新渲染） */
export const theme = shallowRef<Theme>(darkTheme);

export function setTheme(next: Theme): void {
  theme.value = next;
}

/** 等宽字体：代码用 */
export const MONO = 'Consolas, "Cascadia Mono", ui-monospace, monospace';

/**
 * 一批跟着主题走的样式：make 按主题算出来，同一个主题只算一次。
 *
 *   const styles = themed(({ colors }) => ({ root: { backgroundColor: colors.surface } }));
 *   …渲染时：styles().root
 */
export function themed<T extends Record<string, ViewStyle>>(make: (theme: Theme) => T): () => T {
  const made = new WeakMap<Theme, T>();
  return () => {
    const current = theme.value;
    let styles = made.get(current);
    if (!styles) made.set(current, (styles = make(current)));
    return styles;
  };
}
