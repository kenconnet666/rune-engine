/**
 * 画布版文档站的核对：每一页都打得开、没有报错、画出了东西；导航点得动；选中文字能复制；换主题、滚动都生效。
 *
 *   pnpm dev:site                                  # 先把文档站起起来（http://localhost:5185）
 *   node scripts/browser/site.mjs [--out=目录]     # 给了 --out 每一页留一张截图
 *
 * 整站画在一张画布里，页面上没有可以按文字找的元素：核对靠界面的树（页面把宿主挂在 window.__site 上）。
 * 有一样不对就以 1 退出。
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './chrome.mjs';
import { readArgs, sleep } from './game.mjs';

const args = readArgs();
const site = args.url === 'http://localhost:5180' ? 'http://localhost:5185' : args.url;
const out = args.value('out');
if (out) mkdirSync(out, { recursive: true });

const problems = [];
const check = (ok, what) => {
  if (!ok) problems.push(what);
};

/** 在页面里跑：界面的树里所有的字（按文档的先后），和某段字在画布上的位置 */
const HELPERS = `
  window.__texts = () => {
    const found = [];
    const walk = (node, x, y) => {
      const left = x + node.x, top = y + node.y;
      if (node.type === 'text') found.push({ text: node.text, x: left, y: top, width: node.width, height: node.height });
      for (const child of node.children) walk(child, left - node.scrollLeft, top - node.scrollTop);
    };
    walk(window.__site.tree.root, 0, 0);
    return found;
  };
  window.__find = (text) => window.__texts().find((each) => each.text.startsWith(text) && each.y >= 0 && each.y < innerHeight);
`;

const chrome = await launchChrome({ width: 1400, height: 900 });
const page = await chrome.open(`${site}/`);
try {
  await page.waitFor('window.__site', { timeoutMs: 120_000, what: '文档站挂上' });
  await page.evaluate(HELPERS);
  await sleep(1500);
  const find = async (text) => {
    const found = await page.evaluate(
      `JSON.stringify(window.__find(${JSON.stringify(text)}) ?? null)`,
    );
    return JSON.parse(found);
  };
  const center = (box) => ({
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  });

  // —— 每一页：从导航点过去，标题对、字不少、没报错
  const pages = [
    ['开始', '/', '自己画的界面'],
    ['排版', '/layout', '排版'],
    ['文字', '/text', '文字'],
    ['画法', '/paint', '画法'],
    ['指针和滚动', '/events', '指针和滚动'],
    ['选中和复制', '/selection', '选中和复制'],
    ['基础组件', '/components', '组件'],
    ['性能', '/performance', '性能'],
    ['做了什么、还没做什么', '/roadmap', '做了什么、还没做什么'],
  ];
  for (const [nav, path, heading] of pages) {
    const link = await page
      .evaluate(
        `JSON.stringify(window.__texts().find((each) => each.text === ${JSON.stringify(nav)} && each.x < 232) ?? null)`,
      )
      .then(JSON.parse);
    check(link, `导航里没有“${nav}”`);
    if (!link) continue;
    const at = center(link);
    await page.click(at.x, at.y);
    await sleep(700);
    const state = JSON.parse(
      await page.evaluate(
        `JSON.stringify({ path: location.pathname, texts: window.__texts().length, items: window.__site.stats.items, title: window.__texts().find((each) => each.x > 232 && each.height >= 38)?.text })`,
      ),
    );
    check(state.path === path, `点“${nav}”之后地址是 ${state.path}`);
    check(state.title === heading, `“${nav}”这一页的大标题是 ${state.title}`);
    check(state.items > 40, `“${nav}”这一页只画了 ${state.items} 项`);
    if (out)
      await page.screenshot(
        join(out, `site${path === '/' ? '-start' : path.replace('/', '-')}.png`),
      );
    console.log(
      `${nav.padEnd(12, '　')}${path.padEnd(14)}${state.texts} 段字，这一帧 ${state.items} 项`,
    );
  }

  // —— 选中和复制：在“选中和复制”那一页拖过第一段话
  await page.evaluate(
    `history.pushState(null, '', '/selection'); dispatchEvent(new PopStateEvent('popstate'))`,
  );
  await sleep(700);
  await page.evaluate(
    `document.addEventListener('copy', (event) => { window.__copied = event.clipboardData.getData('text/plain'); })`,
  );
  const quote = await find('人生天地之间');
  check(quote, '“选中和复制”那一页没找到示例里的那段话');
  if (quote) {
    await page.drag(quote.x + 2, quote.y + 10, quote.x + 2 + 14 * 6, quote.y + 10);
    await sleep(200);
    const key = { key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: 2 };
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...key, commands: ['copy'] });
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    await sleep(100);
    const copied = await page.evaluate('window.__copied ?? null');
    check(copied === '人生天地之间', `拖过六个字复制到的是 ${JSON.stringify(copied)}`);
    if (out) await page.screenshot(join(out, 'site-selected.png'));
    console.log(`选中复制　　　拖过六个字，剪贴板拿到 ${JSON.stringify(copied)}`);
  }

  // —— 滚动：滚轮往下，内容上去了
  const before = await find('试一试');
  await page.wheel(800, 500, 600);
  await sleep(300);
  const after = await page
    .evaluate(`JSON.stringify(window.__texts().find((each) => each.text === '试一试') ?? null)`)
    .then(JSON.parse);
  // 这一页不一定有 600 像素可滚：滚到头为止，至少挪了一截
  const moved = before && after ? before.y - after.y : 0;
  check(moved > 100 && moved <= 600, `滚轮滚 600 像素，内容挪了 ${moved}`);

  // —— 换主题：点右上角的开关，页面的底色变了
  const colorAt = () =>
    page.evaluate(
      `window.__site.tree.root.children.find((child) => child.type === 'view').look.backgroundColor`,
    );
  const dark = await colorAt();
  const toggle = await page
    .evaluate(`JSON.stringify(window.__texts().find((each) => each.text === '深色') ?? null)`)
    .then(JSON.parse);
  check(toggle, '顶栏里没找到主题的开关');
  if (toggle) {
    await page.click(
      Math.round(toggle.x + toggle.width + 14 + 18),
      Math.round(toggle.y + toggle.height / 2),
    );
    await sleep(400);
    const light = await colorAt();
    check(dark !== light, `点了主题开关，底色没变（${dark}）`);
    if (out) await page.screenshot(join(out, 'site-light.png'));
    console.log(`换主题　　　　底色 ${dark} → ${light}`);
  }

  check(page.errors.length === 0, `页面报错：${page.errors.slice(0, 3).join(' | ')}`);
} catch (error) {
  problems.push(error.message.slice(0, 400));
} finally {
  await chrome.close();
}

if (problems.length > 0) {
  console.error('不对的地方：\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('文档站核对通过');
