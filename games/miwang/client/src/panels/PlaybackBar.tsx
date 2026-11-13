/** 回放时底部中间的进度条：放到第几天了、拖动跳到某一天、退出回放 */
import { ActionButton, Frame, Slider, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { History, X } from 'lucide';
import { useUi } from '../i18n.ts';
import type { GameSession } from '../session.ts';

const styles = css.create({
  root: {
    position: 'absolute',
    insetBlockEnd: '4.5rem',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    width: 'min(34rem, calc(100vw - 2rem))',
  },
  row: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: space.md },
});

export const PlaybackBar = _component(({ game }: { game: GameSession }) => {
  /** 正在拖的时候显示拖到的那一天；松手才真的跳过去（每跳一次主机都要重算一遍） */
  let dragging = _state<number | null>(null);
  return () => {
    const playback = game.playback.value;
    if (!playback) return null;
    const ui = useUi().playback;
    const day = dragging ?? game.view.value?.tick ?? 0;
    return (
      <Frame icon={History} title={ui.title} sx={styles.root}>
        <div {...css.attrs(styles.row)}>
          <Slider
            label={ui.progress(day, playback.length)}
            min={0}
            max={playback.length}
            step={1}
            value={day}
            onChange={(value) => (dragging = value)}
            onPointerup={() => {
              if (dragging !== null) game.seek(dragging);
              dragging = null;
            }}
            onKeyup={() => {
              if (dragging !== null) game.seek(dragging);
              dragging = null;
            }}
          />
          <ActionButton icon={X} onPress={() => game.stopWatching()}>
            {ui.exit}
          </ActionButton>
        </div>
      </Frame>
    );
  };
});
