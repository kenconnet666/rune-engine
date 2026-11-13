/**
 * 几个冒烟测试（smoke、online、cloud）共用的小东西：命令行参数、在《迷惘》的页面上找文字和按钮的表达式、
 * 读“第几天”、最后核对页面有没有报错。浏览器本身的操作在 chrome.mjs。
 */

/** 命令行：第一个不带 -- 的是游戏的地址；flag('software') 看有没有 --software，value('shots') 取 --shots=… 的值 */
export function readArgs(argv = process.argv.slice(2)) {
  return {
    url: argv.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:5180',
    flag: (name) => argv.includes(`--${name}`),
    value: (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3),
  };
}

/** 页面自己的脚本之前先跑的：界面语言默认跟着浏览器走，这里固定成中文，测试按中文的字找按钮 */
export const LOCALE_INIT = `localStorage.setItem('miwang:locale', 'zh')`;

/** 下面两个给出的是在页面里算的表达式（传给 page.waitFor / page.evaluate），不是结果 */
export const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
export const hasButton = (text) =>
  `[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}) && b.checkVisibility())`;

/** 有这个按钮、而且按得动 */
export const canPress = (text) =>
  `[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}) && b.checkVisibility() && !b.disabled)`;

/** 页面上现在是第几天；没有是 -1 */
export const dayOf = (page) =>
  page.evaluate(`Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1] ?? -1)`);

/** “已经过了第 n 天”的表达式 */
export const dayPast = (n) => `Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1]) > ${n}`;

export const closeDialog = (page) =>
  page.evaluate(`document.querySelector('dialog[open]')?.close()`);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 一步一步报进度：返回的函数每叫一次打一行“第几步：做了什么”；steps() 是到现在做完了几步 */
export function progress() {
  let step = 0;
  const done = (what) => console.log(`${String(++step).padStart(2)}. ${what}`);
  done.steps = () => step;
  return done;
}

/** 各个页面有没有报错（未捕获的异常、console.error）；有就抛出来，带上是哪个页面的 */
export function assertNoErrors(pages) {
  for (const [name, page] of Object.entries(pages)) {
    if (!page.errors.length) continue;
    throw new Error(
      `${name}的页面报了 ${page.errors.length} 个错：\n${page.errors.slice(0, 8).join('\n')}`,
    );
  }
}

/**
 * 点打开着的对话框里文字以 text 开头的那个按钮。
 * 对话框后面的画面上常有同名的按钮（“守方”），page.clickButton 会先碰到后面那个。
 */
export async function clickInDialog(page, text) {
  const clicked = await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('dialog[open] button')].find(
      (candidate) => candidate.textContent.trim().startsWith(${JSON.stringify(text)}),
    );
    button?.click();
    return Boolean(button);
  })()`);
  if (!clicked) throw new Error(`对话框里没有“${text}”这个按钮`);
}

/**
 * 地图画布上现在有多少种颜色：把它缩小画到一张普通画布上数一数。
 * 画出来的地图有几百种；一种都数不出几种说明渲染线程没在画（着色器、管线出了问题时就是一张黑屏，不会有任何报错）。
 */
export const mapColors = (page) =>
  page.evaluate(`(() => {
    const probe = document.createElement('canvas');
    probe.width = 320;
    probe.height = 160;
    const context = probe.getContext('2d');
    context.drawImage(document.querySelector('canvas'), 0, 0, probe.width, probe.height);
    const { data } = context.getImageData(0, 0, probe.width, probe.height);
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return colors.size;
  })()`);
