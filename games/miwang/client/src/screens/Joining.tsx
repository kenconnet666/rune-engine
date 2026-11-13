/**
 * 客人还没接上主人时盖在画面上的那一块：现在卡在哪一步（正在连、主人不在）；
 * 进不去的话说原因（没有这个房间、满了…），并给一条退路——自己开一局。
 */
import { ActionButton, Frame, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { LogOut, Users } from 'lucide';
import { useUi } from '../i18n.ts';
import type { RoomInfo } from '../room.ts';

const styles = css.create({
  // 和主菜单一样：压暗后面的地图，又看得出它还在
  root: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: 'rgba(3, 6, 9, 0.55)',
    backdropFilter: 'blur(3px)',
    pointerEvents: 'auto',
  },
  panel: { width: '24rem', maxWidth: '90vw', gap: space.md, padding: space.lg },
});

export const Joining = _component(
  ({ room, onLeave }: { room: RoomInfo; onLeave: () => void }) =>
    () => {
      const all = useUi();
      const ui = all.joining;
      const failed = room.state === 'closed';
      return (
        <div {...css.attrs(styles.root)}>
          <Frame icon={Users} title={ui.title(room.code)} sx={styles.panel}>
            {/* 状态会变（连上了、主人回来了）：读屏跟着念 */}
            <Note tone={failed ? 'danger' : 'muted'} role="status" data-room-state={room.state}>
              {failed && room.reason
                ? all.lobby.reasons[room.reason]
                : room.state === 'waiting'
                  ? ui.waiting
                  : ui.connecting}
            </Note>
            {room.local && <Note>{all.lobby.localOnly}</Note>}
            <ActionButton icon={LogOut} onPress={onLeave}>
              {ui.leave}
            </ActionButton>
          </Frame>
        </div>
      );
    },
);
