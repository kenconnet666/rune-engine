/**
 * 几个组件共用的样式片段，做法参考 vue-tsx-pro 的组件库（它的 utils/style 与 ScrollArea、ripple）：
 *   focusRing   键盘聚焦时的一圈描边（鼠标点击不出现）
 *   scroll      可滚动的区域：细的、半透明的滚动条，没有箭头，不抢内容的戏
 *   pressable   可以按的东西共有的手感：过渡、按下时轻微下沉、禁用的样子
 *   dialogEnter 对话框的进出场
 * 用法是把它们放进 sx 的数组里：`sx: [focusRing.visible, pressable.root, styles.root]`
 */
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { colors, durations } from './tokens.ts';

export const focusRing = css.create({
  /** 描边在元素外面留一点空隙 */
  visible: {
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: '2px',
    outlineColor: colors.focus,
    outlineOffset: '2px',
  },
  /** 描边压在元素的边上（排得很密、外面没有空隙的地方用） */
  inset: {
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: '2px',
    outlineColor: colors.focus,
    outlineOffset: '-2px',
  },
});

export const scroll = css.create({
  /**
   * 滚动条的样子：一根细的、半透明的圆头滑块，没有轨道、没有两头的箭头；指针移上去时滑块变实一点。
   * 用 ::-webkit-scrollbar 这组伪元素写（标准的 scrollbar-width / scrollbar-color 去不掉 Windows 上的箭头，
   * 而且一旦写了标准属性，这组伪元素就不生效了）。和 y、x、both 之一合用。
   */
  bar: {
    // 内容滚到头不带着外面的页面一起动
    overscrollBehavior: 'contain',
    '::-webkit-scrollbar': { width: '0.625rem', height: '0.625rem' },
    '::-webkit-scrollbar-button': { display: 'none' },
    '::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-thumb': {
      // 透明的边把滑块收细：能抓的范围是整条滚动条，看上去只有中间一根
      borderWidth: '0.1875rem',
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderRadius: '1rem',
      backgroundClip: 'content-box',
      backgroundColor: {
        default: `color-mix(in srgb, ${colors.textMuted} 45%, transparent)`,
        ':hover': `color-mix(in srgb, ${colors.textMuted} 75%, transparent)`,
      },
    },
  },
  y: { overflowX: 'hidden', overflowY: 'auto' },
  x: { overflowX: 'auto', overflowY: 'hidden' },
  both: { overflow: 'auto' },
});

export const pressable = css.create({
  root: {
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    opacity: { default: 1, ':disabled': 0.5 },
    // 按下时轻微下沉：给手指一个“按到了”的回应
    transform: { default: 'none', ':active:not(:disabled)': 'translateY(1px)' },
    transition: `background-color ${durations.fast}, border-color ${durations.fast}, color ${durations.fast}, transform ${durations.fast}, opacity ${durations.fast}`,
    userSelect: 'none',
  },
});

export const dialogEnter = css.create({
  /** 淡入并从略小放大到原尺寸；关的时候更快地淡出（离场过渡靠 overlay，只有 Chromium 有） */
  panel: {
    opacity: { default: 0, ':modal': { default: 1, '@starting-style': 0 } },
    transform: {
      default: 'scale(0.97)',
      ':modal': { default: 'none', '@starting-style': 'scale(0.97)' },
    },
    transition: {
      default: `opacity ${durations.fast}, transform ${durations.fast}, display ${durations.fast} allow-discrete, overlay ${durations.fast} allow-discrete`,
      ':modal': `opacity ${durations.normal}, transform ${durations.normal}, display ${durations.normal} allow-discrete, overlay ${durations.normal} allow-discrete`,
    },
  },
});
