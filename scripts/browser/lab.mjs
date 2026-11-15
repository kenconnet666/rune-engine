/**
 * 试验场的对比：同一张订单表，网页元素和自己画的各跑一遍——挂载、改一批、连着滚，各量几个数。
 *
 *   pnpm dev:lab                                # 先把试验场起起来（http://localhost:5183）
 *   node scripts/browser/lab.mjs [--rows=2000] [--rounds=2] [--out=lab-shots]
 *
 * 两种落地交替着跑（机器忙不忙对两边一样），每种跑 rounds 遍、取中位数。
 * 给了 --out 的话还顺带核对两边画出来的样子对不对得上（截图留在那个目录里）。
 * 有一样不对就以 1 退出。
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './chrome.mjs';
import { readArgs, sleep } from './game.mjs';

const args = readArgs();
const site = args.url === 'http://localhost:5180' ? 'http://localhost:5183' : args.url;
const rows = Number(args.value('rows') ?? 2000);
const rounds = Number(args.value('rounds') ?? 2);
const out = args.value('out');
if (out) mkdirSync(out, { recursive: true });

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const problems = [];
const check = (ok, what) => {
  if (!ok) problems.push(what);
};

/** 表头加一条线的高、一行的高（和 apps/lab/src/data.ts 里的一样） */
const HEAD = 41;
const ROW = 36;

const results = { dom: [], view: [] };
const shots = {};
/** 表格那一块的顶边在页面上的哪里（工具栏下面） */
let stageTop;
for (let round = 0; round < rounds; round++) {
  for (const mode of ['dom', 'view']) {
    const chrome = await launchChrome({ width: 1200, height: 800 });
    const page = await chrome.open(`${site}/?mode=${mode}&rows=${rows}`);
    try {
      await page.waitFor('window.__lab', { timeoutMs: 120_000, what: `${mode} 挂载完` });
      const mount = JSON.parse(
        await page.evaluate(
          'JSON.stringify({ mountMs: window.__lab.mountMs, scriptMs: window.__lab.mountScriptMs })',
        ),
      );
      await sleep(800);
      /** 表里第 index 行的中间在页面上的哪里 */
      const top = Number(
        await page.evaluate(
          `document.querySelector('[data-lab-stage]').getBoundingClientRect().top`,
        ),
      );
      stageTop = top;
      const rowCenter = (index) => ({ x: 400, y: top + HEAD + index * ROW + ROW / 2 });
      if (round === 0) {
        shots[mode] = join(out ?? '.', `lab-${mode}.png`);
        if (out) await page.screenshot(shots[mode]);
        // 交互：指着第 3 行、点第 5 行、滚轮往下滚
        const hovered = rowCenter(2);
        await page.hover(hovered.x, hovered.y);
        const chosen = rowCenter(4);
        await page.click(chosen.x, chosen.y);
        await sleep(300);
        if (out) await page.screenshot(join(out, `lab-${mode}-picked.png`));
        const state = () => page.evaluate('JSON.stringify(window.__lab.state())').then(JSON.parse);
        const picked = (await state()).selected;
        check(picked === 5, `${mode}：点第 5 行，选中的却是 ${picked}`);
        if (mode === 'view') {
          // 选中文字、复制：从第 1 行的单号拖到第 2 行的客户，按 Ctrl+C，看交给剪贴板的是什么
          await page.evaluate(
            `document.addEventListener('copy', (event) => { window.__copied = event.clipboardData.getData('text/plain'); })`,
          );
          const from = rowCenter(0);
          const to = rowCenter(1);
          await page.drag(83, from.y, 300, to.y);
          await sleep(200);
          if (out) await page.screenshot(join(out, 'lab-view-selected.png'));
          const key = { key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: 2 };
          await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...key, commands: ['copy'] });
          await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
          await sleep(100);
          const copied = await page.evaluate('window.__copied ?? null');
          const expected =
            'SO100001\t陈默\t西安\t¥412.33\t待付款\tfragile · handle with care\n2\tSO100002\t林小满';
          check(copied === expected, `view：拖选两行复制到的是 ${JSON.stringify(copied)}`);
        }
        await page.wheel(400, 400, 720);
        // 网页元素那版的滚轮是缓着滚的：等它停
        await sleep(700);
        const scrolled = (await state()).scrollTop;
        check(Math.abs(scrolled - 720) < 2, `${mode}：滚轮滚 720 像素，实际滚到 ${scrolled}`);
        if (out) await page.screenshot(join(out, `lab-${mode}-scrolled.png`));
      }
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(JSON.parse(await page.evaluate('window.__lab.update().then(JSON.stringify)')));
        await sleep(150);
      }
      const scroll = JSON.parse(
        await page.evaluate('window.__lab.scroll(3000).then(JSON.stringify)'),
      );
      await sleep(600);
      const extra = JSON.parse(
        await page.evaluate(
          'JSON.stringify({ render: window.__lab.render, host: window.__lab.host })',
        ),
      );
      results[mode].push({
        mount: mount.mountMs,
        mountScript: mount.scriptMs,
        update: median(updates.map((u) => u.frameMs)),
        updateScript: median(updates.map((u) => u.scriptMs)),
        fps: scroll.fps,
        worst: scroll.worstMs,
        ...extra,
      });
      check(page.errors.length === 0, `${mode}：页面报错 ${page.errors.slice(0, 2).join(' | ')}`);
    } catch (error) {
      problems.push(`${mode}：${error.message.slice(0, 300)}`);
    } finally {
      await chrome.close();
    }
  }
}

const pick = (mode, key) => median(results[mode].map((r) => r[key]).filter((v) => v !== undefined));
const line = (label, key, unit, digits = 0) =>
  console.log(
    `  ${label.padEnd(14, '　')}网页元素 ${pick('dom', key)?.toFixed(digits).padStart(7)} ${unit}   自己画 ${pick('view', key)?.toFixed(digits).padStart(7)} ${unit}`,
  );
console.log(`${rows} 行（每种跑 ${rounds} 遍，取中位数）`);
line('挂载到出画面', 'mount', '毫秒');
line('其中脚本', 'mountScript', '毫秒');
line('改 200 格到出画面', 'update', '毫秒', 1);
line('其中脚本', 'updateScript', '毫秒', 1);
line('连着滚：主线程帧率', 'fps', '帧/秒');
line('连着滚：最长一帧', 'worst', '毫秒');
const view = results.view.at(-1);
if (view?.render) {
  console.log(
    `  自己画的：渲染线程 ${view.render.fps.toFixed(0)} 帧/秒（最长 ${view.render.worstMs.toFixed(0)} 毫秒）；` +
      `上次排版 ${view.host.layoutMs.toFixed(2)} 毫秒，列显示列表 ${view.host.buildMs.toFixed(2)} 毫秒，${view.host.items} 项`,
  );
}

// 两边画出来的样子对不对得上。只比表格那一块（工具栏上的读数、网页元素那版的滚动条不算），
// 而且先缩小到六分之一再比：文字的抗锯齿两边不一样（网页元素是彩色的亚像素，自己画的是灰度），
// 逐像素比处处都“不一样”；缩小之后抗锯齿的差别被平均掉，位置错了、少画了东西才显出来
if (out && shots.dom && shots.view && stageTop !== undefined) {
  const chrome = await launchChrome({ width: 600, height: 400 });
  const page = await chrome.open('about:blank');
  try {
    const [a, b] = [shots.dom, shots.view].map((file) => readFileSync(file).toString('base64'));
    const diff = JSON.parse(
      await page.evaluate(`(async () => {
        const SHRINK = 6, SCROLLBAR = 24, top = ${Math.ceil(stageTop)};
        const load = async (data) => {
          const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
          const width = image.width - SCROLLBAR, height = image.height - top;
          const small = new OffscreenCanvas(Math.floor(width / SHRINK), Math.floor(height / SHRINK));
          const g = small.getContext('2d'); g.imageSmoothingQuality = 'high';
          g.drawImage(image, 0, top, width, height, 0, 0, small.width, small.height);
          return g.getImageData(0, 0, small.width, small.height);
        };
        const [one, two] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
        if (one.width !== two.width || one.height !== two.height) return JSON.stringify({ ratio: 1 });
        let different = 0;
        for (let i = 0; i < one.data.length; i += 4) {
          const d = Math.max(Math.abs(one.data[i] - two.data[i]), Math.abs(one.data[i + 1] - two.data[i + 1]), Math.abs(one.data[i + 2] - two.data[i + 2]));
          if (d > 24) different++;
        }
        return JSON.stringify({ ratio: different / (one.width * one.height) });
      })()`),
    );
    console.log(`  两边画出来的表格（缩小后比）：${(diff.ratio * 100).toFixed(2)}% 不一样`);
    check(diff.ratio < 0.01, `两边画出来差得太多：${(diff.ratio * 100).toFixed(2)}%`);
  } finally {
    await chrome.close();
  }
}

if (problems.length > 0) {
  console.error('不对的地方：\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('试验场对比通过');
