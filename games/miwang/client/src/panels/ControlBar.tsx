/** 底部的一排控制：时间快慢、地图缩放、扮演哪一方、语言、新开一局 */
import type { Locale } from '@miwang/content';
import { ATTACKER, DEFENDER } from '@miwang/sim';
import { ActionButton, Icon, Segmented, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import {
  Biohazard,
  ChevronsRight,
  FastForward,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
} from 'lucide';
import { i18n, LOCALE_NAMES, useUi } from '../i18n.ts';
import type { MapController } from '../map.ts';
import type { GameSession } from '../session.ts';

/** 各档速度用什么图标 */
const SPEEDS = [
  { times: 1, icon: Play },
  { times: 3, icon: FastForward },
  { times: 10, icon: ChevronsRight },
];

export const ControlBar = _component(
  ({
    game,
    map,
    onNewGame,
  }: {
    game: GameSession;
    map: MapController | null;
    onNewGame: () => void;
  }) =>
    () => {
      const ui = useUi().controls;
      const host = game.role === 'host';
      const human = game.opponent.value === 'human';
      return (
        <Stack row gap="md" wrap>
          <Segmented
            label={ui.time}
            value={game.paused.value ? 0 : game.speed.value}
            options={[
              { value: 0, label: <Icon icon={Pause} />, name: ui.pause },
              ...SPEEDS.map(({ times, icon }) => ({
                value: times,
                label: <Icon icon={icon} />,
                name: ui.speed(times),
              })),
            ]}
            onChange={(value) => {
              game.setPaused(value === 0);
              if (value !== 0) game.setSpeed(Number(value));
            }}
          />
          <Stack row gap="xs">
            <ActionButton
              compact
              icon={Plus}
              aria-label={ui.zoomIn}
              tip={ui.zoomIn}
              onPress={() => map?.zoomBy(1.6)}
            />
            <ActionButton
              compact
              icon={Minus}
              aria-label={ui.zoomOut}
              tip={ui.zoomOut}
              onPress={() => map?.zoomBy(1 / 1.6)}
            />
            <ActionButton
              compact
              icon={Maximize}
              aria-label={ui.fit}
              tip={ui.fit}
              onPress={() => map?.reset()}
            />
          </Stack>
          {host && !human && (
            <Segmented
              label={ui.role}
              value={game.player.value}
              options={[
                {
                  value: ATTACKER,
                  label: (
                    <Stack row gap="xs">
                      <Icon icon={Biohazard} />
                      {ui.attacker}
                    </Stack>
                  ),
                },
                {
                  value: DEFENDER,
                  label: (
                    <Stack row gap="xs">
                      <Icon icon={ShieldCheck} />
                      {ui.defender}
                    </Stack>
                  ),
                },
              ]}
              onChange={(value) => game.setPlayer(Number(value))}
            />
          )}
          <Segmented
            label={ui.language}
            value={i18n.locale.value}
            options={i18n.locales.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] }))}
            onChange={(value) => (i18n.locale.value = value as Locale)}
          />
          {host && (
            <ActionButton icon={RotateCcw} onPress={onNewGame}>
              {ui.restart}
            </ActionButton>
          )}
        </Stack>
      );
    },
);
