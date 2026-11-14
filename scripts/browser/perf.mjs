/**
 * 性能核对：在无界面的 Chrome 里开一局，让它用 10 倍速跑一阵，量主线程卡不卡、渲染线程每帧花多久。
 * 先把开发服务器起起来（pnpm dev），再跑：
 *   node scripts/browser/perf.mjs [地址=http://localhost:5180] [--budget] [--headed] [--shot=截图存到哪]
 * --headed：开一个真的窗口来量。无界面模式下帧是怎么排的和真窗口不一样；拿不准一个数是不是模式带来的，用它对一下。
 * --budget：超了 docs/performance.md 里“手动核对的”那几条线就以 1 退出。要在有显卡的机器上跑，
 * 软件渲染（CI）量出来的数不作数。
 */
import { launchChrome } from './chrome.mjs';
import { LOCALE_INIT, readArgs, sleep } from './game.mjs';

const args = readArgs();
const { url } = args;
const shot = args.value('shot');

/** 预算（毫秒；长帧是个数）：和 docs/performance.md 的表是同一份，改的时候两边一起改 */
const BUDGET = { lagP95: 20, longFrames: 2, renderFrameMs: 4 };
const overBudget = [];

const chrome = await launchChrome({ scale: 2, headed: args.flag('headed') });
try {
  const page = await chrome.open(url, { init: LOCALE_INIT });
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
        if (result.lagP95 > BUDGET.lagP95) {
          overBudget.push(
            `${label}：主线程卡顿 ${result.lagP95.toFixed(1)} 毫秒 > ${BUDGET.lagP95}`,
          );
        }
        if (result.longFrames > BUDGET.longFrames) {
          overBudget.push(`${label}：长帧 ${result.longFrames} 个 > ${BUDGET.longFrames}`);
        }
        if (render && render.frameMs > BUDGET.renderFrameMs) {
          overBudget.push(
            `${label}：渲染线程每帧 ${render.frameMs.toFixed(2)} 毫秒 > ${BUDGET.renderFrameMs}`,
          );
        }
        return result;
      });

  // 开局那一下（关对话框、起主机、画第一帧）会有两三个长帧，那是一次性的：等它过去再量稳定打着的时候
  await sleep(2500);
  await measure('1 倍速，整张地图');
  await page.evaluate(`document.querySelector('[aria-label="10 倍速"]').click()`);
  await measure('10 倍速，整张地图');
  // 放大到欧洲：换上细节网格
  for (let step = 0; step < 10; step++) await page.wheel(1000, 300, -120);
  await sleep(800);
  await measure('10 倍速，放大（细节网格）');

  if (shot) await page.screenshot(shot);
  if (args.flag('budget')) {
    if (overBudget.length > 0) {
      console.error(`性能预算没过：\n  ${overBudget.join('\n  ')}`);
      process.exitCode = 1;
    } else {
      console.log('性能预算通过');
    }
  }
  if (page.errors.length) {
    console.log(`页面报了 ${page.errors.length} 个错：\n${page.errors.slice(0, 5).join('\n')}`);
    process.exitCode = 1;
  }
} finally {
  await chrome.close();
}
