/**
 * 本机的存档：把正在打的这一局存进存档位、导出成文件；从存档位读档接着打，或者从头回放；
 * 也可以导入别处导出的记录文件。
 */
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, Note, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Download, FolderOpen, Play, Save, Trash2, Upload } from 'lucide';
import { useUi } from '../../i18n.ts';
import type { GameRecording } from '../../messages.ts';
import {
  deleteSave,
  exportRecording,
  listSaves,
  parseRecording,
  readSave,
  SAVE_LIMIT,
  writeSave,
} from '../../saves.ts';
import { SaveRow } from './SaveRow.tsx';

const styles = css.create({
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: space.sm },
  file: { display: 'none' },
});

export const LocalSaves = _component(
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
    // 存档在 localStorage 里，不是响应式的：动过之后靠它让列表重画
    let revision = _state(0);
    let message = _state<{ text: string; bad: boolean } | null>(null);
    let picker = _state.raw<HTMLInputElement | null>(null);

    return () => {
      const s = useUi().saves;
      void revision;
      const saves = listSaves();

      /** 读一份存档出来做点什么；读不出来（数据换过版本）就说一声 */
      const withSave = (id: string, use: (recording: GameRecording) => void) => {
        const recording = readSave(id);
        if (recording) use(recording);
        else message = { text: s.incompatible, bad: true };
      };

      const importFile = async (file: File | undefined) => {
        if (!file) return;
        const recording = parseRecording(await file.text());
        if (recording) onWatch(recording);
        else message = { text: s.badFile, bad: true };
      };

      return (
        <Stack gap="md">
          <div {...css.attrs(styles.actions)}>
            <ActionButton
              icon={Save}
              disabled={!current || !view}
              onPress={() => {
                if (!current || !view) return;
                const saved = writeSave(current, view);
                message = saved ? { text: s.saved, bad: false } : { text: s.full, bad: true };
                revision++;
              }}
            >
              {s.saveCurrent}
            </ActionButton>
            <ActionButton
              icon={Download}
              disabled={!current || !view}
              onPress={() => current && view && exportRecording(current, view.tick)}
            >
              {s.exportCurrent}
            </ActionButton>
            <ActionButton icon={Upload} onPress={() => picker?.click()}>
              {s.importFile}
            </ActionButton>
            <input
              ref={_toRef(picker)}
              type="file"
              accept="application/json,.json"
              onChange={(event: Event) => {
                const input = event.target as HTMLInputElement;
                void importFile(input.files?.[0]);
                // 清掉选中的文件：下次选同一个文件也会触发
                input.value = '';
              }}
              {...css.attrs(styles.file)}
            />
          </div>
          {message && <Note tone={message.bad ? 'danger' : 'signal'}>{message.text}</Note>}

          <Note>{s.slots(saves.length, SAVE_LIMIT)}</Note>
          {saves.length === 0 && <Note>{s.empty}</Note>}
          {saves.map((save) => (
            <SaveRow
              key={save.id}
              save={save}
              actions={[
                { icon: FolderOpen, label: s.load, onPress: () => withSave(save.id, onLoad) },
                { icon: Play, label: s.watch, onPress: () => withSave(save.id, onWatch) },
                {
                  icon: Download,
                  label: s.export,
                  onPress: () =>
                    withSave(save.id, (recording) => exportRecording(recording, save.day)),
                },
                {
                  icon: Trash2,
                  label: s.delete,
                  onPress: () => {
                    deleteSave(save.id);
                    revision++;
                  },
                },
              ]}
            />
          ))}
        </Stack>
      );
    };
  },
);
