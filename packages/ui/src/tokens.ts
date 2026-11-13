import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';

/** 颜色：一个底色、一个信号色、一个警示色，其余都是它们的深浅 */
export const colors = css.defineVars('rune-colors', {
  /** 面板的底：压在地图上，要透一点 */
  panel: 'rgba(12, 17, 23, 0.84)',
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
  /** 信号色上的文字 */
  onSignal: '#1a1205',
  danger: '#ef5a5f',
  calm: '#5ec4b6',
});

/** 字体：界面文字用系统界面字体；数字用窄体的等宽数字，位数变化时不抖 */
export const fonts = css.defineVars('rune-fonts', {
  text: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  numeric: 'Bahnschrift, "DIN Alternate", "Roboto Condensed", ui-monospace, monospace',
});
