/**
 * 冒烟测试：在无界面的 Chrome 里把游戏从头到尾点一遍，确认主要的流程都走得通、页面没有报错。
 * 先把游戏起起来（开发时 pnpm dev；CI 里是构建好的静态文件），再跑：
 *   node scripts/browser/smoke.mjs [地址=http://localhost:5180] [--software] [--shots=目录]
 * --software 用软件实现的 WebGPU（没有显卡的机器）；--shots 在几个关键的地方截图存到那个目录。
 * 每一步做了什么都打出来；哪一步没等到就在那里失败，报错里带着当时页面上的文字。
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './chrome.mjs';
import {
  assertNoErrors,
  canPress,
  closeDialog,
  dayOf,
  dayPast,
  hasButton,
  hasText,
  LOCALE_INIT,
  mapColors,
  progress,
  readArgs,
  sleep,
} from './game.mjs';

const args = readArgs();
const shots = args.value('shots');
if (shots) mkdirSync(shots, { recursive: true });

const chrome = await launchChrome({ software: args.flag('software') });
const report = progress();
/** 放在外面：没过的时候还要拿它截一张图 */
let page;
try {
  page = await chrome.open(args.url, { init: LOCALE_INIT });
  /** 做完一步：报一行，要截图的话截一张 */
  const done = async (what) => {
    report(what);
    if (shots) await page.screenshot(join(shots, `${String(report.steps()).padStart(2, '0')}.png`));
  };

  await page.waitFor(hasButton('新开一局'), { what: '主菜单', timeoutMs: 30_000 });
  await done('主菜单出来了');

  await page.clickButton('设置');
  await page.waitFor(`document.querySelectorAll('input[type=range]').length === 5`, {
    what: '设置里的五个音量滑块',
  });
  await page.clickButton('EN');
  await page.waitFor(hasText('Language'), { what: '切到英文' });
  await page.clickButton('中文');
  await page.waitFor(hasText('语言'), { what: '切回中文' });
  await closeDialog(page);
  await page.waitFor(hasButton('百科'), { what: '回到主菜单' });
  await done('设置：音量滑块在，中英文能切换');

  await page.clickButton('百科');
  await page.waitFor(hasText('流感型'), { what: '百科里的病原体' });
  await page.evaluate(`[...document.querySelectorAll('[role=tab]')][1].click()`);
  await page.waitFor(hasText('飞沫传播'), { what: '百科里的性状' });
  await page.evaluate(`[...document.querySelectorAll('[role=tab]')][2].click()`);
  await page.waitFor(`${hasText('蛰伏')} && ${hasText('外溢')}`, { what: '百科里的技能' });
  await closeDialog(page);
  await page.waitFor(hasButton('新开一局'), { what: '回到主菜单' });
  await done('百科：病原体、性状和技能都看得到');

  await page.clickButton('关于与致谢');
  await page.waitFor(
    `document.querySelectorAll('dialog[open] [data-credit]').length >= 15 && ${hasText('Natural Earth')}`,
    { what: '关于与致谢里的致谢表' },
  );
  await closeDialog(page);
  await page.waitFor(hasButton('新开一局'), { what: '回到主菜单' });
  await done('关于与致谢：数据、参考、开源软件都列着');

  await page.clickButton('新开一局');
  await page.waitFor(hasButton('开始'), { what: '开局设置' });
  await page.clickButton('流感型');
  await page.waitFor(hasText('季节性流感'), { what: '流感型的介绍' });
  await page.clickButton('开始');
  await page.waitFor(`${hasText('流感型')} && /第 [0-9]+ 天/.test(document.body.innerText)`, {
    what: '对局开始',
  });
  // 显卡设备偶尔会丢一下（软件渲染的机器上尤其），渲染器自己会重建：给它一点时间恢复。
  // 一直不恢复才算没过，把页面上写的原因带出来
  try {
    await page.waitFor(`!${hasText('画面断了')}`, { what: '画面恢复', timeoutMs: 20_000 });
  } catch {
    const note = await page.evaluate(`document.body.innerText.match(/画面断了[^\\n]*/)?.[0]`);
    throw new Error(`渲染线程没起来：${note}\n控制台：${page.logs.slice(-8).join('\n')}`);
  }
  // 没报错不等于画出来了：直接数画布上的颜色（给渲染线程一点时间画出第一帧）
  let colors = 0;
  for (let waited = 0; waited < 50 && colors < 50; waited++) {
    colors = await mapColors(page);
    if (colors < 50) await sleep(200);
  }
  if (colors < 50) {
    const gpu = await page.evaluate(`(async () => {
      if (!navigator.gpu) return '没有 navigator.gpu';
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return 'requestAdapter 给的是 null';
      return '适配器 ' + [adapter.info.vendor, adapter.info.architecture, adapter.info.description].join(' / ');
    })()`);
    throw new Error(`地图没画出来：画布上只数得出 ${colors} 种颜色（WebGPU：${gpu}）`);
  }
  await done(`开局：选了流感型，对局开始，地图画出来了（画布上 ${colors} 种颜色）`);

  const before = await dayOf(page);
  await page.evaluate(`document.querySelector('[aria-label="10 倍速"]').click()`);
  await page.waitFor(dayPast(before + 20), { what: '时间在走' });
  await page.evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
  // 开局十来天就会发第一件短期任务：这时要么手里有一件，要么已经有了结果（新闻里有）、正等下一件
  await page.waitFor(
    `document.querySelector('[data-task]') || ${hasText('任务完成')} || ${hasText('任务没做到')}`,
    { what: '短期任务' },
  );
  await done(`时间在走：从第 ${before} 天到了第 ${await dayOf(page)} 天，短期任务发下来了`);

  // 图层：换到“传播数”，地图照样有东西；再换回来
  await page.evaluate(`document.querySelector('[aria-label="传播数"]').click()`);
  await page.waitFor(`document.querySelector('[data-layer="reproduction"]')`, {
    what: '传播数图层',
  });
  await sleep(900);
  const layerColors = await mapColors(page);
  if (layerColors < 20) throw new Error(`传播数图层没画出来：只有 ${layerColors} 种颜色`);
  await page.evaluate(`document.querySelector('[aria-label="感染"]').click()`);
  await page.waitFor(`document.querySelector('[data-layer="infection"]')`, {
    what: '换回感染图层',
  });
  // 地区榜：有上榜的地区，点第一名，右边出现它的详情
  await page.waitFor(`document.querySelectorAll('[data-board] ol button').length > 0`, {
    what: '地区榜上有地区',
  });
  await page.evaluate(`document.querySelector('[data-board] ol button').click()`);
  await page.waitFor(hasText('传播数'), { what: '选中地区后的传播数' });
  // 点地区榜会让地图飞过去放大：回到整张地图，后面按固定的位置点地图的那一步才点得准
  await page.evaluate(`document.querySelector('[aria-label="回到整张地图"]').click()`);
  await sleep(800);
  await done('图层能切换，地区榜点得动');

  await page.clickButton('进化');
  await page.waitFor(`document.querySelector('dialog[open]') && ${hasText('飞沫传播')}`, {
    what: '进化的工作台',
  });
  // 换“咳嗽”：它的价格比开局给的变异点低，什么时候都换得起
  await page.evaluate(`[...document.querySelectorAll('dialog[open] [role=tab]')][1].click()`);
  await page.clickButton('咳嗽');
  await page.waitFor(hasButton('换这个性状'), { what: '性状的详情和按钮' });
  await page.clickButton('换这个性状');
  // 时间还停着：命令是立刻生效的
  await page.waitFor(hasText('1 个性状'), { what: '换到了一个性状' });
  await closeDialog(page);
  // 对话框有一小段离场动画，动画完了才从页面上拿掉：等它真的没了，免得下一步点开的工作台被这次的“关上”一并带走
  await page.waitFor(`!document.querySelector('dialog')`, { what: '工作台关上' });
  await page.evaluate(`document.querySelector('[aria-label="1 倍速"]').click()`);
  await done('进化：换到了“咳嗽”（时间停着时下的命令立刻生效）');

  // 攻方的技能排在病原体面板里；刚换的性状能退掉（返还一部分点数）
  await page.waitFor(`document.querySelectorAll('[data-skill]').length === 3`, {
    what: '攻方的三个技能',
  });
  await page.clickButton('进化');
  await page.waitFor(`document.querySelector('dialog[open]') && ${hasText('飞沫传播')}`, {
    what: '进化的工作台',
  });
  await page.evaluate(`[...document.querySelectorAll('dialog[open] [role=tab]')][1].click()`);
  await page.clickButton('咳嗽');
  await page.waitFor(canPress('退掉它'), { what: '已有性状的“退掉它”' });
  await page.clickButton('退掉它');
  await page.waitFor(hasText('0 个性状'), { what: '性状退掉了' });
  await closeDialog(page);
  await page.waitFor(`!document.querySelector('dialog')`, { what: '工作台关上' });
  await done('技能在；退化：把“咳嗽”退掉了');

  await page.clickButton('守方');
  await page.waitFor(hasText('守方 · 上报态势'), { what: '换到守方' });
  await page.clickButton('安排研究');
  await page.waitFor(`document.querySelector('dialog[open]') && ${hasText('病原鉴定')}`, {
    what: '研究的工作台',
  });
  await closeDialog(page);
  await done('换到守方：研究的工作台打得开');

  // 点地图中间偏右（亚洲）选一个地区，守方应该看到措施
  // 上一步关掉的对话框还有一小段离场动画，这时点下去会点在它上面：没选中就再点
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.click(1180, 330);
    await sleep(500);
    if (await page.evaluate(hasText('加强检测'))) break;
  }
  await page.waitFor(hasText('加强检测'), { what: '选中地区之后的措施' });
  await done('地图：点选一个地区，出现它的措施');

  // 守方的操作。命令到下一天才生效，所以让时间走着
  await page.evaluate(`document.querySelector('[aria-label="1 倍速"]').click()`);
  const measure = (id) => `document.querySelector('[data-measure="${id}"]')`;
  const preset = (id) => `document.querySelector('[data-preset="${id}"]')`;
  await page.clickButton('轻');
  await page.evaluate(`${measure('testing')}.click()`);
  await page.waitFor(`${measure('testing')}?.dataset.level === '1'`, {
    what: '“加强检测”开到轻的那一档',
  });
  await page.clickButton('预案与推广');
  await page.waitFor(`${preset('contain')} && !${preset('contain')}.disabled`, {
    what: '“围堵”预案',
  });
  await page.evaluate(`${preset('contain')}.click()`);
  // 这里已经是预案的样子时，那块预案亮着、点不动
  await page.waitFor(`${preset('contain')}?.disabled`, { what: '“围堵”预案生效' });
  await page.clickButton('措施');
  await page.waitFor(`${measure('lockdown')}?.dataset.level === '3'`, { what: '封锁开到了全力' });
  await done('措施：分档开了一项，再用预案一次设到位');

  // 换到守方之前电脑替守方管着：队伍可能已经在这里（不用再派），也可能三支都派去了别处
  // （没有待命的，“派应急队来这里”按不动：从指挥面板把第一支调过来）
  if (!(await page.evaluate(hasButton('召回这里的应急队')))) {
    if (await page.evaluate(canPress('派应急队来这里'))) {
      await page.clickButton('派应急队来这里');
    } else {
      await page.evaluate(
        `document.querySelector('[data-team="0"] [aria-label="派到选中的地区"]').click()`,
      );
    }
  }
  await page.waitFor(
    `document.querySelector('[data-mark="team"]') && ${hasButton('召回这里的应急队')}`,
    { what: '应急队出发，地图上有它的标记' },
  );
  await page.clickButton('开发布会');
  await page.waitFor(`${hasText('开了发布会')} && !${canPress('开发布会')}`, {
    what: '发布会开了，进入冷却',
  });
  await done('指挥：派出应急队，开了发布会');

  await page.clickButton('菜单');
  await page.waitFor(hasButton('继续这一局'), { what: '主菜单里的“继续”' });
  await done('菜单：回到主菜单，可以继续');

  await page.clickButton('存档与回放');
  await page.waitFor(canPress('存下这一局'), { what: '存档页' });
  await page.clickButton('存下这一局');
  await page.waitFor(hasText('存好了'), { what: '存档成功' });
  await page.evaluate(`document.querySelector('[aria-label="从头回放"]').click()`);
  await page.waitFor(hasButton('退出回放'), { what: '回放的进度条' });
  await page.waitFor(hasText(' 天 / 共 '), { what: '回放的进度' });
  // 回放时不能操作：进化、研究、发布会的入口都不在
  if (
    await page.evaluate(
      `${hasButton('进化')} || ${hasButton('安排研究')} || ${hasButton('开发布会')}`,
    )
  ) {
    throw new Error('回放时还能看到进化、研究或发布会的入口');
  }
  await page.clickButton('退出回放');
  await page.waitFor(`!${hasButton('退出回放')} && /第 [0-9]+ 天/.test(document.body.innerText)`, {
    what: '退出回放，回到自己的那一局',
  });
  await done('存档与回放：存了一份，从头回放，再退出来');

  assertNoErrors({ 游戏: page });
  console.log('冒烟测试通过');
} catch (error) {
  console.error(`第 ${report.steps() + 1} 步没过：${error.message}`);
  // 没过的那一刻画面是什么样：存下来（CI 里会作为构件传上去）
  if (shots && page) await page.screenshot(join(shots, 'failed.png')).catch(() => {});
  process.exitCode = 1;
} finally {
  await chrome.close();
}
