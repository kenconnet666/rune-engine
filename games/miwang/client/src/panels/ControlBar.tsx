/** 底部的一排控制：菜单、时间快慢、地图缩放、扮演哪一方 */
import { ATTACKER, DEFENDER } from '@miwang/sim';
import { ActionButton, Icon, Segmented, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import {
  Biohazard,
  ChevronsRight,
  FastForward,
  Maximize,
  Menu,
  Minus,
  Pause,
  Play,
  Plus,
  ShieldCheck,
} from 'lucide';
import { useUi } from '../i18n.ts';
import type { MapController } from '../map.ts';
import type { GameSession } from '../session/index.ts';

/** 各档速度用什么图标 */
const SPEEDS = [
  { times: 1, icon: Play },
  { times: 3, icon: FastForward },
  { times: 10, icon: ChevronsRight },
];

export const ControlBar = _component(
  ({ game, map, onMenu }: { game: GameSession; map: MapController | null; onMenu: () => void }) =>
    () => {
      const all = useUi();
      const ui = all.controls;
      const host = game.role === 'host';
      const human = game.opponent.value === 'human';
      return (
        <Stack row gap="md" wrap>
          <ActionButton icon={Menu} onPress={onMenu}>
            {all.menu.open}
          </ActionButton>
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
          {/* 换边看另一方：对面是电脑时可以，回放时可以；章节里不行——一章是用选定的那一方打的 */}
          {host && (game.playback.value || (!human && !game.view.value?.scenario)) && (
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
        </Stack>
      );
    },
);
