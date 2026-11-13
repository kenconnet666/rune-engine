/**
 * 开局设置：选病原体、选扮演哪一方、选电脑对手的难度，然后开始。
 * 左边是病原体的一面图块，右边是选中那一种的介绍——它的原型在公开资料里是什么样（附出处）、在这局游戏里打起来是什么样。
 */
import { PATHOGENS, SOURCES } from '@miwang/content';
import { ATTACKER, DEFENDER, type AiLevel } from '@miwang/sim';
import {
  ActionButton,
  colors,
  Dialog,
  focusRing,
  Icon,
  Note,
  Scroll,
  Segmented,
  space,
  Stack,
  Tile,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Biohazard, ExternalLink, Play, ShieldCheck } from 'lucide';
import { useContent, useUi } from '../i18n.ts';
import { pathogenIcon } from '../icons.ts';
import type { GameSession, GameSetup } from '../session.ts';

const styles = css.create({
  body: { flexGrow: 1, minHeight: 0, display: 'flex' },
  list: { flexShrink: 0, width: '21rem', padding: space.lg },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
  detail: {
    flexGrow: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: space.md,
    padding: space.lg,
    borderInlineStartWidth: '1px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
  },
  name: { display: 'flex', alignItems: 'center', gap: space.md, fontSize: '1.25rem' },
  text: { margin: 0, lineHeight: 1.65, color: colors.text },
  facts: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    margin: 0,
    paddingInlineStart: '1.1rem',
    lineHeight: 1.6,
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.xs,
    fontSize: '0.8125rem',
    color: { default: colors.calm, ':hover': colors.text },
    textDecorationLine: 'underline',
    textUnderlineOffset: '0.2em',
  },
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
  start: { marginInlineStart: 'auto', minWidth: '9rem' },
});

export const SetupDialog = _component(
  ({
    game,
    onStart,
    onClose,
  }: {
    game: GameSession;
    onStart: (setup: GameSetup) => void;
    onClose: () => void;
  }) => {
    // 默认选现在这一局的：再来一局同样的不用重新挑
    let pathogen = _state(game.view.value?.pathogen.id ?? PATHOGENS[0]!.id);
    let player = _state(game.player.value);
    let level = _state<AiLevel>(game.aiLevel.value);

    return () => {
      const ui = useUi();
      const content = useContent();
      const text = content.pathogens[pathogen];
      const sources = SOURCES[pathogen] ?? [];
      // 对面是另一位玩家时，哪一方、什么难度都不是这里能定的
      const solo = game.opponent.value === 'ai';
      return (
        <Dialog title={ui.setup.title} onClose={onClose}>
          <div {...css.attrs(styles.body)}>
            <Scroll sx={styles.list}>
              <Stack>
                <Note>{ui.setup.pathogen}</Note>
                <div {...css.attrs(styles.grid)}>
                  {PATHOGENS.map(({ id }) => (
                    <Tile
                      key={id}
                      icon={pathogenIcon(id)}
                      label={content.pathogens[id]?.name ?? id}
                      tip={content.pathogens[id]?.summary}
                      state={id === pathogen ? 'owned' : 'available'}
                      aria-pressed={id === pathogen}
                      onPress={() => (pathogen = id)}
                    />
                  ))}
                </div>
              </Stack>
            </Scroll>
            <Scroll sx={styles.detail}>
              {text && (
                <>
                  <div {...css.attrs(styles.name)}>
                    <Icon icon={pathogenIcon(pathogen)} size="2rem" weight={1.5} />
                    <Stack gap="xs">
                      <span>{text.name}</span>
                      <Note>{text.kind}</Note>
                    </Stack>
                  </div>
                  <p {...css.attrs(styles.text)}>{text.summary}</p>
                  <Stack gap="xs">
                    <Note>{ui.setup.play}</Note>
                    <p {...css.attrs(styles.text)}>{text.play}</p>
                  </Stack>
                  <Stack gap="xs">
                    <Note>{ui.setup.facts}</Note>
                    <ul {...css.attrs(styles.facts)}>
                      {text.facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  </Stack>
                  {sources.length > 0 && (
                    <Stack gap="xs">
                      <Note>{ui.setup.sources}</Note>
                      {sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          {...css.attrs(focusRing.visible, styles.link)}
                        >
                          {source.title}
                          <Icon icon={ExternalLink} size="0.8125rem" />
                        </a>
                      ))}
                      <Note>{ui.setup.note}</Note>
                    </Stack>
                  )}
                </>
              )}
            </Scroll>
          </div>
          <footer {...css.attrs(styles.footer)}>
            {solo && (
              <Stack gap="xs">
                <Note>{ui.setup.side}</Note>
                <Segmented
                  label={ui.setup.side}
                  value={player}
                  options={[
                    {
                      value: ATTACKER,
                      label: (
                        <Stack row gap="xs">
                          <Icon icon={Biohazard} />
                          {ui.controls.attacker}
                        </Stack>
                      ),
                    },
                    {
                      value: DEFENDER,
                      label: (
                        <Stack row gap="xs">
                          <Icon icon={ShieldCheck} />
                          {ui.controls.defender}
                        </Stack>
                      ),
                    },
                  ]}
                  onChange={(value) => (player = Number(value))}
                />
              </Stack>
            )}
            {solo && (
              <Stack gap="xs">
                <Note>{ui.setup.level}</Note>
                <Segmented
                  label={ui.setup.level}
                  value={level}
                  options={ui.opponent.levels.map((label, value) => ({ value, label }))}
                  onChange={(value) => (level = Number(value) as AiLevel)}
                />
              </Stack>
            )}
            <ActionButton
              icon={Play}
              active
              sx={styles.start}
              onPress={() => onStart(solo ? { pathogen, player, level } : { pathogen })}
            >
              {ui.setup.start}
            </ActionButton>
          </footer>
        </Dialog>
      );
    };
  },
);
