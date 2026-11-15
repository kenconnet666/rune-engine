/**
 * 几样简单的盒子：横排 / 竖排、卡片、分隔线、标记、链接。
 */
import { Text, View, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { themed } from './theme';

export interface StackProps {
  /** 相邻两个之间空多少，默认 8 */
  gap?: number;
  /** 交叉轴上怎么对齐 */
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  style?: ViewStyle;
  children?: VNodeChild;
}

const stack = (flexDirection: 'row' | 'column') =>
  _component(({ gap = 8, align, justify, style, children }: StackProps) => () => (
    <View style={{ flexDirection, gap, alignItems: align, justifyContent: justify, ...style }}>
      {children}
    </View>
  ));
/** 横着排的一行 */
export const Row = stack('row');
/** 竖着排的一列 */
export const Column = stack('column');

const styles = themed(({ colors }) => ({
  card: {
    padding: 16,
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  divider: { height: 1, backgroundColor: colors.border },
  link: {
    color: colors.accentText,
    cursor: 'pointer',
    userSelect: 'none',
    hover: { color: colors.text },
  },
  neutral: badge(colors.hover, colors.muted),
  accent: badge(colors.accentSoft, colors.accentText),
  success: badge(colors.successSoft, colors.success),
  warning: badge(colors.warningSoft, colors.warning),
  danger: badge(colors.dangerSoft, colors.danger),
}));

function badge(backgroundColor: string, color: string): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 22,
    paddingInline: 8,
    borderRadius: 11,
    backgroundColor,
    color,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 500,
  };
}

/** 卡片：带边线和底色的一块，里面竖着排 */
export const Card = _component(
  ({ style, children }: { style?: ViewStyle; children?: VNodeChild }) =>
    () => <View style={style ? { ...styles().card, ...style } : styles().card}>{children}</View>,
);

/** 一条横线 */
export const Divider = _component(() => () => <View style={styles().divider} />);

/** 标记：一个小圆角标签，五种色调 */
export const Badge = _component(
  ({
    tone = 'neutral',
    children,
  }: {
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
    children?: VNodeChild;
  }) =>
    () => (
      <View style={styles()[tone]}>
        <Text>{children}</Text>
      </View>
    ),
);

/** 链接样子的一段字：点了叫 onPress（去哪由使用方定） */
export const Link = _component(
  ({
    onPress,
    style,
    children,
  }: {
    onPress?: () => void;
    style?: ViewStyle;
    children?: VNodeChild;
  }) =>
    () => (
      <Text
        style={style ? { ...styles().link, ...style } : styles().link}
        onClick={() => onPress?.()}
      >
        {children}
      </Text>
    ),
);
