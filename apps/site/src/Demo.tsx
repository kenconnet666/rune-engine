/** 一个示例：名字、一句说明、能动的那一块、它的代码 */
import { Caption, CodeBlock, Heading, Muted, themed } from '@rune-engine/kit';
import { View } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';

const styles = themed(({ colors }) => ({
  root: { gap: 10 },
  stage: {
    padding: 20,
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
}));

export interface DemoProps {
  title: string;
  /** 一两句话说它演示的是什么 */
  note?: string;
  /** 这个示例的代码（照着写就能得到上面那一块） */
  code?: string;
  children?: VNodeChild;
}

export const Demo = _component(({ title, note, code, children }: DemoProps) => () => (
  <View style={styles().root}>
    <Heading level={3}>{title}</Heading>
    {note && <Muted>{note}</Muted>}
    <View style={styles().stage}>{children}</View>
    {code && <CodeBlock code={code} />}
  </View>
));

/** 示例里用的小色块：看排版时当“一个子节点” */
export const Block = _component(
  ({
    label,
    width,
    height = 36,
    grow,
  }: {
    label: string;
    width?: number;
    /** 多高；'auto' 是不定（由内容或者父节点的对齐来定） */
    height?: number | 'auto';
    grow?: number;
  }) =>
    () => (
      <View
        style={{
          ...blockStyles().block,
          width,
          height: height === 'auto' ? undefined : height,
          flexGrow: grow,
        }}
      >
        <Caption style={blockStyles().label}>{label}</Caption>
      </View>
    ),
);

const blockStyles = themed(({ colors }) => ({
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingInline: 10,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  label: { color: colors.accentText },
}));
