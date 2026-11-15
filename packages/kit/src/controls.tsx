/**
 * 几样小控件：开关、页签、侧栏里的导航项。状态由使用方拿着（checked、active），点了叫回调。
 */
import { Text, View, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { themed } from './theme';

const styles = themed(({ colors }) => ({
  switchOff: track(colors.active),
  switchOn: track(colors.accent),
  knobOff: knob(2),
  knobOn: knob(18),
  tabs: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 8,
    padding: 3,
    alignSelf: 'flex-start',
    backgroundColor: colors.hover,
  },
  tab: tab(undefined, colors.muted, colors.active),
  tabActive: tab(colors.raised, colors.text),
  nav: nav(undefined, colors.muted, colors.hover),
  navActive: nav(colors.accentSoft, colors.accentText),
}));

function track(backgroundColor: string): ViewStyle {
  return { width: 36, height: 20, borderRadius: 10, backgroundColor, cursor: 'pointer' };
}
function knob(left: number): ViewStyle {
  return {
    position: 'absolute',
    left,
    top: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    pointerEvents: 'none',
  };
}
function tab(backgroundColor: string | undefined, color: string, hover?: string): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    paddingInline: 12,
    borderRadius: 6,
    backgroundColor,
    color,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 500,
    cursor: 'pointer',
    userSelect: 'none',
    hover: hover ? { backgroundColor: hover } : undefined,
  };
}
function nav(backgroundColor: string | undefined, color: string, hover?: string): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingInline: 10,
    borderRadius: 6,
    backgroundColor,
    color,
    fontSize: 14,
    lineHeight: 20,
    cursor: 'pointer',
    userSelect: 'none',
    hover: hover ? { backgroundColor: hover } : undefined,
  };
}

/** 开关 */
export const Switch = _component(
  ({ checked = false, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) =>
    () => (
      <View
        style={checked ? styles().switchOn : styles().switchOff}
        onClick={() => onChange?.(!checked)}
      >
        <View style={checked ? styles().knobOn : styles().knobOff} />
      </View>
    ),
);

/** 页签：一排名字，选中的那个垫一块底 */
export const Tabs = _component(
  ({
    tabs,
    active = 0,
    onChange,
  }: {
    tabs: readonly string[];
    active?: number;
    onChange?: (index: number) => void;
  }) =>
    () => (
      <View style={styles().tabs}>
        {tabs.map((name, index) => (
          <View
            key={name}
            style={index === active ? styles().tabActive : styles().tab}
            onClick={() => onChange?.(index)}
          >
            <Text>{name}</Text>
          </View>
        ))}
      </View>
    ),
);

/** 侧栏里的一项导航 */
export const NavItem = _component(
  ({
    active = false,
    onPress,
    children,
  }: {
    active?: boolean;
    onPress?: () => void;
    children?: VNodeChild;
  }) =>
    () => (
      <View style={active ? styles().navActive : styles().nav} onClick={() => onPress?.()}>
        <Text>{children}</Text>
      </View>
    ),
);
