/**
 * 开局设置：选病原体、选扮演哪一方、选电脑对手的难度，然后开始。
 * 左边是病原体的一面图块，右边是选中那一种的介绍——它的原型在公开资料里是什么样（附出处）、在这局游戏里打起来是什么样。
 */
import { PATHOGENS } from '@miwang/content';
import { ATTACKER, DEFENDER, type AiLevel } from '@miwang/sim';
import {
  ActionButton,
  colors,
  Dialog,
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
import { Biohazard, Play, ShieldCheck } from 'lucide';
import { useContent, useUi } from '../i18n.ts';
import { pathogenIcon } from '../icons.ts';
import type { GameSession, GameSetup } from '../session/index.ts';
import { PathogenDetail } from './PathogenDetail.tsx';

const styles = css.create({
  body: { flexGrow: 1, minHeight: 0, display: 'flex' },
  list: { flexShrink: 0, width: '21rem', padding: space.lg },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
  detail: {
    flexGrow: 1,
    minWidth: 0,
    padding: space.lg,
    borderInlineStartWidth: '1px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
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

export const Setup = _component(
  ({
    game,
    onStart,
    onClose,
  }: {
    game: GameSession;
    onStart: (setup: GameSetup) => void;
    onClose: () => void;
  }) => {
    // 还没动过的那几项是 null：按现在这一局的来（再来一局同样的不用重新挑）
    let pickedPathogen = _state<string | null>(null);
    let pickedPlayer = _state<number | null>(null);
    let pickedLevel = _state<AiLevel | null>(null);
    /** 要不要世界条件：默认要 */
    let plain = _state(false);

    return () => {
      const ui = useUi();
      const content = useContent();
      const pathogen = pickedPathogen ?? game.view.value?.pathogen.id ?? PATHOGENS[0]!.id;
      const player = pickedPlayer ?? game.player.value;
      const level = pickedLevel ?? game.aiLevel.value;
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
                      onPress={() => (pickedPathogen = id)}
                    />
                  ))}
                </div>
              </Stack>
            </Scroll>
            <Scroll sx={styles.detail}>
              <PathogenDetail id={pathogen} />
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
                  onChange={(value) => (pickedPlayer = Number(value))}
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
                  onChange={(value) => (pickedLevel = Number(value) as AiLevel)}
                />
              </Stack>
            )}
            <Stack gap="xs">
              <Note>{ui.setup.conditions}</Note>
              <Segmented
                label={ui.setup.conditions}
                value={plain ? 'off' : 'on'}
                options={[
                  { value: 'on', label: ui.setup.conditionsOn },
                  { value: 'off', label: ui.setup.conditionsOff },
                ]}
                onChange={(value) => (plain = value === 'off')}
              />
            </Stack>
            <ActionButton
              icon={Play}
              active
              sx={styles.start}
              onPress={() =>
                onStart(solo ? { pathogen, player, level, plain } : { pathogen, plain })
              }
            >
              {ui.setup.start}
            </ActionButton>
          </footer>
        </Dialog>
      );
    };
  },
);
