/**
 * 代码块：等宽字体，照原样的换行和缩进；太宽了能横着滚（Shift 加滚轮）；右上角一个“复制”。
 * 代码里的字也可以拖着选、Ctrl+C 复制。
 */
import { Text, View } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { MONO, themed } from './theme';

const styles = themed(({ colors }) => ({
  block: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.code,
  },
  scroll: { overflow: 'scroll', padding: 14 },
  // 按内容那么宽（不跟着盒子撑满）：比盒子宽的时候才有得横着滚
  code: {
    alignSelf: 'flex-start',
    whiteSpace: 'pre',
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  copy: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingInline: 8,
    borderRadius: 6,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    cursor: 'pointer',
    userSelect: 'none',
    hover: { color: colors.text, backgroundColor: colors.hover },
  },
}));

/** “已复制”显示多久（毫秒） */
const COPIED_MS = 1500;

export const CodeBlock = _component(({ code }: { code: string }) => {
  let copied = _state(false);
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      copied = true;
      setTimeout(() => (copied = false), COPIED_MS);
    });
  };
  return () => (
    <View style={styles().block}>
      <View style={styles().scroll}>
        <Text style={styles().code}>{code}</Text>
      </View>
      <View style={styles().copy} onClick={copy}>
        <Text>{copied ? '已复制' : '复制'}</Text>
      </View>
    </View>
  );
});
