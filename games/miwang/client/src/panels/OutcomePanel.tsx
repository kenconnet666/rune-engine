/** 结算：分出胜负之后盖在地图中间 */
import { regions } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, colors, Fact, fonts, Frame, Icon, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { RotateCcw, Skull, Trophy } from 'lucide';
import { useContent, useFormats, useUi } from '../i18n.ts';

const styles = css.create({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'none',
  },
  panel: { width: '23rem', maxWidth: '90vw' },
  verdict: {
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    fontFamily: fonts.text,
    fontSize: '1.5rem',
    letterSpacing: '0.15em',
  },
  won: { color: colors.calm },
  lost: { color: colors.danger },
});

export const OutcomePanel = _component(
  ({ view, onRestart }: { view: OutbreakView; onRestart?: () => void }) =>
    () => {
      const { outcome } = view;
      if (!outcome) return null;
      const ui = useUi().outcome;
      const content = useContent();
      const format = useFormats();
      const won = outcome.winner === view.player;
      return (
        <div {...css.attrs(styles.root)}>
          <Frame title={ui.title(outcome.tick)} sx={styles.panel}>
            <span {...css.attrs(styles.verdict, won ? styles.won : styles.lost)}>
              <Icon icon={won ? Trophy : Skull} size="1.75rem" />
              {won ? ui.won : ui.lost}
            </span>
            <span>{content.outcomes[outcome.reason]}</span>
            <Stack gap="xs">
              <Fact
                label={view.attacker ? ui.infected : ui.reported}
                value={format.compact(view.totals.infected)}
              />
              <Fact label={ui.deaths} value={format.compact(view.totals.deaths)} />
              <Fact label={ui.regions} value={`${view.totals.regions} / ${regions.length}`} />
              <Fact
                label={ui.traits}
                value={view.pathogen.known ? view.pathogen.owned.length : ui.unknown}
              />
              <Fact label={ui.techs} value={view.defense.done.length} />
              <Fact label={ui.trust} value={format.percent(view.defense.trust)} />
              <Fact label={ui.economy} value={format.amount(view.defense.economyLost)} />
            </Stack>
            {onRestart && (
              <ActionButton icon={RotateCcw} onPress={onRestart}>
                {ui.restart}
              </ActionButton>
            )}
          </Frame>
        </div>
      );
    },
);
