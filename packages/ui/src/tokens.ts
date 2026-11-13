import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';

/** 颜色：一个底色、一个信号色、一个警示色，其余都是它们的深浅 */
export const colors = css.defineVars('rune-colors', {
  /** 面板的底：压在地图上，要透一点 */
  panel: 'rgba(12, 17, 23, 0.84)',
  /** 浮在最上面的小块（提示）：几乎不透 */
  raised: 'rgba(8, 12, 17, 0.94)',
  /** 面板里的凹陷区域、按钮的底 */
  inset: 'rgba(150, 180, 205, 0.08)',
  insetHover: 'rgba(150, 180, 205, 0.16)',
  /** 细线：面板的边、分隔 */
  line: 'rgba(160, 190, 215, 0.24)',
  lineStrong: 'rgba(160, 190, 215, 0.5)',
  text: '#e6edf3',
  textMuted: '#8a9aab',
  /** 信号色：当前选中、最重要的那个数字 */
  signal: '#f2a33a',
  /** 信号色的淡底：已经生效的图块 */
  signalFaint: 'rgba(242, 163, 58, 0.12)',
  /** 键盘聚焦时的那圈描边 */
  focus: '#ffd08a',
  /** 信号色上的文字 */
  onSignal: '#1a1205',
  danger: '#ef5a5f',
  calm: '#5ec4b6',
});

/**
 * 色觉友好的那一套颜色：放在一个元素上，它里面的组件都换成这套。
 * 警示色从红换成朱红、平稳色从青绿换成天蓝——和信号色（橙黄）三者之间，分不清红绿的人也能靠
 * “偏黄还是偏蓝、亮还是暗”分开（取自 Okabe–Ito 那组色）。界面上凡是用颜色表意的地方同时都有图标或文字，颜色不是唯一的线索。
 *
 *   <div {...css.attrs(safe && colorSafeTheme)}>…</div>
 */
export const colorSafeTheme = css.createTheme(colors, {
  signal: '#f2b134',
  signalFaint: 'rgba(242, 177, 52, 0.12)',
  focus: '#ffe08a',
  danger: '#d55e00',
  calm: '#56b4e9',
});

/** 字体：界面文字用系统界面字体；数字用窄体的等宽数字，位数变化时不抖 */
export const fonts = css.defineVars('rune-fonts', {
  text: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  numeric: 'Bahnschrift, "DIN Alternate", "Roboto Condensed", ui-monospace, monospace',
});

/** 间距：面板之间、面板里的元素之间 */
export const space = css.defineVars('rune-space', {
  xs: '0.25rem',
  sm: '0.4rem',
  md: '0.75rem',
  lg: '1.25rem',
});

const reduce = '@media (prefers-reduced-motion: reduce)';

/** 动效时长；系统开了“减少动态效果”时都是 0，组件直接用，不必各自判断 */
export const durations = css.defineVars('rune-durations', {
  /** 悬停、按下的颜色变化 */
  fast: { default: '120ms', [reduce]: '0ms' },
  /** 面板出现、数值条的伸缩 */
  normal: { default: '220ms', [reduce]: '0ms' },
  /** 波纹的扩散 */
  slow: { default: '420ms', [reduce]: '0ms' },
});
