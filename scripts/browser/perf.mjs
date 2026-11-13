/**
 * 性能核对：在无界面的 Chrome 里开一局，让它用 10 倍速跑一阵，量主线程卡不卡、渲染线程每帧花多久。
 * 先把开发服务器起起来（pnpm dev），再跑：
 *   node scripts/browser/perf.mjs [地址=http://localhost:5180] [截图存到哪]
 */
import { launchChrome } from './chrome.mjs';

const [url = 'http://localhost:5180', shot] = process.argv.slice(2);
const chrome = await launchChrome({ scale: 2 });
try {
  // 界面语言默认跟着浏览器走：这里固定成中文，下面按中文的字找按钮
  const page = await chrome.open(url, { init: `localStorage.setItem('miwang:locale', 'zh')` });
  await page.waitFor(`document.body.innerText.includes('新开一局')`, { what: '主菜单' });
  await page.clickButton('新开一局');
  await page.waitFor(
    `[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '开始')`,
    {
      what: '开局设置',
    },
  );
  await page.clickButton('开始');
  await page.waitFor(`/第 [0-9]+ 天/.test(document.body.innerText)`, { what: '对局开始' });

  /**
   * 量几秒。帧率在无界面模式下跟着机器当时的负载走，只能当参考；真正看的是两样：
   *   主线程被卡住多久——每 10 毫秒叫醒一次，看实际晚了多少；再数“长帧”（浏览器自己报的，超过 50 毫秒的帧）
   *   渲染线程每帧在自己这头花了多久
   */
  const measure = (label) =>
    page
      .evaluate(
        `(async () => {
        const reports = [];
        const info = console.info;
        console.info = (...args) => reports.push(args[1]);
        const longFrames = [];
        const observer = new PerformanceObserver((list) => longFrames.push(...list.getEntries()));
        observer.observe({ type: 'long-animation-frame' });
        let frames = 0;
        const lags = [];
        const started = performance.now();
        let expected = started + 10;
        const timer = setInterval(() => {
          lags.push(Math.max(0, performance.now() - expected));
          expected = performance.now() + 10;
        }, 10);
        await new Promise((resolve) => {
          const tick = () => {
            frames++;
            performance.now() - started < 4000 ? requestAnimationFrame(tick) : resolve();
          };
          requestAnimationFrame(tick);
          setTimeout(resolve, 6000);
        });
        clearInterval(timer);
        observer.disconnect();
        const seconds = (performance.now() - started) / 1000;
        globalThis.__miwang.stats();
        await new Promise((resolve) => setTimeout(resolve, 200));
        console.info = info;
        lags.sort((a, b) => a - b);
        return {
          fps: frames / seconds,
          lagP95: lags[Math.floor(lags.length * 0.95)] ?? 0,
          lagMax: lags.at(-1) ?? 0,
          longFrames: longFrames.length,
          longest: Math.max(0, ...longFrames.map((frame) => frame.duration)),
          render: reports[0] ?? null,
          day: document.body.innerText.match(/第 ([0-9]+) 天/)?.[1],
          heapMB: performance.memory.usedJSHeapSize / 1048576,
        };
      })()`,
      )
      .then((result) => {
        const render = result.render;
        console.log(
          `${label}：第 ${result.day} 天；主线程卡顿 95% 在 ${result.lagP95.toFixed(1)} 毫秒以内、最长 ${result.lagMax.toFixed(0)} 毫秒，` +
            `长帧 ${result.longFrames} 个（最长 ${result.longest.toFixed(0)} 毫秒）；` +
            (render
              ? `渲染线程每帧平均 ${render.frameMs.toFixed(2)} 毫秒、最长 ${render.worstMs.toFixed(1)} 毫秒；`
              : '渲染线程没有回话；') +
            `帧率（参考）${result.fps.toFixed(0)}；JS 堆 ${result.heapMB.toFixed(0)} MB`,
        );
        return result;
      });

  await measure('1 倍速，整张地图');
  await page.evaluate(`document.querySelector('[aria-label="10 倍速"]').click()`);
  await measure('10 倍速，整张地图');
  // 放大到欧洲：换上细节网格
  for (let step = 0; step < 10; step++) await page.wheel(1000, 300, -120);
  await new Promise((resolve) => setTimeout(resolve, 800));
  await measure('10 倍速，放大（细节网格）');

  if (shot) await page.screenshot(shot);
  if (page.errors.length) {
    console.log(`页面报了 ${page.errors.length} 个错：\n${page.errors.slice(0, 5).join('\n')}`);
    process.exitCode = 1;
  }
} finally {
  await chrome.close();
}
