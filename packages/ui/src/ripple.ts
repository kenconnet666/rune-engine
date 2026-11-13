/**
 * 波纹：按下时从指针的位置扩散出一圈半透明的颜色，松开后淡出（键盘按 Enter、空格时从中心扩散）。
 * 做法照搬 vue-tsx-pro 的 ripple，是它的精简版：纯 CSS 动画，时长取 tokens——系统开了“减少动态效果”时
 * 时长是 0，就只剩按下时变一下色。可以按的组件把 rippleHost.root 放进 sx、把 ripple 展开到元素上：
 *
 *   <button {...mergeAttrs<'button'>({ sx: [rippleHost.root, styles.root] }, rest, { ...ripple })} />
 */
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { durations } from './tokens.ts';

const expand = css.keyframes({
  from: { transform: 'scale(0)' },
  to: { transform: 'scale(1)' },
});

/** 宿主元素要有的样式：波纹相对它定位，超出的部分裁掉 */
export const rippleHost = css.create({
  root: { position: 'relative', overflow: 'hidden' },
});

const styles = css.create({
  ripple: {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
    // 跟着文字的颜色走：亮底上是深的，暗底上是浅的
    backgroundColor: 'color-mix(in srgb, currentColor 18%, transparent)',
    animationName: expand,
    animationDuration: durations.slow,
    animationTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    animationFillMode: 'forwards',
    transition: `opacity ${durations.normal}`,
  },
});

/** 淡出最多等这么久就把波纹拿掉（过渡被打断、时长是 0 时等不到过渡结束的事件） */
const REMOVE_AFTER_MS = 400;

const isDisabled = (host: Element) => host.matches(':disabled, [aria-disabled="true"]');

/** 在 event.currentTarget 上开始一个波纹；松开、移出、取消、失去焦点时淡出并移除 */
function startRipple(event: PointerEvent | KeyboardEvent) {
  const host = event.currentTarget;
  if (!(host instanceof HTMLElement) || isDisabled(host)) return;
  const keyboard = event instanceof KeyboardEvent;
  if (keyboard && (event.repeat || (event.key !== 'Enter' && event.key !== ' '))) return;
  if (!keyboard && event.button !== 0) return;

  const rect = host.getBoundingClientRect();
  const x = keyboard ? rect.width / 2 : event.clientX - rect.left;
  const y = keyboard ? rect.height / 2 : event.clientY - rect.top;
  // 圆心到最远的角的距离：扩散完正好盖满整个元素
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
  const ripple = document.createElement('span');
  ripple.setAttribute('aria-hidden', 'true');
  ripple.className = String(css.attrs(styles.ripple).class ?? '');
  Object.assign(ripple.style, {
    left: `${x - radius}px`,
    top: `${y - radius}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
  });
  host.append(ripple);

  const release = () => {
    for (const [type, target] of releases) target.removeEventListener(type, release);
    ripple.style.opacity = '0';
    setTimeout(() => ripple.remove(), REMOVE_AFTER_MS);
  };
  const releases: [string, EventTarget][] = keyboard
    ? [
        ['keyup', host],
        ['blur', host],
      ]
    : [
        ['pointerup', window],
        ['pointercancel', window],
        ['pointerleave', host],
      ];
  for (const [type, target] of releases) target.addEventListener(type, release);
}

/** 展开到宿主元素上的两个处理函数 */
export const ripple = { onPointerdown: startRipple, onKeydown: startRipple };
