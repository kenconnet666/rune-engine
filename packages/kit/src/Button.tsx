/**
 * 按钮：三种样子（实底、描边、只有字）、三种色调、两种大小。指着、按着各有反馈；不可用时变淡、点不到。
 * 上面的字不能被选中（拖着划过按钮不该把字选上）。
 */
import { Text, View, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { themed, type Theme } from './theme';

export interface ButtonProps {
  /** solid 实底（默认）、outline 描边、ghost 只有字 */
  variant?: 'solid' | 'outline' | 'ghost';
  /** accent 强调（默认）、neutral 中性、danger 危险 */
  tone?: 'accent' | 'neutral' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  onPress?: () => void;
  /** 另外加在按钮上的样式（比如 alignSelf） */
  style?: ViewStyle;
  children?: VNodeChild;
}

type Variant = NonNullable<ButtonProps['variant']>;
type Tone = NonNullable<ButtonProps['tone']>;
type Size = NonNullable<ButtonProps['size']>;

/** 一种色调在三种样子下各用什么颜色 */
function palette({ colors }: Theme, tone: Tone) {
  if (tone === 'neutral') {
    return {
      fill: colors.raised,
      fillHover: colors.hover,
      fillActive: colors.active,
      on: colors.text,
      ink: colors.text,
      soft: colors.hover,
      softActive: colors.active,
      line: colors.border,
    };
  }
  if (tone === 'danger') {
    return {
      fill: colors.danger,
      fillHover: colors.danger,
      fillActive: colors.danger,
      on: '#ffffff',
      ink: colors.danger,
      soft: colors.dangerSoft,
      softActive: colors.dangerSoft,
      line: colors.danger,
    };
  }
  return {
    fill: colors.accent,
    fillHover: colors.accentHover,
    fillActive: colors.accent,
    on: colors.accentContrast,
    ink: colors.accentText,
    soft: colors.accentSoft,
    softActive: colors.accentSoft,
    line: colors.accent,
  };
}

const styles = themed((theme) => {
  const made: Record<string, ViewStyle> = {};
  for (const variant of ['solid', 'outline', 'ghost'] as const) {
    for (const tone of ['accent', 'neutral', 'danger'] as const) {
      const p = palette(theme, tone);
      for (const size of ['sm', 'md'] as const) {
        const small = size === 'sm';
        made[`${variant}-${tone}-${size}`] = {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          height: small ? 28 : 34,
          paddingInline: small ? 10 : 14,
          borderRadius: 6,
          cursor: 'pointer',
          userSelect: 'none',
          fontSize: small ? 13 : 14,
          lineHeight: 20,
          fontWeight: 500,
          ...(variant === 'solid'
            ? {
                backgroundColor: p.fill,
                color: p.on,
                hover: { backgroundColor: p.fillHover },
                active: { backgroundColor: p.fillActive, opacity: 0.85 },
              }
            : variant === 'outline'
              ? {
                  borderWidth: 1,
                  borderColor: p.line,
                  color: p.ink,
                  hover: { backgroundColor: p.soft },
                  active: { backgroundColor: p.softActive, opacity: 0.85 },
                }
              : {
                  color: p.ink,
                  hover: { backgroundColor: p.soft },
                  active: { backgroundColor: p.softActive, opacity: 0.85 },
                }),
        };
      }
    }
  }
  return made;
});

const key = (variant: Variant, tone: Tone, size: Size) => `${variant}-${tone}-${size}`;
const DISABLED: ViewStyle = { opacity: 0.45, pointerEvents: 'none', cursor: 'default' };

export const Button = _component(
  ({
    variant = 'solid',
    tone = 'accent',
    size = 'md',
    disabled = false,
    onPress,
    style,
    children,
  }: ButtonProps) =>
    () => {
      const base = styles()[key(variant, tone, size)]!;
      const look =
        disabled || style ? { ...base, ...style, ...(disabled ? DISABLED : null) } : base;
      return (
        <View style={look} onClick={() => !disabled && onPress?.()}>
          <Text>{children}</Text>
        </View>
      );
    },
);
