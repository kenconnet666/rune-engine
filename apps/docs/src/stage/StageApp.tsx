/**
 * 文档站的最外面：整站放在一个舞台里（引擎的 stage 包）。站点本身（App.tsx，从上游复制来的）不知道这件事——
 * 它在舞台的 hud 层里，那一层是个铺满窗口、自己滚动的盒子。
 *
 * 上游的站点是整个文档在滚，原生滚动条藏起来、换成组件库的浮层滚动条（PageScrollbar，盯的是文档）。
 * 这边滚的是盒子，所以盒子用组件库的 ScrollArea：同样是原生滚动、浮层滚动条，样子和上游的一致。
 *
 * 摆法是 canvas 时接上只画界面的渲染线程，画面接上之后整站搬进画布；是 dom 时什么都不接，就是普通网页。
 * 右下角有个开关可以换（StageSwitch）。
 */
import { ScrollArea } from '@rune-engine/components';
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
  page: { position: 'absolute', inset: 0, pointerEvents: 'auto' },
});

/**
 * 整页滚动的时候真正在动的那一块：顶栏下面、左右两栏之间（它们粘在边上不跟着滚）。
 * 站点的外壳是组件库的 AppShell：顶栏是 header，正文是 main
 */
function scrollRegion() {
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const top = header?.getBoundingClientRect().bottom ?? 0;
  const side = main?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, 0);
  return { x: side.left, y: top, width: side.width, height: innerHeight - top };
}

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
        if (stageMode !== 'canvas') return;
        runUiRenderer(stage);
        if (page) stage.followScroll('hud', page, scrollRegion);
      }}
    >
      <ScrollArea
        sx={styles.page}
        // 和上游整页的滚动条一样：滚动时出现，停下后淡出
        type="scroll"
        hideDelay={800}
        // 页面本身不该是一个 Tab 停靠点（上游整页滚动时也不是）
        focusable={false}
        propsViewport={{ ref: (element) => (page = element as HTMLElement | null) }}
      >
        <App />
      </ScrollArea>
      <StageSwitch />
    </Stage>
  );
});
