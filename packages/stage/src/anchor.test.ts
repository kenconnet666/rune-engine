import { afterEach, describe, expect, it } from 'vitest';
import {
  followAnchor,
  type AnchorOptions,
  type AnchorResult,
  type AnchorTarget,
} from './anchor.ts';

/** 模拟的 DOM 不排版：元素的位置、大小在这里直接给 */
function box(left: number, top: number, width: number, height: number) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height);
  Object.defineProperties(element, {
    offsetWidth: { value: width },
    offsetHeight: { value: height },
    clientWidth: { value: width },
    clientHeight: { value: height },
  });
  document.body.append(element);
  return element;
}

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

/** 舞台在页面的 (100, 50)，800×600；浮着的那一层 120×40。返回头一次算出来的位置 */
function place(anchor: AnchorTarget, options: AnchorOptions = {}) {
  const root = box(100, 50, 800, 600);
  const floating = box(0, 0, 120, 40);
  return new Promise<AnchorResult & { floating: HTMLElement }>((resolve) => {
    const follow = followAnchor(
      root,
      () => anchor,
      floating,
      () => options,
      (result) => resolve({ ...result, floating }),
    );
    stops.push(() => follow.stop());
  });
}

describe('贴着锚点摆', () => {
  it('元素锚点：位置是舞台里的坐标（减掉舞台在页面上的位置）', async () => {
    // 按钮在页面的 (300, 250)，也就是舞台里的 (200, 200)，60×30
    const result = await place(box(300, 250, 60, 30));
    expect(result).toMatchObject({ x: 200, y: 236, placement: 'bottom-start' });
  });

  it('下面放不下就翻到上面', async () => {
    // 舞台里的 (200, 560)：下面只剩 10 像素
    const result = await place(box(300, 610, 60, 30));
    expect(result).toMatchObject({ x: 200, y: 514, placement: 'top-start' });
  });

  it('靠左对齐放不下：换成靠右对齐', async () => {
    // 舞台里的 x=760、宽 30：右边对齐到 790
    const result = await place(box(100 + 760, 250, 30, 30));
    expect(result).toMatchObject({ x: 790 - 120, placement: 'bottom-end' });
  });

  it('怎么对齐都出了舞台：往回挪，离边至少 8 像素', async () => {
    const result = await place(box(100 + 785, 250, 30, 30));
    expect(result.x).toBe(800 - 120 - 8);
  });

  it('点锚点：在点的右上方，上面放不下翻到下面', async () => {
    const options: AnchorOptions = {
      placement: 'top-start',
      offset: { mainAxis: 10, crossAxis: 14 },
    };
    expect(await place({ x: 400, y: 300 }, options)).toMatchObject({
      x: 414,
      y: 250,
      placement: 'top-start',
    });
    expect(await place({ x: 400, y: 20 }, options)).toMatchObject({
      x: 414,
      y: 30,
      placement: 'bottom-start',
    });
  });

  it('matchWidth：至少和锚点一样宽', async () => {
    const result = await place(box(300, 250, 200, 30), { matchWidth: true });
    expect(result.floating.style.minWidth).toBe('200px');
  });

  it('fitHeight：最大高度是锚点下面剩下的地方（留出边距）', async () => {
    // 锚点底边在舞台里的 230；按偏移 6 摆下去，离底边留 8
    const result = await place(box(300, 250, 60, 30), { fitHeight: true });
    expect(result.floating.style.maxHeight).toBe(`${600 - 236 - 8}px`);
  });
});
