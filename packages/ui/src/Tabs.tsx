/**
 * 标签页的那一排标签：几块内容里看哪一块。只管标签本身，内容由使用方按 value 自己换。
 * 每个标签可以带图标和一个小角标（数量、提示）。
 *
 *   <Tabs label="性状分组" tabs={[{ value: 'route', label: '传播途径', icon: Wind, badge: 3 }]} value={tab} onChange={setTab} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { Icon, type IconData } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { ripple, rippleHost } from './ripple.ts';
import { focusRing, pressable } from './styles.ts';
import { colors, fonts, space } from './tokens.ts';

export type TabValue = string | number;

export interface TabItem {
  value: TabValue;
  label: VNodeChild;
  icon?: IconData;
  /** 标签右边的小角标 */
  badge?: VNodeChild;
}

export interface TabsProps extends PartProps<'div', 'role' | 'aria-label' | 'onChange'> {
  /** 这排标签是切换什么的（读屏念它） */
  label: string;
  tabs: readonly TabItem[];
  value: TabValue;
  onChange?: (value: TabValue) => void;
}

const styles = css.create({
  root: {
    display: 'flex',
    gap: space.xs,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    pointerEvents: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    minHeight: '2.75rem',
    paddingInline: space.md,
    fontFamily: fonts.text,
    fontSize: '0.875rem',
    color: { default: colors.textMuted, ':hover': colors.text },
    backgroundColor: 'transparent',
    borderWidth: 0,
    // 选中的那条线压在整排的底线上
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    marginBottom: '-1px',
  },
  selected: { color: colors.signal, borderBottomColor: colors.signal },
  badge: {
    minWidth: '1.25rem',
    paddingInline: '0.3rem',
    fontFamily: fonts.numeric,
    fontSize: '0.75rem',
    lineHeight: '1.25rem',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.inset,
  },
});

export const Tabs = _component(({ label, tabs, value, onChange, ...rest }: TabsProps) => () => (
  <div {...mergeAttrs<'div'>({ sx: styles.root }, rest, { role: 'tablist', 'aria-label': label })}>
    {tabs.map((tab) => (
      <button
        key={tab.value}
        type="button"
        role="tab"
        aria-selected={tab.value === value}
        onClick={() => onChange?.(tab.value)}
        {...ripple}
        {...css.attrs(
          rippleHost.root,
          focusRing.inset,
          pressable.root,
          styles.tab,
          tab.value === value && styles.selected,
        )}
      >
        {tab.icon && <Icon icon={tab.icon} />}
        <span>{tab.label}</span>
        {tab.badge != null && <span {...css.attrs(styles.badge)}>{tab.badge}</span>}
      </button>
    ))}
  </div>
));
