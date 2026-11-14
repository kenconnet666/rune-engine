/**
 * 文档站的最外面：整站放在一个舞台里（引擎的 stage 包）。站点本身（App.tsx，从上游复制来的）在舞台的 hud 层里；
 * 它的外壳换成了舞台版（StageShell）：顶栏、侧栏各占一层，正文由引擎滚动。
 *
 * 摆法是 canvas 时接上只画界面的渲染线程，画面接上之后整站搬进画布；是 dom 时什么都不接，就是普通网页。
 * 两种摆法元素结构一样、滚动也是同一套做法。右下角有个开关可以换（StageSwitch）。
 */
import { Stage } from '@rune-engine/stage';
import { runUiRenderer } from '@rune-engine/stage/ui-renderer';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { App } from '../App';
import { reportRenderStats } from './frame-rate';
import { stageMode } from './mode';
import { StageSwitch } from './StageSwitch';

const styles = css.create({
  stage: { position: 'fixed', inset: 0 },
});

export const StageApp = _component(() => () => (
  <Stage
    sx={styles.stage}
    // 整页都是界面，没有别的画面要让：重拍只跟着渲染线程的节奏走
    pixelBudget={2000}
    onReady={(stage) => {
      if (stageMode === 'canvas') runUiRenderer(stage, { onStats: reportRenderStats });
    }}
  >
    <App />
    <StageSwitch />
  </Stage>
));
