/**
 * 存档与回放：把正在打的这一局存进存档位、导出成文件；从存档位读档接着打，或者从头回放；
 * 也可以导入别处导出的记录文件。
 */
import type { OutbreakView } from '@miwang/sim';
import { ATTACKER } from '@miwang/sim';
import {
  ActionButton,
  colors,
  Dialog,
  fonts,
  Icon,
  Note,
  Scroll,
  space,
  Stack,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Download, FolderOpen, Play, Save, Trash2, Upload } from 'lucide';
import { i18n, useContent, useUi } from '../i18n.ts';
import { pathogenIcon } from '../icons.ts';
import type { GameRecording } from '../messages.ts';
import {
  deleteSave,
  exportRecording,
  listSaves,
  parseRecording,
  readSave,
  SAVE_LIMIT,
  writeSave,
} from '../saves.ts';

const styles = css.create({
  root: { width: 'min(46rem, calc(100vw - 2rem))' },
  body: { flexGrow: 1, minHeight: 0, padding: space.lg },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: space.sm },
  // 一份存档：左边是它是什么，右边是能对它做的事
  slot: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: space.md,
    paddingBlock: space.sm,
    paddingInline: space.md,
    backgroundColor: colors.inset,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  name: { fontSize: '0.9375rem', color: colors.text },
  when: { fontFamily: fonts.numeric, fontSize: '0.75rem', color: colors.textMuted },
  buttons: { display: 'flex', gap: space.xs },
  file: { display: 'none' },
});

export const Saves = _component(
  ({
    view,
    current,
    onLoad,
    onWatch,
    onClose,
  }: {
    /** 正在打的这一局现在的状态和它的记录（没有可存的时候是 null） */
    view: OutbreakView | null;
    current: GameRecording | null;
    onLoad: (recording: GameRecording) => void;
    onWatch: (recording: GameRecording) => void;
    onClose: () => void;
  }) => {
    // 存档在 localStorage 里，不是响应式的：动过之后靠它让列表重画
    let revision = _state(0);
    let message = _state<{ text: string; bad: boolean } | null>(null);
    let picker = _state.raw<HTMLInputElement | null>(null);

    return () => {
      const ui = useUi();
      const s = ui.saves;
      const content = useContent();
      void revision;
      const saves = listSaves();
      const when = new Intl.DateTimeFormat(i18n.locale.value === 'zh' ? 'zh-CN' : 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

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
        <Dialog title={s.title} onClose={onClose} sx={styles.root}>
          <Scroll sx={styles.body}>
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
                <div key={save.id} {...css.attrs(styles.slot)}>
                  <Icon icon={pathogenIcon(save.pathogen)} size="1.5rem" weight={1.5} />
                  <Stack gap="xs">
                    <span {...css.attrs(styles.name)}>
                      {content.pathogens[save.pathogen]?.name ?? save.pathogen} ·{' '}
                      {ui.status.day(save.day)} ·{' '}
                      {save.player === ATTACKER ? ui.controls.attacker : ui.controls.defender}
                      {save.winner !== null &&
                        ` · ${save.winner === save.player ? ui.outcome.won : ui.outcome.lost}`}
                    </span>
                    <span {...css.attrs(styles.when)}>{when.format(save.savedAt)}</span>
                  </Stack>
                  <div {...css.attrs(styles.buttons)}>
                    <ActionButton
                      compact
                      icon={FolderOpen}
                      aria-label={s.load}
                      tip={s.load}
                      onPress={() => withSave(save.id, onLoad)}
                    />
                    <ActionButton
                      compact
                      icon={Play}
                      aria-label={s.watch}
                      tip={s.watch}
                      onPress={() => withSave(save.id, onWatch)}
                    />
                    <ActionButton
                      compact
                      icon={Download}
                      aria-label={s.export}
                      tip={s.export}
                      onPress={() =>
                        withSave(save.id, (recording) => exportRecording(recording, save.day))
                      }
                    />
                    <ActionButton
                      compact
                      icon={Trash2}
                      aria-label={s.delete}
                      tip={s.delete}
                      onPress={() => {
                        deleteSave(save.id);
                        revision++;
                      }}
                    />
                  </div>
                </div>
              ))}
            </Stack>
          </Scroll>
        </Dialog>
      );
    };
  },
);
