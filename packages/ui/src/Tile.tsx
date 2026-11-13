/**
 * 图块：一个带图标的方块按钮，图标在上、名字在下、底下一行小字（价格、状态）。
 * 排成网格就是一面“可以做的事”：性状、科技、地区措施。
 *   state  owned 已经有了（或者开关开着）、locked 还不能要（前置没满足）、不写是可以要
 *   selected  正在看它的详情
 *
 *   <Tile icon={Wind} label="飞沫传播" detail="8 点" selected={id === current} onPress={() => select(id)} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { VNodeChild } from 'vue';
import { Icon, type IconData } from './Icon.tsx';
import { mergeAttrs, type PartProps } from './props.ts';
import { ripple, rippleHost } from './ripple.ts';
import { focusRing, pressable } from './styles.ts';
import { colors, fonts, space } from './tokens.ts';

export type TileState = 'available' | 'owned' | 'locked';

export interface TileProps extends PartProps<'button', 'type'> {
  icon?: IconData;
  label: VNodeChild;
  detail?: VNodeChild;
  state?: TileState;
  selected?: boolean;
  onPress?: () => void;
}

const styles = css.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minWidth: 0,
    minHeight: '4.5rem',
    padding: space.sm,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    lineHeight: 1.25,
    textAlign: 'center',
    color: { default: colors.text, ':disabled': colors.textMuted },
    backgroundColor: { default: colors.inset, ':hover:not(:disabled)': colors.insetHover },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: colors.line, ':hover:not(:disabled)': colors.lineStrong },
    pointerEvents: 'auto',
  },
  owned: {
    color: colors.signal,
    borderColor: { default: colors.signal, ':hover:not(:disabled)': colors.signal },
    backgroundColor: { default: colors.signalFaint, ':hover:not(:disabled)': colors.signalFaint },
  },
  locked: { color: colors.textMuted, borderStyle: 'dashed', opacity: 0.6 },
  // 正在看的那一块：一圈实线框（和键盘聚焦的那圈是同一个位置，颜色不同）
  selected: { boxShadow: `0 0 0 2px ${colors.text}` },
  detail: {
    fontFamily: fonts.numeric,
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    color: colors.textMuted,
  },
});

export const Tile = _component(
  ({ icon, label, detail, state = 'available', selected, onPress, ...rest }: TileProps) =>
    () => (
      <button
        {...mergeAttrs<'button'>(
          {
            sx: [
              rippleHost.root,
              focusRing.visible,
              pressable.root,
              styles.root,
              state === 'owned' && styles.owned,
              state === 'locked' && styles.locked,
              selected && styles.selected,
            ],
          },
          rest,
          { type: 'button', onClick: () => onPress?.(), ...ripple },
        )}
      >
        {icon && <Icon icon={icon} size="1.375rem" weight={1.75} />}
        <span>{label}</span>
        {detail != null && <span {...css.attrs(styles.detail)}>{detail}</span>}
      </button>
    ),
);
