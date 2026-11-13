/** 存档列表里的一行：左边是它是什么（病原体、第几天、哪一方、谁赢了、什么时候存的），右边是能对它做的事 */
import { ATTACKER } from '@miwang/sim';
import { ActionButton, colors, fonts, Icon, space, Stack, type IconData } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { i18n, useContent, useUi } from '../../i18n.ts';
import { pathogenIcon } from '../../icons.ts';
import type { SaveMeta } from '../../saves/recording.ts';

export interface SaveAction {
  readonly icon: IconData;
  /** 按钮只有图标：名字给读屏和悬停提示用 */
  readonly label: string;
  readonly onPress: () => void;
}

const styles = css.create({
  root: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: space.md,
    paddingBlock: space.sm,
    paddingInline: space.md,
    backgroundColor: colors.inset,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  name: { fontSize: '0.9375rem', color: colors.text },
  when: { fontFamily: fonts.numeric, fontSize: '0.75rem', color: colors.textMuted },
  buttons: { display: 'flex', gap: space.xs },
});

export const SaveRow = _component(
  ({
    save,
    actions,
    disabled = false,
  }: {
    save: SaveMeta;
    actions: readonly SaveAction[];
    /** 正忙着（上传、下载）的时候按钮先按不动 */
    disabled?: boolean;
  }) =>
    () => {
      const ui = useUi();
      const content = useContent();
      const when = new Intl.DateTimeFormat(i18n.locale.value === 'zh' ? 'zh-CN' : 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      return (
        <div {...css.attrs(styles.root)}>
          <Icon icon={pathogenIcon(save.pathogen)} size="1.5rem" weight={1.5} />
          <Stack gap="xs">
            <span {...css.attrs(styles.name)}>
              {content.pathogens[save.pathogen]?.name ?? save.pathogen} · {ui.status.day(save.day)}{' '}
              · {save.player === ATTACKER ? ui.controls.attacker : ui.controls.defender}
              {save.winner !== null &&
                ` · ${save.winner === save.player ? ui.outcome.won : ui.outcome.lost}`}
            </span>
            <span {...css.attrs(styles.when)}>{when.format(save.savedAt)}</span>
          </Stack>
          <div {...css.attrs(styles.buttons)}>
            {actions.map((action) => (
              <ActionButton
                key={action.label}
                compact
                icon={action.icon}
                aria-label={action.label}
                tip={action.label}
                disabled={disabled}
                onPress={action.onPress}
              />
            ))}
          </div>
        </div>
      );
    },
);
