/**
 * 章节：诗的五句各是一章。左边挑哪一章（打过的打了勾），右边是这一章的开场白、要学的东西、
 * 扮演哪一方、那一方的任务和目标，然后开始。
 */
import { CHAPTERS, type ChapterId } from '@miwang/content';
import { ATTACKER, DEFENDER, type AiLevel } from '@miwang/sim';
import type { PlayerId } from '@rune-engine/core';
import {
  ActionButton,
  colors,
  Dialog,
  Fact,
  fonts,
  Note,
  Scroll,
  Segmented,
  space,
  Stack,
  type IconData,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Dna, Footprints, Mountain, Plane, Play, Sprout } from 'lucide';
import { chapterProgress } from '../chapters/progress.ts';
import { useContent, useFormats, useUi } from '../i18n.ts';
import type { GameSetup } from '../session/index.ts';

/** 每章一个图标：萌芽、变异、脚印、山、飞机 */
export const CHAPTER_ICONS: Readonly<Record<ChapterId, IconData>> = {
  bewilderment: Sprout,
  malice: Dna,
  wilds: Footprints,
  hills: Mountain,
  sky: Plane,
};

const styles = css.create({
  root: { width: 'min(54rem, calc(100vw - 2rem))' },
  body: { flexGrow: 1, minHeight: 0, display: 'flex' },
  list: { flexShrink: 0, width: '17rem', padding: space.lg },
  detail: {
    flexGrow: 1,
    minWidth: 0,
    padding: space.lg,
    borderInlineStartWidth: '1px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
  },
  name: { margin: 0, fontSize: '1.75rem', fontWeight: 400, letterSpacing: '0.2em' },
  line: { margin: 0, fontSize: '0.875rem', color: colors.signal },
  text: { margin: 0, fontSize: '0.875rem', lineHeight: 1.7, color: colors.text },
  lessons: {
    margin: 0,
    paddingInlineStart: '1.2em',
    fontSize: '0.8125rem',
    lineHeight: 1.7,
    color: colors.textMuted,
  },
  marks: { fontFamily: fonts.numeric, fontSize: '0.75rem', color: colors.calm },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'end',
    gap: space.lg,
    paddingBlock: space.md,
    paddingInline: space.lg,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  start: { marginInlineStart: 'auto', minWidth: '10rem' },
});

export const Chapters = _component(
  ({ onStart, onClose }: { onStart: (setup: GameSetup) => void; onClose: () => void }) => {
    const progress = chapterProgress();
    /** 默认停在第一个还没用攻方通过的章节上 */
    let chosen = _state<ChapterId>(
      CHAPTERS.find((chapter) => !progress[chapter.id]?.attacker)?.id ?? CHAPTERS[0]!.id,
    );
    let player = _state<PlayerId>(ATTACKER);
    let level = _state<AiLevel>(0);

    return () => {
      const all = useUi();
      const ui = all.chapters;
      const content = useContent();
      const format = useFormats();
      const chapter = CHAPTERS.find((candidate) => candidate.id === chosen) ?? CHAPTERS[0]!;
      const text = content.chapters[chapter.id];
      return (
        <Dialog title={ui.title} onClose={onClose} sx={styles.root}>
          <div {...css.attrs(styles.body)}>
            <Scroll sx={styles.list}>
              <Stack>
                {CHAPTERS.map(({ id }, index) => {
                  const passed = progress[id];
                  return (
                    <ActionButton
                      key={id}
                      icon={CHAPTER_ICONS[id]}
                      active={id === chosen}
                      aria-pressed={id === chosen}
                      data-chapter={id}
                      detail={
                        <span {...css.attrs(styles.marks)}>
                          {passed?.attacker && ui.passedAttacker}
                          {passed?.attacker && passed.defender && ' '}
                          {passed?.defender && ui.passedDefender}
                        </span>
                      }
                      onPress={() => (chosen = id)}
                    >
                      {ui.number(index + 1)} · {content.chapters[id].name}
                    </ActionButton>
                  );
                })}
              </Stack>
            </Scroll>

            <Scroll sx={styles.detail}>
              <Stack gap="md">
                <h2 {...css.attrs(styles.name)}>{text.name}</h2>
                <p {...css.attrs(styles.line)}>
                  {text.line} — {text.theme}
                </p>
                <p {...css.attrs(styles.text)}>{text.intro}</p>

                <Stack gap="xs">
                  <Note>{ui.task}</Note>
                  <p {...css.attrs(styles.text)}>
                    {player === ATTACKER ? text.attacker : text.defender}
                  </p>
                </Stack>

                <Stack gap="xs">
                  <Note>{player === ATTACKER ? ui.attackerGoal : ui.defenderGoal}</Note>
                  {chapter.goals.map((goal) => (
                    <Fact
                      key={goal.metric}
                      label={ui.goals[goal.metric](format.compact(goal.target))}
                      value={ui.deadline(chapter.days)}
                    />
                  ))}
                  {chapter.goals.length === 0 && <p {...css.attrs(styles.text)}>{ui.standard}</p>}
                </Stack>

                <Stack gap="xs">
                  <Note>{ui.lessons}</Note>
                  <ul {...css.attrs(styles.lessons)}>
                    {text.lessons.map((lesson) => (
                      <li key={lesson}>{lesson}</li>
                    ))}
                  </ul>
                </Stack>
              </Stack>
            </Scroll>
          </div>

          <div {...css.attrs(styles.footer)}>
            <Stack gap="xs">
              <Note>{all.setup.side}</Note>
              <Segmented
                label={all.setup.side}
                value={player}
                options={[
                  { value: ATTACKER, label: all.controls.attacker },
                  { value: DEFENDER, label: all.controls.defender },
                ]}
                onChange={(value) => (player = value === DEFENDER ? DEFENDER : ATTACKER)}
              />
            </Stack>
            <Stack gap="xs">
              <Note>{all.opponent.level}</Note>
              <Segmented
                label={all.opponent.level}
                value={level}
                options={all.opponent.levels.map((label, value) => ({ value, label }))}
                onChange={(value) => (level = Number(value) as AiLevel)}
              />
            </Stack>
            <ActionButton
              icon={Play}
              active
              sx={styles.start}
              onPress={() => onStart({ chapter: chapter.id, player, level })}
            >
              {ui.start}
            </ActionButton>
          </div>
        </Dialog>
      );
    };
  },
);
