/**
 * 联机大厅（主人用）：开一个房间，把房间号或邀请链接给另一位玩家；看对方来了没有、消息走的哪条路；
 * 选自己扮演哪一方（对方自动是另一方）；对方掉线时可以让电脑先接手。
 * 也可以反过来——输入别人的房间号，去当客人。
 */
import { ATTACKER, DEFENDER } from '@miwang/sim';
import {
  ActionButton,
  colors,
  Dialog,
  fonts,
  Note,
  Scroll,
  Segmented,
  space,
  Stack,
  TextField,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Bot, Check, Copy, DoorClosed, DoorOpen, LogIn } from 'lucide';
import { useUi } from '../i18n.ts';
import { inviteUrl, normalizeCode } from '../room.ts';
import type { GameSession } from '../session.ts';

const styles = css.create({
  // 内容不多：高度跟着内容走，不撑满
  root: {
    width: 'min(34rem, calc(100vw - 2rem))',
    height: 'fit-content',
    maxHeight: 'calc(100vh - 2rem)',
  },
  body: { flexGrow: 1, minHeight: 0, padding: space.lg },
  // 房间号：要念给别人听、要抄下来，所以大、等宽、字距拉开
  code: {
    fontFamily: fonts.numeric,
    fontSize: '2.25rem',
    letterSpacing: '0.3em',
    textAlign: 'center',
    color: colors.signal,
    userSelect: 'text',
  },
  // 邀请链接要能选中复制（页面整体关了选字）
  link: {
    paddingBlock: space.sm,
    paddingInline: space.md,
    fontSize: '0.8125rem',
    wordBreak: 'break-all',
    userSelect: 'text',
    color: colors.textMuted,
    backgroundColor: colors.inset,
  },
  row: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: space.sm },
  section: {
    paddingBlockStart: space.md,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
});

export const Lobby = _component(({ game, onClose }: { game: GameSession; onClose: () => void }) => {
  let copied = _state(false);
  let typed = _state('');
  let badCode = _state(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // 没有剪贴板权限：链接就在上面，能手动选中复制
    }
  };

  /** 去当客人：换到带房间号的地址（这个页面重新加载成客人） */
  const join = () => {
    const code = normalizeCode(typed);
    badCode = code === null;
    if (code !== null) location.href = inviteUrl(code);
  };

  return () => {
    const all = useUi();
    const ui = all.lobby;
    const room = game.room.value;
    const url = room ? inviteUrl(room.code) : '';
    return (
      <Dialog title={ui.title} onClose={onClose} sx={styles.root}>
        <Scroll sx={styles.body}>
          <Stack gap="md">
            <Note>{ui.intro}</Note>

            {!room && (
              <ActionButton icon={DoorOpen} active onPress={() => game.openRoom()}>
                {ui.open}
              </ActionButton>
            )}

            {room && (
              <>
                <div aria-label={ui.code} data-room-code={room.code} {...css.attrs(styles.code)}>
                  {room.code}
                </div>
                <Note tone={room.state === 'joined' ? 'signal' : 'muted'}>
                  {room.state === 'closed' && room.reason
                    ? ui.reasons[room.reason]
                    : ui.states[room.state]}
                  {room.state === 'joined' && ` ${ui.paths[room.path]}`}
                </Note>
                {room.local && <Note>{ui.localOnly}</Note>}
                <div {...css.attrs(styles.row)}>
                  <div aria-label={ui.link} {...css.attrs(styles.link)}>
                    {url}
                  </div>
                  <ActionButton icon={copied ? Check : Copy} onPress={() => void copy(url)}>
                    {copied ? ui.copied : ui.copy}
                  </ActionButton>
                </div>
                <Segmented
                  label={ui.side}
                  value={game.player.value}
                  options={[
                    { value: ATTACKER, label: `${ui.side} · ${all.controls.attacker}` },
                    { value: DEFENDER, label: `${ui.side} · ${all.controls.defender}` },
                  ]}
                  onChange={(value) => game.setPlayer(value === DEFENDER ? DEFENDER : ATTACKER)}
                />
                {room.state === 'away' && game.opponent.value === 'human' && (
                  <ActionButton icon={Bot} onPress={() => game.handOver()}>
                    {all.opponent.handOver}
                  </ActionButton>
                )}
                <ActionButton icon={DoorClosed} onPress={() => game.closeRoom()}>
                  {ui.close}
                </ActionButton>
              </>
            )}

            <div {...css.attrs(styles.section)}>
              <div {...css.attrs(styles.row)}>
                <TextField
                  label={ui.join}
                  value={typed}
                  placeholder={ui.code}
                  onChange={(next) => (typed = next)}
                  onEnter={join}
                  input={{ maxlength: 8, autocapitalize: 'characters' }}
                />
                <ActionButton icon={LogIn} onPress={join}>
                  {ui.joinGo}
                </ActionButton>
              </div>
              {badCode && <Note tone="danger">{ui.badCode}</Note>}
            </div>
          </Stack>
        </Scroll>
      </Dialog>
    );
  };
});
