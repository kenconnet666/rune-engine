/**
 * 云存档的冒烟测试：两个互不相干的浏览器环境当两台设备——一台开启云存档、把一局存上去，
 * 另一台填同一个同步码，看到那份存档、读档接着打、再把它删掉。
 * 要带服务端的游戏（pnpm online，或者 pnpm --filter @miwang/server preview）：
 *   node scripts/browser/cloud.mjs [地址=http://localhost:5180] [--software]
 */
import { launchChrome } from './chrome.mjs';

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:5180';
const software = args.includes('--software');

const chrome = await launchChrome({ software });
let step = 0;
const done = (what) => console.log(`${String(++step).padStart(2)}. ${what}`);
const init = `localStorage.setItem('miwang:locale', 'zh')`;
const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
const hasButton = (text) =>
  `[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}) && b.checkVisibility())`;
const clickTab = (page, text) =>
  page.evaluate(
    `[...document.querySelectorAll('dialog[open] [role=tab]')].find((tab) => tab.textContent.includes(${JSON.stringify(text)})).click()`,
  );
const clickLabel = (page, label) =>
  page.evaluate(
    `document.querySelector('dialog[open] [aria-label=${JSON.stringify(label)}]').click()`,
  );
const rows = (page) =>
  page.evaluate(`document.querySelectorAll('dialog[open] [aria-label="读档接着打"]').length`);

/** 从主菜单进到存档页的“云端”那一栏 */
async function openCloud(page) {
  await page.clickButton('存档与回放');
  await page.waitFor(hasButton('存下这一局'), { what: '存档页' });
  await clickTab(page, '云端');
}

try {
  // ───── 第一台设备：打几天，开启云存档，存上去 ─────
  const first = await chrome.open(url, { init });
  // “继续”要等主机发来第一份状态才出现
  await first.waitFor(hasButton('继续这一局'), { what: '主菜单', timeoutMs: 30_000 });
  await first.clickButton('继续这一局');
  await first.evaluate(`document.querySelector('[aria-label="10 倍速"]').click()`);
  await first.waitFor(`Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1]) > 12`, {
    what: '时间在走',
  });
  await first.clickButton('菜单');
  await first.waitFor(hasButton('继续这一局'), { what: '回到主菜单' });
  const savedDay = await first.evaluate(
    `Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1])`,
  );
  await openCloud(first);
  await first.waitFor(hasButton('开启云存档'), { what: '还没开云存档时的说明' });
  await first.clickButton('开启云存档');
  await first.waitFor(
    `document.querySelector('[data-cloud-key]') && ${hasText('云端还没有存档')}`,
    {
      what: '开启之后：同步码和空的列表',
    },
  );
  const key = await first.evaluate(`document.querySelector('[data-cloud-key]').dataset.cloudKey`);
  await first.clickButton('把这一局存到云端');
  await first.waitFor(hasText('已经存到云端'), { what: '存到云端' });
  if ((await rows(first)) !== 1) throw new Error('存上去之后云端应该有一份存档');
  done(`第一台设备：开启云存档，把第 ${savedDay} 天的这一局存到了云端`);

  // ───── 第二台设备（另一个浏览器环境，什么都没有）：填同步码，看到那份存档，读档 ─────
  const second = await chrome.open(url, { init, isolated: true });
  await second.waitFor(hasButton('新开一局'), { what: '第二台设备的主菜单', timeoutMs: 30_000 });
  await openCloud(second);
  await second.waitFor(hasButton('用这个码'), { what: '填同步码的地方' });
  // 先填个不对的：要说得出哪里不对
  await second.evaluate(`(() => {
    const input = document.querySelector('dialog[open] input[type=text]');
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await second.clickButton('用这个码');
  await second.waitFor(hasText('同步码是 24–64 位'), { what: '同步码写错了的提示' });
  await second.evaluate(`(() => {
    const input = document.querySelector('dialog[open] input[type=text]');
    input.value = ${JSON.stringify(key)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await second.clickButton('用这个码');
  await second.waitFor(
    `document.querySelectorAll('dialog[open] [aria-label="读档接着打"]').length === 1`,
    {
      what: '第二台设备看到那份存档',
    },
  );
  await clickLabel(second, '读档接着打');
  await second.waitFor(
    `!document.querySelector('dialog[open]') && ${hasText(`第 ${savedDay} 天`)}`,
    {
      what: '读档接上了那一局',
      timeoutMs: 30_000,
    },
  );
  done(`第二台设备：填了同步码，看到那份存档，读档接上了第 ${savedDay} 天`);

  // ───── 第二台删掉它，第一台刷新之后也没有了 ─────
  await second.clickButton('菜单');
  await second.waitFor(hasButton('存档与回放'), { what: '第二台设备回到主菜单' });
  await openCloud(second);
  await second.waitFor(
    `document.querySelectorAll('dialog[open] [aria-label="删除"]').length === 1`,
    {
      what: '云端的那份存档',
    },
  );
  await clickLabel(second, '删除');
  await second.waitFor(hasText('云端还没有存档'), { what: '删掉之后云端空了' });
  await first.clickButton('刷新');
  await first.waitFor(hasText('云端还没有存档'), { what: '第一台设备刷新后也空了' });
  done('第二台设备删掉了那份存档，第一台刷新后也看不到了');

  for (const { name, page } of [
    { name: '第一台设备', page: first },
    { name: '第二台设备', page: second },
  ]) {
    if (page.errors.length) {
      throw new Error(
        `${name}的页面报了 ${page.errors.length} 个错：\n${page.errors.slice(0, 8).join('\n')}`,
      );
    }
  }
  console.log('云存档冒烟测试通过');
} catch (error) {
  console.error(`第 ${step + 1} 步没过：${error.message}`);
  process.exitCode = 1;
} finally {
  await chrome.close();
}
