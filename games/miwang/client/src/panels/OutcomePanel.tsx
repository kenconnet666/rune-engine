/** 结算：分出胜负之后盖在地图中间 */
import { OUTCOME_TEXT, regions } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, colors, Fact, fonts, Frame, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { amount, compact, percent } from './format.ts';

const styles = css.create({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'none',
  },
  panel: { width: '22rem', maxWidth: '90vw' },
  verdict: { fontFamily: fonts.text, fontSize: '1.5rem', letterSpacing: '0.2em' },
  won: { color: colors.calm },
  lost: { color: colors.danger },
});

export const OutcomePanel = _component(
  ({ view, onRestart }: { view: OutbreakView; onRestart?: () => void }) =>
    () => {
      const { outcome } = view;
      if (!outcome) return null;
      const won = outcome.winner === view.player;
      return (
        <div {...css.attrs(styles.root)}>
          <Frame title={`第 ${outcome.tick} 天 · 对局结束`} sx={styles.panel}>
            <span {...css.attrs(styles.verdict, won ? styles.won : styles.lost)}>
              {won ? '你赢了' : '你输了'}
            </span>
            <span>{OUTCOME_TEXT[outcome.reason]}</span>
            <Stack gap="xs">
              <Fact
                label={view.attacker ? '累计感染' : '累计上报'}
                value={compact.format(view.totals.infected)}
              />
              <Fact label="死亡" value={compact.format(view.totals.deaths)} />
              <Fact label="波及地区" value={`${view.totals.regions} / ${regions.length}`} />
              <Fact
                label="病原体的性状"
                value={view.pathogen.known ? view.pathogen.owned.length : '未知'}
              />
              <Fact label="完成的研究" value={view.defense.done.length} />
              <Fact label="公众信任" value={percent.format(view.defense.trust)} />
              <Fact label="经济损失" value={amount.format(view.defense.economyLost)} />
            </Stack>
            {onRestart && <ActionButton onPress={onRestart}>新开一局</ActionButton>}
          </Frame>
        </div>
      );
    },
);
