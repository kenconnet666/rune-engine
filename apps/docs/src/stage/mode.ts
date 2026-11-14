/**
 * 文档站现在用哪种摆法：
 *   canvas  整站画进画布（界面由渲染线程合成）
 *   dom     叠在画布上面（普通网页的样子；浏览器不支持画进画布时也是它）
 * 两种摆法的元素结构完全一样，差别只在最后是谁把它画到屏幕上——所以可以拿来一一对比。
 * 地址里写 ?stage=dom 或 ?stage=canvas 可以指定（并且记住），没写就用上次的，都没有就是 canvas。
 */
export type StageMode = 'canvas' | 'dom';

const KEY = 'docs:stage';
const isMode = (value: unknown): value is StageMode => value === 'canvas' || value === 'dom';

function remembered(): StageMode | undefined {
  try {
    const value = localStorage.getItem(KEY);
    return isMode(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function fromAddress(): StageMode | undefined {
  const value = new URLSearchParams(location.search).get('stage');
  return isMode(value) ? value : undefined;
}

export const stageMode: StageMode = fromAddress() ?? remembered() ?? 'canvas';

/** 换一种摆法：记下来、整页重新加载（画布交给渲染线程之后收不回来，换摆法要一张新的画布） */
export function switchStageMode(next: StageMode) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // 存不了（隐私模式）就只靠地址
  }
  const url = new URL(location.href);
  url.searchParams.set('stage', next);
  location.assign(url);
}
