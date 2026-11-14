/**
 * 章节的冒烟测试：从主菜单进章节页，打第一章（攻方）——目标面板、教学提示、打到分出胜负、
 * 结算里的“下一章 / 再打一次”；再用守方开第三章；最后存一份、读回来，章节还在。
 *   node scripts/browser/chapters.mjs [地址=http://localhost:5180] [--software] [--shots=目录]
 * 第一章自己什么都不做，过不过得了看这一局的运气：两种结果各走各的后续，都算对。
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './chrome.mjs';
import {
  assertNoErrors,
  canPress,
  clickInDialog,
  closeDialog,
  dayOf,
  dayPast,
  hasButton,
  hasText,
  LOCALE_INIT,
  progress,
  readArgs,
} from './game.mjs';

const args = readArgs();
const shots = args.value('shots');
if (shots) mkdirSync(shots, { recursive: true });

const chrome = await launchChrome({ software: args.flag('software') });
const report = progress();
const chapterShown = (id) => `document.querySelector('section[data-chapter="${id}"]')`;

try {
  const page = await chrome.open(args.url, { init: LOCALE_INIT });
  const done = async (what) => {
    report(what);
    if (shots) await page.screenshot(join(shots, `${String(report.steps()).padStart(2, '0')}.png`));
  };
  const speed = (label) =>
    page.evaluate(`document.querySelector('[aria-label="${label}"]').click()`);

  // ───── 章节页 ─────
  await page.waitFor(hasButton('章节'), { what: '主菜单', timeoutMs: 30_000 });
  await page.clickButton('章节');
  await page.waitFor(
    `document.querySelectorAll('dialog[open] button[data-chapter]').length === 5 && ${hasText('不盈一握之迷惘')}`,
    { what: '章节页上的五章' },
  );
  if (shots) await page.screenshot(join(shots, '00-chapters.png'));
  await page.clickButton('开始这一章');
  await page.waitFor(`${chapterShown('bewilderment')} && ${hasText('还剩 150 天')}`, {
    what: '第一章开始：目标面板',
  });
  await page.waitFor(hasText('攻方 · 真实态势'), { what: '扮演的是攻方' });
  await done('章节页：五章都在；开了第一章“迷惘”，目标面板出来了');

  // ───── 教学提示：一次一句，点掉才给下一句 ─────
  await page.waitFor(`document.querySelector('[data-hint="goal"]')`, { what: '第一句提示' });
  await page.clickButton('知道了');
  await page.waitFor(`document.querySelector('[data-hint="time"]')`, { what: '第二句提示' });
  await page.clickButton('知道了');
  await done('教学提示：一句一句地给');

  // ───── 打到分出胜负 ─────
  await speed('10 倍速');
  await page.waitFor(dayPast(10), { what: '时间在走' });
  // 提示会一句句冒出来：都点掉（不点也不挡时间，只是把后面的结算挡在下面不好看）
  const outcomeShown = `${hasButton('再打一次这一章')}`;
  for (let waited = 0; waited < 120 && !(await page.evaluate(outcomeShown)); waited++) {
    if (await page.evaluate(hasButton('知道了'))) await page.clickButton('知道了');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await page.waitFor(outcomeShown, { what: '第一章分出胜负' });
  const passed = await page.evaluate(hasText('这一章通过了'));
  if (!passed && !(await page.evaluate(hasText('这一章没有通过')))) {
    throw new Error('结算里没有说这一章通过没有');
  }
  // 结算带着回顾：一个等级，和大事记（至少有“分出胜负”那一条）
  const review = await page.evaluate(`(() => {
    const panel = document.querySelector('[data-review]');
    return panel && { grade: panel.dataset.review, moments: panel.querySelectorAll('ol li').length };
  })()`);
  if (!review || !'SABCD'.includes(review.grade) || review.moments < 1) {
    throw new Error(`结算里的回顾不对：${JSON.stringify(review)}`);
  }
  await done(
    `第一章打完了：${passed ? '通过' : '没通过'}（第 ${await dayOf(page)} 天），评价 ${review.grade}，大事记 ${review.moments} 条`,
  );

  if (passed) {
    await page.clickButton('下一章');
    await page.waitFor(`${chapterShown('malice')} && ${hasText('第 0 天')}`, {
      what: '下一章“邪念”开始',
    });
    await done('通过之后去下一章：“邪念”开始了');
  } else {
    await page.clickButton('再打一次这一章');
    await page.waitFor(`${chapterShown('bewilderment')} && ${hasText('第 0 天')}`, {
      what: '第一章重新开始',
    });
    await done('没通过：再打一次，第一章从头开始');
  }

  // ───── 章节页上的记号；换守方开第三章 ─────
  await page.clickButton('菜单');
  await page.waitFor(hasButton('章节'), { what: '回到主菜单' });
  await page.clickButton('章节');
  await page.waitFor(
    `document.querySelectorAll('dialog[open] button[data-chapter]').length === 5`,
    {
      what: '章节页',
    },
  );
  if (passed && !(await page.evaluate(hasText('攻 ✓')))) {
    throw new Error('第一章用攻方通过了，章节页上没有打勾');
  }
  await page.evaluate(
    `document.querySelector('dialog[open] button[data-chapter="wilds"]').click()`,
  );
  await page.waitFor(hasText('爬过旷野'), { what: '第三章的介绍' });
  await clickInDialog(page, '守方');
  await page.waitFor(hasText('在它前面设卡'), { what: '守方的任务' });
  await page.clickButton('开始这一章');
  await page.waitFor(
    `${chapterShown('wilds')} && ${hasText('守方 · 上报态势')} && ${hasText('按上报算的')}`,
    { what: '第三章（守方）开始' },
  );
  await done('用守方开了第三章“旷野”：目标面板写明进度是按上报算的');

  // ───── 存一份、读回来：章节还在 ─────
  await page.clickButton('菜单');
  await page.waitFor(hasButton('存档与回放'), { what: '回到主菜单' });
  await page.clickButton('存档与回放');
  await page.waitFor(canPress('存下这一局'), { what: '存档页' });
  await page.clickButton('存下这一局');
  await page.waitFor(hasText('存好了'), { what: '存档成功' });
  await page.evaluate(`document.querySelector('dialog[open] [aria-label="读档接着打"]').click()`);
  await page.waitFor(`!document.querySelector('dialog[open]') && ${chapterShown('wilds')}`, {
    what: '读档之后还是第三章',
    timeoutMs: 30_000,
  });
  await closeDialog(page);
  await done('存档再读回来：还是这一章，目标和期限都在');

  assertNoErrors({ 游戏: page });
  console.log('章节冒烟测试通过');
} catch (error) {
  console.error(`第 ${report.steps() + 1} 步没过：${error.message}`);
  process.exitCode = 1;
} finally {
  await chrome.close();
}
