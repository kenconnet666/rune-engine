/** 对手：电脑（可以调难度、可以邀请另一位玩家来接手）或者另一位玩家 */
import type { AiLevel } from '@miwang/sim';
import { ActionButton, colors, Frame, Note, Segmented } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import type { GameSession } from '../session.ts';

const styles = css.create({
  // 邀请地址要能选中复制（页面整体关了选字）
  invite: { userSelect: 'text', pointerEvents: 'auto', wordBreak: 'break-all', color: colors.text },
});

export const OpponentPanel = _component(({ game }: { game: GameSession }) => {
  let invite = _state<string | null>(null);
  return () => {
    const host = game.role === 'host';
    const human = game.opponent.value === 'human';
    return (
      <Frame title={human ? '对手 · 另一位玩家' : '对手 · 电脑'}>
        {human && <Note>房间 {game.room.value}：两位玩家都在。</Note>}
        {host && !human && (
          <Segmented
            label="电脑的难度"
            value={game.aiLevel.value}
            options={[
              { value: 0, label: '简单' },
              { value: 1, label: '普通' },
              { value: 2, label: '困难' },
            ]}
            onChange={(value) => game.setAiLevel(Number(value) as AiLevel)}
          />
        )}
        {host && !human && (
          <ActionButton onPress={() => (invite = game.openRoom())}>邀请另一位玩家</ActionButton>
        )}
        {invite && !human && (
          <Note>
            在这台电脑的另一个标签页打开下面的地址（现在只能连同一个浏览器，网络直连还没做）：
            <br />
            <span {...css.attrs(styles.invite)}>{invite}</span>
          </Note>
        )}
      </Frame>
    );
  };
});
