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
  let placed: AnchorResult | undefined;
  const follow = followAnchor(
    root,
    () => anchor,
    floating,
    () => options,
    (result) => (placed ??= result),
  );
  stops.push(() => follow.stop());
  return { ...placed!, floating };
}

// 怎么翻面、怎么贴边的规则在 placement.test.ts；这里只核对“量”的那一半：坐标换成舞台里的、选项传得对
describe('贴着锚点摆', () => {
  it('元素锚点：位置是舞台里的坐标（减掉舞台在页面上的位置）', () => {
    // 按钮在页面的 (300, 250)，也就是舞台里的 (200, 200)，60×30
    expect(place(box(300, 250, 60, 30))).toMatchObject({
      x: 200,
      y: 236,
      side: 'bottom',
      align: 'start',
    });
  });

  it('可用的地方是整个舞台：下面放不下就翻到上面，右边出了舞台往回挪（离边 8 像素）', () => {
    // 舞台里的 (200, 560)：下面只剩 10 像素
    expect(place(box(300, 610, 60, 30))).toMatchObject({ x: 200, y: 514, side: 'top' });
    expect(place(box(100 + 760, 250, 30, 30)).x).toBe(800 - 120 - 8);
  });

  it('点锚点：点本身就是舞台里的坐标', () => {
    const options: AnchorOptions = { placement: 'top-start', offset: 10 };
    expect(place({ x: 400, y: 300 }, options)).toMatchObject({ x: 400, y: 250, side: 'top' });
    expect(place({ x: 400, y: 20 }, options)).toMatchObject({ x: 400, y: 30, side: 'bottom' });
  });

  it('matchWidth：至少和锚点一样宽', () => {
    expect(place(box(300, 250, 200, 30), { matchWidth: true }).floating.style.minWidth).toBe(
      '200px',
    );
  });

  it('fitHeight：最大高度是锚点下面剩下的地方（留出边距）', () => {
    // 锚点底边在舞台里的 230；按偏移 6 摆下去，离底边留 8
    expect(place(box(300, 250, 60, 30), { fitHeight: true }).floating.style.maxHeight).toBe(
      `${600 - 236 - 8}px`,
    );
  });
});
