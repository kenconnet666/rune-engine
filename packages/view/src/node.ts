/**
 * 界面的节点树。节点不是网页元素：就是一个普通对象，记着样式、子节点、排好版之后的位置。
 * 种类只有两种元素——view（盒子）和 text（一行字），外加 Vue 要用的文字节点（#text）和占位的注释节点（#comment）。
 *
 * 位置（x、y）是相对父节点左上角的，所以挪动、滚动一棵子树不用重排它里面的东西。
 */
import { affectsLayout, NO_STYLE, type TextStyle, type ViewStyle } from './style.ts';
import type { TextMeasurer } from './text.ts';

export type ViewNodeType = 'root' | 'view' | 'text' | '#text' | '#comment';

/** 登记的一段文字：它的号、最近是第几帧用到的（见 display.ts） */
export interface ViewRunEntry {
  readonly id: number;
  usedAt: number;
}

export class ViewNode {
  parent: ViewNode | null = null;
  readonly children: ViewNode[] = [];
  /** 写在节点上的样式（没写是共用的那份空样式） */
  style: ViewStyle = NO_STYLE;
  /** 现在生效的样式：平常就是 style；指针在上面、按着的时候是叠了 hover / active 的那一份 */
  look: ViewStyle = NO_STYLE;
  /** 样式以外的属性：事件处理（onClick……）和使用方自己挂的东西 */
  props: Record<string, unknown> | null = null;
  /** #text 的内容；text 元素的是它里面的字连起来（排版时算好） */
  text = '';
  hovered = false;
  pressed = false;

  // —— 排版的结果
  /** 相对父节点左上角的位置、自己的大小（含内边距和边线） */
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  /** 里面的内容一共多大（比自己大就是溢出了，能滚的盒子靠它知道能滚多远） */
  contentWidth = 0;
  contentHeight = 0;
  /** 滚到哪了（内容往上、往左挪了多少） */
  scrollLeft = 0;
  scrollTop = 0;
  /** 子节点是顺着主轴一个接一个排的（位置递增）：找哪些露出来时可以二分 */
  flowAxis: 'x' | 'y' | null = null;
  /** text 元素用的文字样式、登记的文字段（见 display.ts；null 是还没登记，runEpoch 是哪一回登记的） */
  textStyle: TextStyle | null = null;
  run: ViewRunEntry | null = null;
  runEpoch = -1;

  // —— 排版的缓存：自己和子孙都没变、给的大小和传下来的文字样式也没变，就不用重排
  layoutDirty = true;
  givenWidth: number | undefined = undefined;
  givenHeight: number | undefined = undefined;
  /** 上回传进来的文字样式、据此算出往下传的那一份 */
  textIn: TextStyle | null = null;
  textOut: TextStyle | null = null;
  textLook: ViewStyle | null = null;

  readonly type: ViewNodeType;
  readonly tree: ViewTree;

  constructor(type: ViewNodeType, tree: ViewTree) {
    this.type = type;
    this.tree = tree;
  }

  /** 这棵子树里的字连起来（text 元素的内容） */
  get textContent(): string {
    if (this.type === '#text') return this.text;
    let text = '';
    for (const child of this.children) if (child.type !== '#comment') text += child.textContent;
    return text;
  }

  /** 最多能滚多远：内容比盒子多出来的那一截 */
  get maxScrollLeft(): number {
    return Math.max(0, this.contentWidth - this.width);
  }
  get maxScrollTop(): number {
    return Math.max(0, this.contentHeight - this.height);
  }

  /** 滚到哪（超出能滚的范围会收回来）；真的动了返回 true。只是内容挪了位置，不用重排 */
  scrollTo(left: number, top: number): boolean {
    const nextLeft = Math.max(0, Math.min(left, this.maxScrollLeft));
    const nextTop = Math.max(0, Math.min(top, this.maxScrollTop));
    if (nextLeft === this.scrollLeft && nextTop === this.scrollTop) return false;
    this.scrollLeft = nextLeft;
    this.scrollTop = nextTop;
    this.tree.invalidatePaint();
    return true;
  }

  /** 状态变了（指针进出、按下松开）：重新算生效的样式，变了的话该重排重排、该重画重画 */
  restyle(): void {
    const { style } = this;
    const hover = this.hovered ? style.hover : undefined;
    const active = this.pressed ? style.active : undefined;
    const next = hover || active ? { ...style, ...hover, ...active } : style;
    const before = this.look;
    this.look = next;
    if (affectsLayout(before, next)) this.tree.invalidateLayout(this);
    else this.tree.invalidatePaint();
  }
}

/** 一棵界面树：根节点，加上“哪里变了、要不要重排重画”的记账 */
export class ViewTree {
  readonly root: ViewNode;
  needsLayout = true;
  needsPaint = true;

  /**
   * measurer：量文字用的；changed：树变了（要重排或者重画）时叫一声，使用方据此安排下一次刷新
   */
  readonly measurer: TextMeasurer;
  private readonly changed: () => void;

  constructor(measurer: TextMeasurer, changed: () => void = () => {}) {
    this.measurer = measurer;
    this.changed = changed;
    this.root = new ViewNode('root', this);
  }

  /** 这个节点（的样式、内容、子节点）变了：它和它的祖先都要重排 */
  invalidateLayout(node: ViewNode | null): void {
    // 已经标过的节点，它的祖先也一定标过了
    for (let each = node; each && !each.layoutDirty; each = each.parent) each.layoutDirty = true;
    this.needsLayout = true;
    this.needsPaint = true;
    this.changed();
  }

  /** 只是画出来的样子变了（颜色、滚到哪）：不用重排 */
  invalidatePaint(): void {
    this.needsPaint = true;
    this.changed();
  }
}
