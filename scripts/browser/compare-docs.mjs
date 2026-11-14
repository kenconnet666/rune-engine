/**
 * 文档站两种摆法逐页对比：同一页在“普通网页”和“画进画布”下各截一张，数有多少像素不一样。
 * 差得多的页排在前面——那就是画进画布之后要去看、去修的地方。
 *
 *   pnpm dev:docs                                   # 先把文档站起起来（http://localhost:5181）
 *   node scripts/browser/compare-docs.mjs [--only=button,select] [--limit=20] [--out=compare-shots]
 *
 * 做法：两个窗口各用一种摆法打开站点，逐页在站内跳转（不重新加载）、等内容出来、各截一张；
 * 第三个窗口里把两张图逐像素比。只比首屏（不滚动），动画没有冻住，所以每秒都在动的东西
 * （加载中的转圈、首页的粒子）会算进差异里——看结果时心里有数，差异小于千分之几的基本是文字抗锯齿。
 * 每一页的两张截图和结果都留在输出目录里（compare.json 是全部的数）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './chrome.mjs';
import { readArgs, sleep } from './game.mjs';

const args = readArgs();
const site = args.url === 'http://localhost:5180' ? 'http://localhost:5181' : args.url;
const out = args.value('out') ?? 'compare-shots';
const only = args.value('only')?.split(',');
const limit = Number(args.value('limit') ?? Infinity);
/** 两个颜色分量差多少以内算一样（文字的抗锯齿两种摆法不会逐像素相同） */
const TOLERANCE = 24;

mkdirSync(out, { recursive: true });
const chrome = await launchChrome({ width: 1440, height: 900 });

/** 在页面里算：两张图（base64 的 PNG）有多少像素不一样，不一样的都在哪个范围里 */
const DIFF = `async (a, b, tolerance) => {
  const load = async (data) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + data;
    await image.decode();
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height);
  };
  const [one, two] = await Promise.all([load(a), load(b)]);
  if (one.width !== two.width || one.height !== two.height) return { ratio: 1, box: null, note: '尺寸不一样' };
  let different = 0, left = one.width, top = one.height, right = -1, bottom = -1;
  for (let i = 0; i < one.data.length; i += 4) {
    const delta = Math.max(Math.abs(one.data[i] - two.data[i]), Math.abs(one.data[i + 1] - two.data[i + 1]), Math.abs(one.data[i + 2] - two.data[i + 2]));
    if (delta <= tolerance) continue;
    different++;
    const x = (i / 4) % one.width, y = Math.floor(i / 4 / one.width);
    if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
  }
  return { ratio: different / (one.width * one.height), box: right < 0 ? null : [left, top, right - left + 1, bottom - top + 1] };
}`;

try {
  const pages = {
    dom: await chrome.open(`${site}/?stage=dom`, { newWindow: true }),
    canvas: await chrome.open(`${site}/?stage=canvas`, { newWindow: true }),
  };
  const judge = await chrome.open('about:blank', { newWindow: true });
  for (const page of Object.values(pages)) {
    await page.waitFor(`document.querySelectorAll('nav a[href^="/"]').length > 20`, {
      what: '站点的侧栏',
      timeoutMs: 120_000,
    });
  }
  await pages.canvas.waitFor(`document.querySelectorAll('canvas > [drawable]').length > 0`, {
    what: '界面搬进画布',
    timeoutMs: 60_000,
  });

  // 右下角换摆法的开关两边写的字本来就不一样：藏起来，不算进差异
  for (const page of Object.values(pages)) {
    await page.evaluate(
      `document.querySelector('[data-stage-switch]').parentElement.style.visibility = 'hidden'`,
    );
  }

  const all = JSON.parse(
    await pages.dom.evaluate(
      `JSON.stringify([...new Set([...document.querySelectorAll('nav a[href^="/"]')].map((a) => a.getAttribute('href')))])`,
    ),
  );
  const paths = ['/', ...all]
    .filter((path) => !only || only.some((name) => path.endsWith(`/${name}`)))
    .slice(0, limit);
  console.log(`一共 ${paths.length} 页`);

  /** 站内跳到一页（不重新加载：两种摆法都只初始化一次），等它的内容出来 */
  const go = async (page, path) => {
    await page.evaluate(
      `history.pushState({}, '', ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate'))`,
    );
    // 地址是我们自己改的，马上就对；页面的代码要现加载，路由真正换过去之后侧栏的“当前页”才跟着变。
    // 首页不在侧栏里：没有“当前页”就是到了
    const current = `document.querySelector('nav a[aria-current="page"]')?.getAttribute('href')`;
    await page.waitFor(
      path === '/'
        ? `location.pathname === '/' && !${current}`
        : `${current} === ${JSON.stringify(path)}`,
      { what: `${path} 的内容`, timeoutMs: 120_000 },
    );
  };

  const results = [];
  for (const [index, path] of paths.entries()) {
    const name = path === '/' ? 'home' : path.slice(1).replaceAll('/', '-');
    try {
      await Promise.all(Object.values(pages).map((page) => go(page, path)));
      // 代码高亮、懒加载的示例、界面采集的补拍都要一小会儿
      await sleep(2000);
      const files = {};
      for (const [mode, page] of Object.entries(pages)) {
        files[mode] = join(out, `${name}.${mode}.png`);
        await page.screenshot(files[mode]);
      }
      const [a, b] = ['dom', 'canvas'].map((mode) => readFileSync(files[mode]).toString('base64'));
      const result = JSON.parse(
        await judge.evaluate(
          `(${DIFF})(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${TOLERANCE}).then(JSON.stringify)`,
        ),
      );
      results.push({ path, ...result });
      console.log(
        `${String(index + 1).padStart(3)} ${(result.ratio * 100).toFixed(2).padStart(6)}%  ${path}${result.box ? `  差异在 ${result.box.join(',')}` : ''}`,
      );
    } catch (error) {
      results.push({ path, ratio: NaN, error: error.message.split('\n')[0] });
      console.log(
        `${String(index + 1).padStart(3)}   没比成  ${path}：${error.message.split('\n')[0]}`,
      );
    }
  }

  const errors = Object.fromEntries(
    Object.entries(pages).map(([mode, page]) => [mode, [...new Set(page.errors)].slice(0, 20)]),
  );
  writeFileSync(join(out, 'compare.json'), JSON.stringify({ results, errors }, null, 2));
  const ranked = results.filter((r) => r.ratio >= 0).sort((a, b) => b.ratio - a.ratio);
  console.log('\n差得最多的：');
  for (const r of ranked.slice(0, 20))
    console.log(`${(r.ratio * 100).toFixed(2).padStart(6)}%  ${r.path}`);
  const same = ranked.filter((r) => r.ratio < 0.003).length;
  console.log(
    `\n${ranked.length} 页里 ${same} 页的差异小于 0.3%；没比成的 ${results.length - ranked.length} 页。` +
      `页面报错：普通网页 ${errors.dom.length} 种，画布 ${errors.canvas.length} 种（见 ${join(out, 'compare.json')}）`,
  );
} finally {
  await chrome.close();
}
