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

/**
 * 没有显卡的机器上用软件实现的 WebGPU（SwiftShader）。
 * Linux 上 WebGPU 走 Vulkan，而且默认不开：要把 Vulkan 打开、也指到软件实现上，无界面时不建显示表面。
 */
const SOFTWARE_GPU = [
  '--use-webgpu-adapter=swiftshader',
  '--enable-unsafe-swiftshader',
  ...(process.platform === 'linux'
    ? [
        '--enable-features=Vulkan',
        '--use-vulkan=swiftshader',
        '--use-angle=swiftshader',
        '--disable-vulkan-surface',
        '--ignore-gpu-blocklist',
      ]
    : []),
];

export function findChrome() {
  const found = CANDIDATES.find((path) => path && existsSync(path));
  if (!found) throw new Error('没找到 Chrome：用环境变量 CHROME 指出它的位置');
  return found;
}

/**
 * @param {{ width?: number, height?: number, scale?: number, software?: boolean, headed?: boolean }} [options]
 *   software：没有显卡的机器（CI）上用软件实现的 WebGPU
 *   headed：开一个真的窗口（量帧率、长帧时用：无界面模式下帧是怎么排的和真窗口不一样，量出来偏大）
 */
export async function launchChrome({
  width = 1920,
  height = 927,
  scale = 1,
  software = false,
  headed = false,
} = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'rune-chrome-'));
  const child = spawn(
    findChrome(),
    [
      // 真窗口被别的窗口挡住时也照常跑，不然量到一半帧就停了
      ...(headed
        ? ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
        : ['--headless=new']),
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-webgpu',
      // CI 的容器里 Chrome 的沙箱起不来：那里跑的只有我们自己的页面，可以关掉
      ...(process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : []),
      ...(software ? SOFTWARE_GPU : []),
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${scale}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  // Chrome 起来之后在标准错误里报出调试端口的地址
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    // CI 的运行器上头一次起 Chrome 偶尔要二十多秒（冷盘）：等得宽一点
    const timer = setTimeout(() => reject(new Error(`Chrome 没有起来：\n${output}`)), 60_000);
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
     * 开一个页面。init 是页面自己的脚本运行之前先跑的一段脚本（预置 localStorage 之类）。
     * 再开一个页面时，前一个会变成后台标签页（动画停掉、定时器降频）；要两个页面同时都在前台
     * （联机测试的两位玩家），给后开的那个 newWindow。
     * @param {string} url
     * isolated：开在一个全新的浏览器环境里（没有别的页面的本地存储、缓存），当“另一台设备”用；它自带一个窗口。
     * @param {{ init?: string, newWindow?: boolean, isolated?: boolean }} [options]
     */
    async open(url, { init, newWindow = false, isolated = false } = {}) {
      const browserContextId = isolated
        ? (await send('Target.createBrowserContext')).browserContextId
        : undefined;
      const { targetId } = await send('Target.createTarget', {
        url: 'about:blank',
        newWindow: newWindow || isolated,
        browserContextId,
      });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const call = (method, params) => send(method, params, sessionId);
      /** 页面里报的错和控制台消息，测试结束时可以拿来看；页面起的 Worker 里的也算在内 */
      const errors = [];
      const logs = [];
      /** 这个页面和它的 Worker 各自的调试会话 */
      const sessions = new Set([sessionId]);
      listeners.add((message) => {
        if (!sessions.has(message.sessionId)) return;
        if (message.method === 'Target.attachedToTarget') {
          // 页面起了一个 Worker：也听它的（模拟和渲染都在 Worker 里，那里抛的错主线程看不到）
          const worker = message.params.sessionId;
          sessions.add(worker);
          send('Runtime.enable', {}, worker).catch(() => {});
          return;
        }
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
      await call('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      });
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
        /**
         * 等到页面里的一个表达式为真；超时就报错，报错里带上当时页面上的文字。
         * 表达式算的时候出错也当“还没等到”：页面正在刷新的那一刻 document.body 还不在，这是常事；
         * 一直出错的话（表达式写错了）最后的报错里带着那条错误。
         */
        async waitFor(expression, { timeoutMs = 15_000, what = expression } = {}) {
          const deadline = Date.now() + timeoutMs;
          let lastError = '';
          while (Date.now() < deadline) {
            try {
              if (await page.evaluate(`Boolean(${expression})`)) return;
              lastError = '';
            } catch (error) {
              lastError = `\n表达式出错：${error.message}`;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const text = await page.evaluate('document.body?.innerText.slice(0, 400)');
          throw new Error(`等了 ${timeoutMs} 毫秒没等到：${what}\n页面上是：${text}${lastError}`);
        },
        /** 点一下页面上的某个位置（CSS 像素） */
        async click(x, y) {
          for (const type of ['mousePressed', 'mouseReleased']) {
            await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
          }
        },
        /** 按住从一点拖到另一点再松开（中间走 steps 步：拖动条、拖拽排序都要看到移动的过程） */
        async drag(x1, y1, x2, y2, steps = 8) {
          const mouse = (type, x, y, buttons) =>
            call('Input.dispatchMouseEvent', {
              type,
              x,
              y,
              button: 'left',
              buttons,
              clickCount: 1,
            });
          await mouse('mouseMoved', x1, y1, 0);
          await mouse('mousePressed', x1, y1, 1);
          for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            await mouse('mouseMoved', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1);
          }
          await mouse('mouseReleased', x2, y2, 0);
        },
        /**
         * 点文字以 text 开头的那个按钮；没有就报错。
         * 直接让按钮自己“被点一下”，不按坐标发鼠标事件：按钮正在动（对话框的进场动画）时按坐标点会偶尔点偏。
         */
        async clickButton(text) {
          const result = await page.evaluate(`(() => {
            const button = [...document.querySelectorAll('button')].find(
              (candidate) => candidate.textContent.trim().startsWith(${JSON.stringify(text)}) && candidate.checkVisibility(),
            );
            if (!button) return 'missing';
            if (button.disabled) return 'disabled';
            button.click();
            return 'clicked';
          })()`);
          if (result === 'missing') throw new Error(`页面上没有“${text}”这个按钮`);
          // 按不动的按钮“点”下去什么都不会发生，测试会在后面莫名其妙地等超时：在这里就说清楚
          if (result === 'disabled') throw new Error(`“${text}”这个按钮现在按不动（禁用着）`);
        },
        /** 把指针移到页面上的某个位置（不按下）：悬停的样子、提示气泡 */
        async hover(x, y) {
          await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        },
        /** 往有焦点的输入框里打字（整段文字一次进去，和输入法上屏是同一条路） */
        async type(text) {
          await call('Input.insertText', { text });
        },
        /** 滚轮：正数往下（缩小地图），负数往上（放大） */
        async wheel(x, y, deltaY) {
          await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
        },
        async screenshot(path) {
          const { data } = await call('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path, Buffer.from(data, 'base64'));
        },
        /**
         * 录一段浏览器自己的跟踪（run 跑着的那段时间），返回跟踪事件：主线程的时间不在我们的脚本里时，
         * 用它看是花在排版、绘制还是别的哪一步上。
         * @param {() => Promise<void>} run
         */
        async trace(run) {
          const events = [];
          const collect = (message) => {
            if (message.method === 'Tracing.dataCollected') events.push(...message.params.value);
          };
          listeners.add(collect);
          await call('Tracing.start', {
            transferMode: 'ReportEvents',
            traceConfig: { includedCategories: ['devtools.timeline', 'toplevel', 'blink', 'cc'] },
          });
          await run();
          const complete = new Promise((resolve) => {
            const end = (message) => {
              if (message.method !== 'Tracing.tracingComplete') return;
              listeners.delete(end);
              resolve();
            };
            listeners.add(end);
          });
          await call('Tracing.end');
          await complete;
          listeners.delete(collect);
          return events;
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
