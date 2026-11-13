/** 对手：电脑（可以调难度、可以邀请另一位玩家来接手）或者另一位玩家 */
import type { AiLevel } from '@miwang/sim';
import { ActionButton, colors, Frame, Note, Segmented } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Bot, UserPlus, Users } from 'lucide';
import { useUi } from '../i18n.ts';
import type { GameSession } from '../session.ts';

const styles = css.create({
  // 邀请地址要能选中复制（页面整体关了选字）
  invite: { userSelect: 'text', pointerEvents: 'auto', wordBreak: 'break-all', color: colors.text },
});

export const OpponentPanel = _component(({ game }: { game: GameSession }) => {
  let invite = _state<string | null>(null);
  return () => {
    const ui = useUi().opponent;
    const host = game.role === 'host';
    const human = game.opponent.value === 'human';
    return (
      <Frame icon={human ? Users : Bot} title={human ? ui.human : ui.ai}>
        {human && <Note>{ui.room(game.room.value ?? '')}</Note>}
        {host && !human && (
          <Segmented
            label={ui.level}
            value={game.aiLevel.value}
            options={ui.levels.map((label, value) => ({ value, label }))}
            onChange={(value) => game.setAiLevel(Number(value) as AiLevel)}
          />
        )}
        {host && !human && (
          <ActionButton icon={UserPlus} onPress={() => (invite = game.openRoom())}>
            {ui.invite}
          </ActionButton>
        )}
        {invite && !human && (
          <Note>
            {ui.inviteHelp}
            <br />
            <span {...css.attrs(styles.invite)}>{invite}</span>
          </Note>
        )}
      </Frame>
    );
  };
});
