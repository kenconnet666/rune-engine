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

/**
 * 页面自己的脚本之前先跑的：界面语言默认跟着浏览器走，这里固定成中文，测试按中文的字找按钮；
 * 冒出要拿主意的事时不自动暂停——测试要时间一直走（抉择什么时候出是随机的，到期会按默认的办）
 */
export const LOCALE_INIT = `localStorage.setItem('miwang:locale', 'zh'); localStorage.setItem('miwang:autopause', 'false')`;

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

/**
 * 界面是不是画在画布里（新的 Chrome 才行）。等渲染线程的画面接上、几层界面搬进画布，然后在面板那一层里找一个
 * 露在外面、底色不透明又鲜艳的按钮（选中的那个倍速按钮是橙的），从画布上读它那里的颜色：读出来就是它的底色，
 * 说明它是渲染线程贴上去的（网页元素本身是读不进画布的）。地图上不会恰好在那里有同一种颜色。
 * 返回 'drawn'；'unsupported'（这个浏览器没有这套接口：界面照老办法叠在画布上面，不算错）；或者一句哪里不对。
 */
export async function interfaceInCanvas(page) {
  if (!(await page.evaluate(`'captureElementImage' in HTMLCanvasElement.prototype`))) {
    return 'unsupported';
  }
  await page.waitFor(`document.querySelector('canvas > [data-stage-layer="hud"]')`, {
    what: '界面搬进画布',
    timeoutMs: 20_000,
  });
  const check = `(() => {
    const canvas = document.querySelector('canvas');
    const parse = (color) => color.match(/[0-9.]+/g).map(Number);
    // 要真的露在外面的：面板一长，有的按钮滚到了看不见的地方（被卷走的那里画的不是它）
    const shown = (button) => {
      const box = button.getBoundingClientRect();
      return document.elementFromPoint(box.x + 4, box.y + 4) === button;
    };
    const solid = [...canvas.querySelectorAll(':scope > [data-stage-layer="hud"] button')]
      .map((button) => ({ button, color: parse(getComputedStyle(button).backgroundColor) }))
      .find(
        ({ button, color: [r, g, b, a = 1] }) =>
          a === 1 && Math.max(r, g, b) - Math.min(r, g, b) > 80 && shown(button),
      );
    if (!solid) return '面板那一层里没有露在外面、底色鲜艳的按钮可以比';
    const box = solid.button.getBoundingClientRect();
    const ratio = canvas.width / canvas.clientWidth;
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d');
    // 按钮的左上角往里一点：避开中间的图标和文字
    context.drawImage(canvas, Math.round((box.x + 4) * ratio), Math.round((box.y + 4) * ratio), 1, 1, 0, 0, 1, 1);
    const seen = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    const close = seen.every((value, index) => Math.abs(value - solid.color[index]) <= 16);
    return close ? 'drawn' : '按钮的底色是 ' + solid.color.slice(0, 3) + '，画布上那里是 ' + seen;
  })()`;
  // 刚搬进去的头几帧画面可能还没到；软件渲染的机器（CI）上把一层界面画进贴图要很久（量到过两分钟）：
  // 等到画出来为止，三分钟还没有才算没画
  const deadline = Date.now() + 180_000;
  let result = '';
  do {
    result = await page.evaluate(check);
    if (result === 'drawn') break;
    await sleep(250);
  } while (Date.now() < deadline);
  return result;
}
