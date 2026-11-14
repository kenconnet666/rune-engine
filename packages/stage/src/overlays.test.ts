import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createOverlayHost,
  OVERLAY_ORDER,
  type DismissReason,
  type OverlayHost,
  type OverlayOptions,
} from './overlays.ts';

/** 一个小舞台：root 下面一张“画布”（能聚焦）、hud 层，弹层的层用 layer() 加 */
let root: HTMLElement;
let canvas: HTMLElement;
let hud: HTMLElement;
let layers: { element: HTMLElement; order: number }[];
let host: OverlayHost;

function element(parent: Element, html = '') {
  const created = document.createElement('div');
  created.innerHTML = html;
  parent.append(created);
  return created;
}

/** 开一个弹层：自己占一层，里面是 html；dismissed 记下它被请去关了几回、为什么 */
function open(
  options: Partial<OverlayOptions> | ((layer: HTMLElement) => Partial<OverlayOptions>) = {},
  html = '',
) {
  const layer = element(root, html);
  const dismissed: DismissReason[] = [];
  const given = typeof options === 'function' ? options(layer) : options;
  const entry = host.open(layer, () => ({
    onDismiss: (reason) => dismissed.push(reason),
    ...given,
  }));
  layers.push({ element: layer, order: entry.order });
  host.sync();
  return { layer, entry, dismissed };
}

function click(target: Element, releaseOn: Element = target) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  releaseOn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
}

function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  root = element(document.body);
  canvas = element(root);
  canvas.tabIndex = 0;
  hud = element(root, '<button tabindex="0">界面上的按钮</button>');
  layers = [{ element: hud, order: 1 }];
  host = createOverlayHost({ root: () => root, layers: () => layers });
});
afterEach(() => {
  host.dispose();
  root.remove();
});

describe('上下', () => {
  it('后打开的在上面，都在 hud 上面、tips 下面', () => {
    const first = open();
    const second = open();
    expect(first.entry.order).toBe(OVERLAY_ORDER);
    expect(second.entry.order).toBeGreaterThan(first.entry.order);
    expect(second.entry.order).toBeLessThan(3);
  });

  it('全关了之后重新从头排', () => {
    open().entry.close();
    expect(open().entry.order).toBe(OVERLAY_ORDER);
  });
});

describe('模态', () => {
  it('打开时它下面的层不响应操作，关了恢复', () => {
    const below = open();
    const modal = open({ modal: true });
    expect(hud.hasAttribute('inert')).toBe(true);
    expect(below.layer.hasAttribute('inert')).toBe(true);
    expect(modal.layer.hasAttribute('inert')).toBe(false);
    modal.entry.close();
    expect(hud.hasAttribute('inert')).toBe(false);
    expect(below.layer.hasAttribute('inert')).toBe(false);
  });

  it('在它上面开的弹层照常能用', () => {
    open({ modal: true });
    const above = open();
    expect(above.layer.hasAttribute('inert')).toBe(false);
  });

  it('两个模态：关了上面的，下面那个还挡着', () => {
    const first = open({ modal: true });
    const second = open({ modal: true });
    expect(first.layer.hasAttribute('inert')).toBe(true);
    second.entry.close();
    expect(first.layer.hasAttribute('inert')).toBe(false);
    expect(hud.hasAttribute('inert')).toBe(true);
  });

  it('开着的时候加进来的层，在它下面的一样不响应', () => {
    open({ modal: true });
    const late = element(root);
    layers.push({ element: late, order: 1.5 });
    host.sync();
    expect(late.hasAttribute('inert')).toBe(true);
  });
});

describe('点外面', () => {
  it('在外面按下又松开：请它关', () => {
    const popup = open();
    click(hud);
    expect(popup.dismissed).toEqual(['outside']);
  });

  it('点在里面不关；在里面按下、拖到外面松开也不关', () => {
    const popup = open({}, '<span>里面</span>');
    click(popup.layer.firstElementChild!);
    click(popup.layer.firstElementChild!, hud);
    click(hud, popup.layer.firstElementChild!);
    expect(popup.dismissed).toEqual([]);
  });

  it('打开它的按钮算里面', () => {
    const trigger = hud.querySelector('button')!;
    const popup = open({ inside: () => [trigger] });
    click(trigger);
    expect(popup.dismissed).toEqual([]);
  });

  it('点在父弹层里只关子弹层', () => {
    const parent = open({}, '<span>父</span>');
    const child = open();
    click(parent.layer.firstElementChild!);
    expect(child.dismissed).toEqual(['outside']);
    expect(parent.dismissed).toEqual([]);
  });

  it('模态默认不因为点外面关，也不让这一下传到它下面的弹层', () => {
    const below = open();
    const modal = open({ modal: true });
    click(canvas);
    expect(modal.dismissed).toEqual([]);
    expect(below.dismissed).toEqual([]);
  });

  it('铺满的模态层：压暗的底不算里面，点它只关这一个模态', () => {
    const below = open();
    const modal = open(
      (layer) => ({ modal: true, outside: true, content: () => layer.firstElementChild }),
      '<section>面板</section>',
    );
    click(modal.layer.firstElementChild!);
    expect(modal.dismissed).toEqual([]);
    click(modal.layer);
    expect(modal.dismissed).toEqual(['outside']);
    expect(below.dismissed).toEqual([]);
  });

  it('不肯被点外面关的非模态弹层不挡路：它下面的照样被请去关', () => {
    const below = open();
    const sticky = open({ outside: false });
    click(hud);
    expect(sticky.dismissed).toEqual([]);
    expect(below.dismissed).toEqual(['outside']);
  });
});

describe('Esc', () => {
  it('只请最上面那个关', () => {
    const first = open();
    const second = open();
    const event = press('Escape');
    expect(second.dismissed).toEqual(['escape']);
    expect(first.dismissed).toEqual([]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('不理 Esc 的非模态弹层跳过去', () => {
    const first = open();
    open({ escape: false });
    press('Escape');
    expect(first.dismissed).toEqual(['escape']);
  });

  it('不理 Esc 的模态挡住它下面的', () => {
    const first = open();
    open({ modal: true, escape: false });
    press('Escape');
    expect(first.dismissed).toEqual([]);
  });

  it('里面的组件已经处理过的 Esc、输入法组字时的 Esc 不管', () => {
    const popup = open({}, '<input />');
    const input = popup.layer.querySelector('input')!;
    input.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
    press('Escape', {}, input);
    press('Escape', { isComposing: true });
    expect(popup.dismissed).toEqual([]);
  });

  it('都关了之后不再听', () => {
    const popup = open();
    popup.entry.close();
    expect(press('Escape').defaultPrevented).toBe(false);
  });
});

describe('焦点', () => {
  const MODAL =
    '<section tabindex="-1"><button tabindex="0">甲</button><button tabindex="0">乙</button></section>';

  it('模态打开时焦点进到它里面，关了还给原来的元素', () => {
    const trigger = hud.querySelector('button')!;
    trigger.focus();
    const modal = open({ modal: true }, MODAL);
    expect(modal.layer.contains(document.activeElement)).toBe(true);
    modal.entry.close();
    expect(document.activeElement).toBe(trigger);
  });

  it('里面有 autofocus 的元素就给它', () => {
    const modal = open({ modal: true }, '<button tabindex="0">甲</button><input autofocus />');
    expect(document.activeElement).toBe(modal.layer.querySelector('input'));
  });

  it('用户自己把焦点挪到了别处，关的时候不抢回来', () => {
    hud.querySelector('button')!.focus();
    const modal = open({ modal: true }, MODAL);
    const elsewhere = element(document.body, '<button tabindex="0">页面上别处的按钮</button>');
    elsewhere.querySelector('button')!.focus();
    modal.entry.close();
    expect(document.activeElement).toBe(elsewhere.querySelector('button'));
    elsewhere.remove();
  });

  it('焦点落到舞台上模态够不着的地方：往前走的拉回开头，往回走的拉到末尾', () => {
    const modal = open({ modal: true }, MODAL);
    const [first, last] = modal.layer.querySelectorAll('button');
    press('Tab');
    canvas.focus();
    expect(document.activeElement).toBe(first);
    press('Tab', { shiftKey: true });
    canvas.focus();
    expect(document.activeElement).toBe(last);
  });

  it('Tab 走到最后一个再按绕回开头，Shift+Tab 在开头绕到末尾；中间的不拦', () => {
    const modal = open({ modal: true }, MODAL);
    const [first, last] = modal.layer.querySelectorAll('button');
    last!.focus();
    expect(press('Tab', {}, last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(press('Tab', {}, first).defaultPrevented).toBe(false);
    expect(press('Tab', { shiftKey: true }, first).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('焦点在面板自己身上（刚打开）：Shift+Tab 到末尾，Tab 交给浏览器走到第一个', () => {
    const modal = open((layer) => ({ modal: true, content: () => layer.firstElementChild }), MODAL);
    const panel = modal.layer.firstElementChild!;
    expect(document.activeElement).toBe(panel);
    expect(press('Tab', {}, panel).defaultPrevented).toBe(false);
    expect(press('Tab', { shiftKey: true }, panel).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(modal.layer.querySelectorAll('button')[1]);
  });

  it('模态上面的弹层里的元素也在这一圈里', () => {
    const modal = open({ modal: true }, MODAL);
    const above = open({}, '<button tabindex="0">下拉里的一项</button>');
    const item = above.layer.querySelector('button')!;
    item.focus();
    expect(press('Tab', {}, item).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(modal.layer.querySelector('button'));
  });

  it('模态上面的弹层里的元素照常能聚焦', () => {
    open({ modal: true }, MODAL);
    const above = open({}, '<button tabindex="0">下拉里的一项</button>');
    const item = above.layer.querySelector('button')!;
    item.focus();
    expect(document.activeElement).toBe(item);
  });

  it('不是模态的弹层不动焦点', () => {
    const trigger = hud.querySelector('button')!;
    trigger.focus();
    open({}, '<button tabindex="0">一项</button>');
    expect(document.activeElement).toBe(trigger);
    canvas.focus();
    expect(document.activeElement).toBe(canvas);
  });
});
