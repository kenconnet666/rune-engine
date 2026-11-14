/**
 * 提示气泡的行为：指针停在带 data-tip 的元素上（或者键盘聚焦到它）一小会儿，对应的气泡出现在它旁边。
 * 气泡是舞台 tips 层里的一个普通元素（见 Tip.tsx），不靠浏览器的 popover——那在页面“顶层”，画不进画布。
 * 所以摆在哪要自己算：默认在触发元素的上方居中，上面放不下就翻到下方，左右不超出舞台。
 */

/** 停多久才出现（毫秒）：划过去的时候不闪 */
const DELAY_MS = 350;
/** 气泡离触发元素、离舞台边缘的距离（像素） */
const GAP = 8;

/**
 * 在 root（舞台）上认提示的触发，气泡到 host（tips 层）里去找；返回停止的函数
 */
export function attachTips(root: HTMLElement, host: () => HTMLElement | null): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown: HTMLElement | null = null;

  const hide = () => {
    clearTimeout(timer);
    shown?.removeAttribute('data-open');
    shown = null;
  };

  const show = (trigger: Element) => {
    const id = trigger.getAttribute('data-tip');
    const tip = id ? host()?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
    if (!tip) return;
    hide();
    const stage = root.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = tip;
    const above = anchor.top - stage.top - GAP - height;
    const top = above >= GAP ? above : anchor.bottom - stage.top + GAP;
    const centered = anchor.left - stage.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(GAP, centered), Math.max(GAP, stage.width - width - GAP));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.setAttribute('data-open', '');
    shown = tip;
  };

  const triggerOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest('[data-tip]') : null;

  const over = (event: PointerEvent) => {
    // 触屏没有“停留”：长按会出菜单，不在这里凑
    if (event.pointerType !== 'mouse') return;
    const trigger = triggerOf(event.target);
    clearTimeout(timer);
    if (trigger) timer = setTimeout(() => show(trigger), DELAY_MS);
  };
  const out = (event: PointerEvent) => {
    const trigger = triggerOf(event.target);
    // 还在同一个触发元素里面挪动不算离开
    if (trigger && trigger.contains(event.relatedTarget as Node | null)) return;
    hide();
  };
  const focus = (event: FocusEvent) => {
    const trigger = triggerOf(event.target);
    // 只有键盘走到它身上才出：鼠标点一下按钮不该冒气泡
    if (trigger && trigger.matches(':focus-visible')) show(trigger);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') hide();
  };

  root.addEventListener('pointerover', over);
  root.addEventListener('pointerout', out);
  root.addEventListener('pointerdown', hide);
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', hide);
  root.addEventListener('keydown', key);
  return () => {
    hide();
    root.removeEventListener('pointerover', over);
    root.removeEventListener('pointerout', out);
    root.removeEventListener('pointerdown', hide);
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', hide);
    root.removeEventListener('keydown', key);
  };
}
