/**
 * 云端的存档：没开过的先开启（生成同步码）或者填另一台设备的同步码；
 * 开了之后把正在打的这一局存上去，从云端读档接着打、从头回放、删除；最下面是同步码本身。
 * 每个操作都要过一趟网络：做的时候按钮先按不动，办不成就把原因说出来。
 */
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, colors, fonts, Note, space, Stack, TextField } from '@rune-engine/ui';
import { VaultError } from '@rune-engine/transport';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import {
  Check,
  CloudOff,
  CloudUpload,
  Copy,
  FolderOpen,
  KeyRound,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide';
import {
  adoptCloudKey,
  CLOUD,
  cloudKey,
  deleteCloudSave,
  downloadCloudSave,
  enableCloud,
  forgetCloudKey,
  listCloudSaves,
  uploadCloudSave,
} from '../../saves/cloud.ts';
import { useUi } from '../../i18n.ts';
import type { GameRecording } from '../../messages.ts';
import { SAVE_LIMIT, type SaveMeta } from '../../saves/recording.ts';
import { SaveRow } from './SaveRow.tsx';

const styles = css.create({
  actions: { display: 'grid', gridTemplateColumns: '1fr auto', gap: space.sm },
  row: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: space.sm },
  section: {
    paddingBlockStart: space.md,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  // 同步码要能选中、抄走：等宽，太长了自己折行
  key: {
    paddingBlock: space.sm,
    paddingInline: space.md,
    fontFamily: fonts.numeric,
    fontSize: '0.9375rem',
    letterSpacing: '0.08em',
    wordBreak: 'break-all',
    userSelect: 'text',
    color: colors.text,
    backgroundColor: colors.inset,
  },
});

export const CloudSaves = _component(
  ({
    view,
    current,
    onLoad,
    onWatch,
  }: {
    /** 正在打的这一局现在的状态和它的记录（没有可存的时候是 null） */
    view: OutbreakView | null;
    current: GameRecording | null;
    onLoad: (recording: GameRecording) => void;
    onWatch: (recording: GameRecording) => void;
  }) => {
    let key = _state(cloudKey());
    /** 云端的存档；还没取到是 null */
    let saves = _state<SaveMeta[] | null>(null);
    let busy = _state(false);
    let message = _state<{ text: string; bad: boolean } | null>(null);
    let typed = _state('');
    let copied = _state(false);

    /** 做一件要过网络的事：期间按钮按不动，办不成就把原因写出来 */
    async function run(work: () => Promise<void>) {
      busy = true;
      message = null;
      try {
        await work();
      } catch (error) {
        const reason = error instanceof VaultError ? error.reason : 'failed';
        message = { text: useUi().cloud.failures[reason], bad: true };
      } finally {
        busy = false;
      }
    }
    const refresh = () =>
      run(async () => {
        saves = await listCloudSaves();
      });
    /** 取一份下来做点什么；取不到、和现在的数据对不上就说一声 */
    const withSave = (id: string, use: (recording: GameRecording) => void) =>
      run(async () => {
        const recording = await downloadCloudSave(id);
        if (recording) use(recording);
        else message = { text: useUi().saves.incompatible, bad: true };
      });

    if (key) void refresh();

    return () => {
      const all = useUi();
      const ui = all.cloud;
      if (!CLOUD) return <Note icon={CloudOff}>{ui.unavailable}</Note>;

      if (!key) {
        const adopt = () => {
          if (adoptCloudKey(typed)) {
            key = cloudKey();
            void refresh();
          } else message = { text: ui.badKey, bad: true };
        };
        return (
          <Stack gap="md">
            <Note>{ui.intro}</Note>
            <ActionButton
              icon={CloudUpload}
              active
              onPress={() => {
                key = enableCloud();
                void refresh();
              }}
            >
              {ui.enable}
            </ActionButton>
            <div {...css.attrs(styles.section)}>
              <div {...css.attrs(styles.row)}>
                <TextField
                  label={ui.haveKey}
                  value={typed}
                  placeholder={ui.key}
                  onChange={(next) => (typed = next)}
                  onEnter={adopt}
                  input={{ maxlength: 80, autocapitalize: 'none' }}
                />
                <ActionButton icon={KeyRound} onPress={adopt}>
                  {ui.useKey}
                </ActionButton>
              </div>
            </div>
            {message && <Note tone="danger">{message.text}</Note>}
          </Stack>
        );
      }

      const code = key;
      return (
        <Stack gap="md">
          <div {...css.attrs(styles.actions)}>
            <ActionButton
              icon={CloudUpload}
              disabled={!current || !view || busy}
              onPress={() =>
                void run(async () => {
                  if (!current || !view) return;
                  await uploadCloudSave(current, view);
                  saves = await listCloudSaves();
                  message = { text: ui.saved, bad: false };
                })
              }
            >
              {ui.upload}
            </ActionButton>
            <ActionButton icon={RefreshCw} disabled={busy} onPress={() => void refresh()}>
              {ui.refresh}
            </ActionButton>
          </div>
          {message && (
            <Note tone={message.bad ? 'danger' : 'signal'} role="status">
              {message.text}
            </Note>
          )}

          {saves === null && !message && <Note>{ui.loading}</Note>}
          {saves && <Note>{ui.slots(saves.length, SAVE_LIMIT)}</Note>}
          {saves?.length === 0 && <Note>{ui.empty}</Note>}
          {saves?.map((save) => (
            <SaveRow
              key={save.id}
              save={save}
              disabled={busy}
              actions={[
                {
                  icon: FolderOpen,
                  label: all.saves.load,
                  onPress: () => void withSave(save.id, onLoad),
                },
                {
                  icon: Play,
                  label: all.saves.watch,
                  onPress: () => void withSave(save.id, onWatch),
                },
                {
                  icon: Trash2,
                  label: all.saves.delete,
                  onPress: () =>
                    void run(async () => {
                      await deleteCloudSave(save.id);
                      saves = await listCloudSaves();
                    }),
                },
              ]}
            />
          ))}

          <Stack gap="sm" sx={styles.section}>
            <Note icon={KeyRound}>{ui.keyHelp}</Note>
            <div {...css.attrs(styles.row)}>
              <div aria-label={ui.key} data-cloud-key={code} {...css.attrs(styles.key)}>
                {code}
              </div>
              <ActionButton
                icon={copied ? Check : Copy}
                onPress={() =>
                  void navigator.clipboard.writeText(code).then(
                    () => {
                      copied = true;
                      setTimeout(() => (copied = false), 2000);
                    },
                    // 没有剪贴板权限：同步码就在旁边，能手动选中复制
                    () => {},
                  )
                }
              >
                {copied ? ui.copied : ui.copy}
              </ActionButton>
            </div>
            <ActionButton
              icon={CloudOff}
              onPress={() => {
                forgetCloudKey();
                key = null;
                saves = null;
                message = null;
              }}
            >
              {ui.forget}
            </ActionButton>
          </Stack>
        </Stack>
      );
    };
  },
);
