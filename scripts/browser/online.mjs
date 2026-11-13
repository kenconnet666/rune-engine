/**
 * 联机的冒烟测试：同一个无界面的 Chrome 里开两个页面，一个当主人、一个当客人，把联机从头走一遍——
 * 开房间、加入、选边、时间同步、客人能操作、两头各刷新一次都能接回来。
 * 先把游戏起起来，再跑：
 *   node scripts/browser/online.mjs [地址=http://localhost:5180] [--software] [--relay] [--expect=direct|relay]
 * 带联机服务的（pnpm online）测的是真的房间加 WebRTC；不带的（pnpm dev）测的是同一个浏览器里的房间。
 * --relay 不试直连，单测经房间中转这条路；--expect 要求消息最后走的是哪条路（不写就只报告，不要求）。
 */
import { launchChrome } from './chrome.mjs';

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:5180';
const software = args.includes('--software');
const relay = args.includes('--relay');
const expect =
  args.find((arg) => arg.startsWith('--expect='))?.slice('--expect='.length) ??
  (relay ? 'relay' : undefined);
/** 页面的地址：query 是 '?join=…' 这样的一段 */
const address = (query = '') => `${url}/${query}${relay ? `${query ? '&' : '?'}relay` : ''}`;

const chrome = await launchChrome({ software });
let step = 0;
const done = (what) => console.log(`${String(++step).padStart(2)}. ${what}`);
const init = `localStorage.setItem('miwang:locale', 'zh')`;
const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
const hasButton = (text) =>
  `[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}) && b.checkVisibility())`;
const day = (page) =>
  page.evaluate(`Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1] ?? -1)`);
const closeDialog = (page) => page.evaluate(`document.querySelector('dialog[open]')?.close()`);

try {
  // ───── 主人开房间 ─────
  const host = await chrome.open(address(), { init });
  await host.waitFor(hasButton('联机'), { what: '主人的主菜单', timeoutMs: 30_000 });
  await host.clickButton('联机');
  await host.waitFor(hasButton('开一个房间'), { what: '联机大厅' });
  await host.clickButton('开一个房间');
  await host.waitFor(`document.querySelector('[data-room-code]') && ${hasText('等对方进来')}`, {
    what: '房间开好',
  });
  const code = await host.evaluate(`document.querySelector('[data-room-code]').dataset.roomCode`);
  const local = await host.evaluate(hasText('没有接联机服务'));
  done(`主人开了房间 ${code}（${local ? '同一个浏览器里的房间' : '联机服务上的房间'}）`);

  // ───── 客人加入 ─────
  // 两位玩家各在自己的窗口里：都在前台，谁也不被浏览器降频
  const guest = await chrome.open(address(`?join=${code}`), { init, newWindow: true });
  await guest.waitFor(
    `${hasText('守方 · 上报态势')} && /第 [0-9]+ 天/.test(document.body.innerText)`,
    {
      what: '客人接上，扮演守方',
      timeoutMs: 30_000,
    },
  );
  await host.waitFor(hasText('对方已经进来了'), { what: '主人看到客人进来' });
  done('客人加入：主人是攻方，客人是守方');

  if (!local) {
    // 直连要商量一会儿；商量好之前（或者打不通时）消息经服务器中转
    const wanted = expect === 'relay' ? '经服务器中转' : '直连';
    try {
      await host.waitFor(hasText(`对方已经进来了。 ${wanted}`), {
        what: wanted,
        timeoutMs: 15_000,
      });
    } catch (error) {
      if (expect) throw error;
    }
    const direct = await host.evaluate(hasText('对方已经进来了。 直连'));
    done(`消息走的路：${direct ? '直连（WebRTC）' : '经服务器中转'}`);
  }

  // ───── 选边：主人换到守方，客人跟着换到攻方 ─────
  await host.clickButton('我扮演 · 守方');
  await guest.waitFor(hasText('攻方 · 真实态势'), { what: '客人换到攻方' });
  await host.waitFor(hasText('守方 · 上报态势'), { what: '主人换到守方' });
  done('选边：主人换到守方，客人换成了攻方');

  // ───── 时间两头同步；客人按暂停，两头都停 ─────
  await closeDialog(host);
  await host.waitFor(hasButton('继续这一局'), { what: '回到主菜单' });
  await host.clickButton('继续这一局');
  const start = await day(guest);
  await host.evaluate(`document.querySelector('[aria-label="10 倍速"]').click()`);
  await guest.waitFor(
    `Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1]) > ${start + 15}`,
    { what: '客人这头时间在走' },
  );
  await guest.evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const [hostDay, guestDay] = [await day(host), await day(guest)];
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if ((await day(host)) !== hostDay || (await day(guest)) !== guestDay || hostDay !== guestDay) {
    throw new Error(`客人按了暂停，两头没有停在同一天：${hostDay} / ${guestDay}`);
  }
  done(`时间同步：两头从第 ${start} 天走到第 ${guestDay} 天，客人按暂停后都停下`);

  // ───── 客人下命令：换一个性状（它现在是攻方） ─────
  await guest.clickButton('进化');
  await guest.waitFor(`document.querySelector('dialog[open]') && ${hasText('飞沫传播')}`, {
    what: '客人的进化工作台',
  });
  await guest.evaluate(`[...document.querySelectorAll('dialog[open] [role=tab]')][1].click()`);
  await guest.clickButton('咳嗽');
  await guest.waitFor(hasButton('换这个性状'), { what: '性状的详情和按钮' });
  await guest.clickButton('换这个性状');
  await closeDialog(guest);
  await guest.evaluate(`document.querySelector('[aria-label="1 倍速"]').click()`);
  await guest.waitFor(hasText('1 个性状'), { what: '客人换到了一个性状' });
  await guest.evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
  done('客人下的命令在主机上生效：换到了“咳嗽”');

  // ───── 客人刷新页面：自己接回来，还是原来那一方 ─────
  await guest.evaluate(`location.reload()`);
  await guest.waitFor(`${hasText('攻方 · 真实态势')} && ${hasText('1 个性状')}`, {
    what: '客人刷新后接回来',
    timeoutMs: 30_000,
  });
  done('客人刷新页面：接回来了，还是攻方，局面还在');

  // ───── 主人刷新页面：照着自动存档接上那一局，房间还是那个，客人自己连回来 ─────
  await host.evaluate(`location.reload()`);
  await host.waitFor(hasButton('继续这一局'), { what: '主人刷新后的主菜单', timeoutMs: 30_000 });
  await host.clickButton('继续这一局');
  await host.waitFor(hasText(`房间 ${code}`), { what: '主人这头又看到客人', timeoutMs: 30_000 });
  const before = await day(guest);
  await host.evaluate(`document.querySelector('[aria-label="10 倍速"]').click()`);
  await guest.waitFor(
    `Number(document.body.innerText.match(/第 ([0-9]+) 天/)?.[1]) > ${before + 10}`,
    { what: '主人刷新后客人这头时间又在走', timeoutMs: 30_000 },
  );
  await host.evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
  done('主人刷新页面：对局接上了，客人自己连了回来');

  // ───── 进不去的房间说得出原因（只有真的房间服务才知道“没有这个房间”） ─────
  if (!local) {
    const lost = await chrome.open(address('?join=ZZZZ99'), { init, newWindow: true });
    await lost.waitFor(hasText('没有这个房间'), { what: '不存在的房间', timeoutMs: 30_000 });
    done('不存在的房间：说了“没有这个房间”');
  }

  for (const { name, page } of [
    { name: '主人', page: host },
    { name: '客人', page: guest },
  ]) {
    if (page.errors.length) {
      throw new Error(
        `${name}的页面报了 ${page.errors.length} 个错：\n${page.errors.slice(0, 8).join('\n')}`,
      );
    }
  }
  console.log('联机冒烟测试通过');
} catch (error) {
  console.error(`第 ${step + 1} 步没过：${error.message}`);
  process.exitCode = 1;
} finally {
  await chrome.close();
}
