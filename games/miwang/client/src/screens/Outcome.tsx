/**
 * 结算：分出胜负之后盖在地图中间。左边是结果——谁赢了、整局的曲线、几个总数；
 * 右边是回顾——给这一方的评价（一个等级，和它是怎么加出来的）、对局结束才公开的真实的数、大事记。
 * 它在舞台上单独占一层：界面画在画布里时，整块是从稍大一点的地方一块块显现出来的。
 */
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
  Scroll,
  space,
  Stack,
  StageLayer,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { ArrowRight, RotateCcw, Skull, Trophy } from 'lucide';
import { newsSentence } from '../feedback/news-text.ts';
import { useContent, useFormats, useUi } from '../i18n.ts';
import { newsIcon } from '../icons.ts';

/** 窄的屏幕上两栏叠成一栏 */
const NARROW = '@media (max-width: 860px)';

const styles = css.create({
  root: { display: 'grid', placeItems: 'center' },
  panel: { width: '50rem', maxWidth: '94vw', maxHeight: '92vh' },
  columns: {
    display: 'grid',
    gridTemplateColumns: { default: '1fr 1fr', [NARROW]: '1fr' },
    gap: space.lg,
    minHeight: 0,
  },
  column: { display: 'flex', flexDirection: 'column', gap: space.sm, minWidth: 0, minHeight: 0 },
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
  rating: { display: 'flex', alignItems: 'center', gap: space.md },
  grade: {
    display: 'grid',
    placeItems: 'center',
    width: '3.5rem',
    height: '3.5rem',
    fontFamily: fonts.numeric,
    fontSize: '2.25rem',
    color: colors.signal,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'currentColor',
  },
  score: { fontFamily: fonts.numeric, fontSize: '1.125rem', color: colors.text },
  chronicle: { maxHeight: '13rem', pointerEvents: 'auto' },
  moments: { display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none' },
  moment: {
    display: 'grid',
    gridTemplateColumns: '3.75rem auto 1fr',
    alignItems: 'center',
    gap: space.sm,
    paddingBlock: '0.2rem',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
  day: {
    fontFamily: fonts.numeric,
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    color: colors.textMuted,
  },
  momentIcon: { color: colors.textMuted },
});

/** 结算出现的样子：从稍大一点、全没显现开始，用这么久到位 */
const ENTER = { from: { reveal: 0, scale: 1.04 }, ms: 900 } as const;

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
      const { outcome, review } = view;
      if (!outcome) return null;
      const all = useUi();
      const ui = all.outcome;
      const content = useContent();
      const format = useFormats();
      const won = outcome.winner === view.player;
      const chapters = all.chapters;
      const chapter = view.scenario ? content.chapters[view.scenario.id as ChapterId] : null;
      return (
        <StageLayer sx={styles.root} enter={ENTER}>
          <Frame title={ui.title(outcome.tick)} sx={styles.panel}>
            <div {...css.attrs(styles.columns)}>
              <div {...css.attrs(styles.column)}>
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
              </div>

              {review && (
                <div data-review={review.grade} {...css.attrs(styles.column)}>
                  <div {...css.attrs(styles.rating)}>
                    <span {...css.attrs(styles.grade)}>{review.grade}</span>
                    <Stack gap="xs">
                      <Note>{ui.grade}</Note>
                      <span {...css.attrs(styles.score)}>{ui.score(review.score)}</span>
                    </Stack>
                  </div>
                  <Stack gap="xs">
                    {review.parts.map((part) => (
                      <Fact key={part.key} label={ui.parts[part.key]} value={`+${part.points}`} />
                    ))}
                  </Stack>
                  {/* 守方平时只看得到上报的：结束了，把实际发生的告诉它 */}
                  {!view.attacker && (
                    <Stack gap="xs">
                      <Note>{ui.truth}</Note>
                      <Fact label={ui.infected} value={format.compact(review.truth.infected)} />
                      <Fact label={ui.deaths} value={format.compact(review.truth.deaths)} />
                      <Fact
                        label={ui.regions}
                        value={`${review.truth.regions} / ${regions.length}`}
                      />
                    </Stack>
                  )}
                  <Fact
                    label={ui.tasks}
                    value={ui.tasksValue(review.truth.tasks[0], review.truth.tasks[1])}
                  />
                  <Note>{ui.chronicle}</Note>
                  <Scroll sx={styles.chronicle}>
                    <ol {...css.attrs(styles.moments)}>
                      {review.chronicle.map((item, index) => (
                        <li key={index} {...css.attrs(styles.moment)}>
                          <span {...css.attrs(styles.day)}>{all.news.day(item.tick)}</span>
                          <Icon
                            icon={newsIcon(item.kind, item.subject)}
                            size="0.9375rem"
                            sx={styles.momentIcon}
                          />
                          <span>{newsSentence(item, view.attacker)}</span>
                        </li>
                      ))}
                    </ol>
                  </Scroll>
                </div>
              )}
            </div>
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
        </StageLayer>
      );
    },
);
