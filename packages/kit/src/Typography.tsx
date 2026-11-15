/**
 * 文字：标题、段落、说明、标签。都是一段字（view 包的 Text）配上字号、字重、颜色。
 * 一段字里现在只能是一种样式（不能中间夹一个加粗的词、一段行内代码）：要不同样式就分成几段。
 */
import { Text, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { isVNode, Text as VueText, type VNodeChild } from 'vue';
import { themed } from './theme';

const styles = themed(({ colors }) => ({
  h1: { fontSize: 28, lineHeight: 38, fontWeight: 700, color: colors.text },
  h2: { fontSize: 20, lineHeight: 30, fontWeight: 600, color: colors.text },
  h3: { fontSize: 16, lineHeight: 26, fontWeight: 600, color: colors.text },
  paragraph: { fontSize: 14, lineHeight: 24, color: colors.text },
  muted: { fontSize: 14, lineHeight: 24, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  label: { fontSize: 13, lineHeight: 20, fontWeight: 500, color: colors.text },
}));

/**
 * 写在 TSX 里的一长段中文，换行的地方会被接成一个空格——两个汉字（或者中文标点）之间不该有它，去掉。
 * 英文单词之间、中英文之间的空格留着
 */
const CJK = '[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]';
const JOINED = new RegExp(`(?<=${CJK}) (?=${CJK})`, 'g');
const tidy = (children: VNodeChild): VNodeChild => {
  if (typeof children === 'string') return children.replace(JOINED, '');
  if (Array.isArray(children)) return children.map((child) => tidy(child as VNodeChild));
  // 编译出来的文字是一个“文字节点”：取它里面的字
  if (isVNode(children) && children.type === VueText && typeof children.children === 'string') {
    return children.children.replace(JOINED, '');
  }
  return children;
};

export interface TextProps {
  /** 另外加的样式（叠在自带的上面） */
  style?: ViewStyle;
  children?: VNodeChild;
}

const variant = (name: keyof ReturnType<typeof styles>) =>
  _component(({ style, children }: TextProps) => () => (
    <Text style={style ? { ...styles()[name], ...style } : styles()[name]}>{tidy(children)}</Text>
  ));

/** 页面的大标题、小节的标题、小节里的小标题 */
export const Heading = _component(
  ({ level = 2, style, children }: TextProps & { level?: 1 | 2 | 3 }) =>
    () => {
      const base = styles()[level === 1 ? 'h1' : level === 3 ? 'h3' : 'h2'];
      return <Text style={style ? { ...base, ...style } : base}>{tidy(children)}</Text>;
    },
);
/** 一段正文：放不下就折行 */
export const Paragraph = variant('paragraph');
/** 次要的一段话（颜色淡一些） */
export const Muted = variant('muted');
/** 小字的说明 */
export const Caption = variant('caption');
/** 控件旁边的名字 */
export const Label = variant('label');
