/** 底部的一排控制：时间快慢、地图缩放、扮演哪一方、新开一局 */
import { ATTACKER, DEFENDER } from '@miwang/sim';
import { ActionButton, Segmented, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { MapController } from '../map.ts';
import type { GameSession } from '../session.ts';

export const ControlBar = _component(
  ({ game, map }: { game: GameSession; map: MapController | null }) =>
    () => {
      const host = game.role === 'host';
      const human = game.opponent.value === 'human';
      return (
        <Stack row gap="md" wrap>
          <Segmented
            label="时间"
            value={game.paused.value ? 0 : game.speed.value}
            options={[
              { value: 0, label: '暂停' },
              { value: 1, label: '1×' },
              { value: 3, label: '3×' },
              { value: 10, label: '10×' },
            ]}
            onChange={(value) => {
              game.setPaused(value === 0);
              if (value !== 0) game.setSpeed(Number(value));
            }}
          />
          <Stack row gap="xs">
            <ActionButton compact aria-label="放大" onPress={() => map?.zoomBy(1.6)}>
              ＋
            </ActionButton>
            <ActionButton compact aria-label="缩小" onPress={() => map?.zoomBy(1 / 1.6)}>
              －
            </ActionButton>
            <ActionButton aria-label="回到整张地图" onPress={() => map?.reset()}>
              全图
            </ActionButton>
          </Stack>
          {host && !human && (
            <Segmented
              label="扮演"
              value={game.player.value}
              options={[
                { value: ATTACKER, label: '攻方' },
                { value: DEFENDER, label: '守方' },
              ]}
              onChange={(value) => game.setPlayer(Number(value))}
            />
          )}
          {host && <ActionButton onPress={() => game.restart()}>新开一局</ActionButton>}
        </Stack>
      );
    },
);
