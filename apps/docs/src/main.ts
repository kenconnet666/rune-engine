/**
 * 文档站的入口。和上游的入口差在两处（所以这个文件是这边自己的，同步时不换）：
 * 最外面的组件是舞台（StageApp），站点在它里面；这边没有预渲染，不用接管已有的 HTML。
 */
import { useRouteLoadingBar } from '@rune-engine/components/vue-router';
import { createApp } from 'vue';
import { App } from './App';
import { createDocsRouter, isFrame, prefetchOnIntent } from './router';
import { loadSiteFonts } from './site/fonts';
import { loadingBar } from './site/loading-bar';
import { siteThemeReady } from './site/theme';
import { createDocsUi } from './site/ui';
import { StageApp } from './stage/StageApp';

const router = createDocsRouter();
// 只在生产环境预取：开发时取一页要现编译、现提取 API（没缓存时 Worker 要建十几秒的程序），
// 指针划过侧栏就会触发好几页，挂起的请求占满浏览器到开发服务器的连接，真正点开的页面反而被堵住
if (import.meta.env.PROD) prefetchOnIntent(router);
// 换页要加载页面的代码块：慢的时候顶部有加载条
useRouteLoadingBar(router, loadingBar);

const root = document.getElementById('app')!;
// 整页示例（示例卡片里的 iframe）是另一个文档，只有那一个示例：不给它单独起一个舞台和渲染线程
const app = createApp(isFrame ? App : StageApp)
  .use(router)
  .use(createDocsUi(router));

// 加载失败也照常挂载（用没定制的主题），错误照样报出来；等路由解析完，页面的组件到位
void Promise.all([siteThemeReady(), router.isReady()]).finally(() => {
  app.mount(root);
  // 字体（@font-face，按字切成小片）不挡首屏：挂载后再加载，到之前文字用系统字体
  loadSiteFonts();
});
