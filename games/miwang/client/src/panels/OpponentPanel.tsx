/**
 * 对手：电脑（可以调难度）或者另一位玩家（房间号、消息走的哪条路、对方在不在）。
 * 开房间、邀请、选边都在联机大厅里做，这里只给入口和现在的状态。
 */
import type { AiLevel } from '@miwang/sim';
import { ActionButton, Frame, Note, Segmented } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { Bot, Users } from 'lucide';
import { useUi } from '../i18n.ts';
import type { GameSession } from '../session/index.ts';

export const OpponentPanel = _component(
  ({ game, onOnline }: { game: GameSession; onOnline: () => void }) =>
    () => {
      const all = useUi();
      const ui = all.opponent;
      const host = game.role === 'host';
      const human = game.opponent.value === 'human';
      const room = game.room.value;
      /** 另一位玩家现在连不上 */
      const away = human && room?.state !== 'joined';
      return (
        <Frame icon={human ? Users : Bot} title={human ? ui.human : ui.ai}>
          {human && room && !away && <Note>{ui.room(room.code, all.lobby.paths[room.path])}</Note>}
          {away && <Note tone="danger">{host ? ui.away : ui.hostAway}</Note>}
          {away && host && (
            <ActionButton icon={Bot} onPress={() => game.handOver()}>
              {ui.handOver}
            </ActionButton>
          )}
          {host && !human && (
            <Segmented
              label={ui.level}
              value={game.aiLevel.value}
              options={ui.levels.map((label, value) => ({ value, label }))}
              onChange={(value) => game.setAiLevel(Number(value) as AiLevel)}
            />
          )}
          {host && !human && room && room.state !== 'closed' && (
            <Note>{ui.waiting(room.code)}</Note>
          )}
          {host && (
            <ActionButton icon={Users} onPress={onOnline}>
              {ui.online}
            </ActionButton>
          )}
        </Frame>
      );
    },
);
