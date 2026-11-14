/**
 * 文档站的最外面：整站放在一个舞台里（引擎的 stage 包）。站点本身（App.tsx，从上游复制来的）不知道这件事——
 * 它在舞台的 hud 层里，那一层是个铺满窗口、自己滚动的盒子。
 *
 * 摆法是 canvas 时接上只画界面的渲染线程，画面接上之后整站搬进画布；是 dom 时什么都不接，就是普通网页。
 * 右下角有个开关可以换（StageSwitch）。
 */
import { Stage } from '@rune-engine/stage';
import { runUiRenderer } from '@rune-engine/stage/ui-renderer';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { App } from '../App';
import { stageMode } from './mode';
import { StageSwitch } from './StageSwitch';

const styles = css.create({
  stage: { position: 'fixed', inset: 0 },
  // 站点原来是整个文档在滚；现在滚的是这个盒子（舞台的层自己不接收指针，这里打开）
  page: { position: 'absolute', inset: 0, overflow: 'auto', pointerEvents: 'auto' },
});

export const StageApp = _component(() => {
  const router = useRouter();
  let page = _state.raw<HTMLElement | null>(null);

  // 路由自带的“换页回到顶部、带锚点滚到那一节”滚的是窗口；站点现在在盒子里滚，这里照着做一遍
  router.afterEach((to, from) => {
    if (to.path === from.path && to.hash === from.hash) return;
    void nextTick(() => {
      const target = to.hash && document.getElementById(decodeURIComponent(to.hash.slice(1)));
      if (target) target.scrollIntoView();
      else if (to.path !== from.path) page?.scrollTo({ top: 0 });
    });
  });

  return () => (
    <Stage
      sx={styles.stage}
      onReady={(stage) => {
        if (stageMode === 'canvas') runUiRenderer(stage);
      }}
    >
      <div ref={_toRef(page)} {...css.attrs(styles.page)}>
        <App />
      </div>
      <StageSwitch />
    </Stage>
  );
});
