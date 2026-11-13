/** 结算：分出胜负之后盖在地图中间 */
import { regions, type ChapterId } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import {
  ActionButton,
  Chart,
  colors,
  Fact,
  fonts,
  Frame,
  Icon,
  Note,
  space,
  Stack,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { ArrowRight, RotateCcw, Skull, Trophy } from 'lucide';
import { useContent, useFormats, useUi } from '../i18n.ts';

const styles = css.create({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'none',
  },
  panel: { width: '26rem', maxWidth: '90vw' },
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

export const Outcome = _component(
  ({
    view,
    onRestart,
    onNextChapter,
    onReplayChapter,
  }: {
    view: OutbreakView;
    /** 新开一局（只有主人能开） */
    onRestart?: () => void;
    /** 打的是章节、通过了、后面还有一章：去下一章 */
    onNextChapter?: () => void;
    /** 打的是章节：再打一次 */
    onReplayChapter?: () => void;
  }) =>
    () => {
      const { outcome } = view;
      if (!outcome) return null;
      const all = useUi();
      const ui = all.outcome;
      const content = useContent();
      const format = useFormats();
      const won = outcome.winner === view.player;
      const chapters = all.chapters;
      const chapter = view.scenario ? content.chapters[view.scenario.id as ChapterId] : null;
      return (
        <div {...css.attrs(styles.root)}>
          <Frame title={ui.title(outcome.tick)} sx={styles.panel}>
            <span {...css.attrs(styles.verdict, won ? styles.won : styles.lost)}>
              <Icon icon={won ? Trophy : Skull} size="1.75rem" />
              {won ? ui.won : ui.lost}
            </span>
            <span>{content.outcomes[outcome.reason]}</span>
            {chapter && (
              <Note tone={won ? 'signal' : 'muted'}>
                {(won ? chapters.passed : chapters.failed)(chapter.name)}
              </Note>
            )}
            {/* 整局的经过：累计感染、当时的病例、累计死亡 */}
            <Chart
              series={[
                {
                  label: view.attacker ? all.trend.infected : all.trend.reported,
                  values: view.history.infected,
                  tone: 'text',
                },
                {
                  label: view.attacker ? all.status.infections : all.status.cases,
                  values: view.history.cases,
                  tone: 'signal',
                  fill: true,
                },
                { label: all.status.deaths, values: view.history.deaths, tone: 'danger' },
              ]}
              format={format.compact}
              from={all.status.day(0)}
              to={all.status.day(outcome.tick)}
              height="6.5rem"
            />
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
            {onNextChapter && (
              <ActionButton icon={ArrowRight} active onPress={onNextChapter}>
                {chapters.next}
              </ActionButton>
            )}
            {onReplayChapter && (
              <ActionButton icon={RotateCcw} onPress={onReplayChapter}>
                {chapters.again}
              </ActionButton>
            )}
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
