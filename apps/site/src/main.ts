/**
 * 文档站的入口：整个页面就是一张画布。起一条渲染线程把画布交给它，界面的树挂在宿主上。
 */
import { createViewHost } from '@rune-engine/view';
import { runViewRenderer } from '@rune-engine/view/renderer';
import { App } from './App';
import { renderRate } from './rates';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = runViewRenderer(canvas, { onStats: (stats) => (renderRate.value = stats) });
const host = createViewHost(canvas, { send: renderer.send });
host.mount(App);

declare global {
  interface Window {
    /** 给核对用的脚本看的：界面的树 */
    __site?: typeof host;
  }
}
window.__site = host;
