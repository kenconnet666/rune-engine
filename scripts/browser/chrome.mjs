/**
 * 用机器上已装的 Chrome 起一个无界面的实例，经它的调试协议（CDP）开页面、跑脚本、截图。
 * 不装任何依赖：Chrome 是现成的，WebSocket 用 Node 自带的。给冒烟测试和性能核对用——
 * 无界面的实例不会因为窗口被遮住而被系统降频，量出来的数比在日常用的浏览器里稳。
 *
 *   const chrome = await launchChrome();
 *   const page = await chrome.open('http://localhost:5180');
 *   await page.evaluate('document.title');
 *   await page.screenshot('out.png');
 *   await chrome.close();
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** 各平台上 Chrome 常见的位置；也可以用环境变量 CHROME 指定 */
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChrome() {
  const found = CANDIDATES.find((path) => path && existsSync(path));
  if (!found) throw new Error('没找到 Chrome：用环境变量 CHROME 指出它的位置');
  return found;
}

/**
 * @param {{ width?: number, height?: number, scale?: number, software?: boolean }} [options]
 *   software：没有显卡的机器（CI）上用软件实现的 WebGPU
 */
export async function launchChrome({
  width = 1920,
  height = 927,
  scale = 1,
  software = false,
} = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'rune-chrome-'));
  const child = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-webgpu',
      // CI 的容器里 Chrome 的沙箱起不来：那里跑的只有我们自己的页面，可以关掉
      ...(process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : []),
      ...(software ? ['--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] : []),
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${scale}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  // Chrome 起来之后在标准错误里报出调试端口的地址
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Chrome 没有起来：\n${output}`)), 20_000);
    child.stderr.on('data', (chunk) => {
      output += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    });
    child.once('exit', (code) => reject(new Error(`Chrome 退出了（${code}）：\n${output}`)));
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('连不上 Chrome 的调试端口'));
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id === undefined) {
      for (const listener of listeners) listener(message);
      return;
    }
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter?.reject(new Error(`${message.error.message}`));
    else waiter?.resolve(message.result);
  };

  /** 发一条协议命令，等它的结果 */
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  return {
    /**
     * 开一个页面。init 是页面自己的脚本运行之前先跑的一段脚本（预置 localStorage 之类）
     * @param {string} url
     * @param {{ init?: string }} [options]
     */
    async open(url, { init } = {}) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const call = (method, params) => send(method, params, sessionId);
      /** 页面里报的错和控制台消息，测试结束时可以拿来看 */
      const errors = [];
      const logs = [];
      listeners.add((message) => {
        if (message.sessionId !== sessionId) return;
        if (message.method === 'Runtime.exceptionThrown') {
          const details = message.params.exceptionDetails;
          errors.push(details.exception?.description ?? details.text);
        }
        if (message.method === 'Runtime.consoleAPICalled') {
          const text = message.params.args.map((arg) => arg.value ?? arg.description).join(' ');
          (message.params.type === 'error' ? errors : logs).push(text);
        }
      });
      await call('Runtime.enable');
      await call('Page.enable');
      if (init) await call('Page.addScriptToEvaluateOnNewDocument', { source: init });
      await call('Page.navigate', { url });

      const page = {
        errors,
        logs,
        /** 在页面里算一个表达式（可以是 await 的），拿回它的值 */
        async evaluate(expression) {
          const { result, exceptionDetails } = await call('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
          });
          if (exceptionDetails) {
            throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
          }
          return result.value;
        },
        /** 等到页面里的一个表达式为真；超时就报错，报错里带上当时页面上的文字 */
        async waitFor(expression, { timeoutMs = 15_000, what = expression } = {}) {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            if (await page.evaluate(`Boolean(${expression})`)) return;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const text = await page.evaluate('document.body?.innerText.slice(0, 400)');
          throw new Error(`等了 ${timeoutMs} 毫秒没等到：${what}\n页面上是：${text}`);
        },
        /** 点一下页面上的某个位置（CSS 像素） */
        async click(x, y) {
          for (const type of ['mousePressed', 'mouseReleased']) {
            await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
          }
        },
        /**
         * 点文字以 text 开头的那个按钮；没有就报错。
         * 直接让按钮自己“被点一下”，不按坐标发鼠标事件：按钮正在动（对话框的进场动画）时按坐标点会偶尔点偏。
         */
        async clickButton(text) {
          const clicked = await page.evaluate(`(() => {
            const button = [...document.querySelectorAll('button')].find(
              (candidate) => candidate.textContent.trim().startsWith(${JSON.stringify(text)}) && candidate.checkVisibility(),
            );
            button?.click();
            return Boolean(button);
          })()`);
          if (!clicked) throw new Error(`页面上没有“${text}”这个按钮`);
        },
        /** 滚轮：正数往下（缩小地图），负数往上（放大） */
        async wheel(x, y, deltaY) {
          await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
        },
        async screenshot(path) {
          const { data } = await call('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path, Buffer.from(data, 'base64'));
        },
      };
      return page;
    },
    async close() {
      socket.close();
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
      // 临时的用户目录偶尔还被占着一小会儿：删不掉就算了，系统会清
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}
