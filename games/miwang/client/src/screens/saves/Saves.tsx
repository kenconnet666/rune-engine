/**
 * 存档与回放：两个标签页，存档放在本机的（LocalSaves）和放在云端的（CloudSaves）。
 * 读档、回放选中了哪一份都交回给外面（App）去做，这里只管挑。
 */
import type { OutbreakView } from '@miwang/sim';
import { Dialog, Scroll, space, Tabs } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Cloud, HardDrive } from 'lucide';
import { useUi } from '../../i18n.ts';
import type { GameRecording } from '../../messages.ts';
import { CloudSaves } from './CloudSaves.tsx';
import { LocalSaves } from './LocalSaves.tsx';

const styles = css.create({
  root: { width: 'min(46rem, calc(100vw - 2rem))' },
  tabs: { paddingInline: space.lg },
  body: { flexGrow: 1, minHeight: 0, padding: space.lg },
});

export const Saves = _component(
  ({
    onClose,
    ...lists
  }: {
    /** 正在打的这一局现在的状态和它的记录（没有可存的时候是 null） */
    view: OutbreakView | null;
    current: GameRecording | null;
    onLoad: (recording: GameRecording) => void;
    onWatch: (recording: GameRecording) => void;
    onClose: () => void;
  }) => {
    let where = _state<'local' | 'cloud'>('local');
    return () => {
      const ui = useUi().saves;
      return (
        <Dialog title={ui.title} onClose={onClose} sx={styles.root}>
          <Tabs
            label={ui.where}
            tabs={[
              { value: 'local', label: ui.local, icon: HardDrive },
              { value: 'cloud', label: ui.cloud, icon: Cloud },
            ]}
            value={where}
            onChange={(value) => (where = value === 'cloud' ? 'cloud' : 'local')}
            sx={styles.tabs}
          />
          <Scroll sx={styles.body}>
            {where === 'local' ? <LocalSaves {...lists} /> : <CloudSaves {...lists} />}
          </Scroll>
        </Dialog>
      );
    };
  },
);
