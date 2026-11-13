/**
 * 主菜单：游戏的名字、那句诗，和几个入口——继续、新开一局、存档与回放、百科、设置。
 * 盖在暂停的地图上：刚打开游戏时先到这里，对局中从底部的“菜单”回来。
 */
import { ActionButton, colors, fonts, Frame, Note, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { BookOpen, History, Play, RotateCcw, Settings } from 'lucide';
import { useUi } from '../i18n.ts';

const styles = css.create({
  // 压暗后面的地图，又看得出它还在
  root: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: 'rgba(3, 6, 9, 0.55)',
    backdropFilter: 'blur(3px)',
    pointerEvents: 'auto',
  },
  panel: { width: '26rem', maxWidth: '90vw', gap: space.md, padding: space.lg },
  name: {
    margin: 0,
    fontFamily: fonts.text,
    fontSize: '2.75rem',
    fontWeight: 400,
    letterSpacing: '0.35em',
    // 字距加在每个字后面，最后一个字后面的那一段要补回来，名字才居中
    marginInlineEnd: '-0.35em',
    textAlign: 'center',
    color: colors.text,
  },
  poem: {
    margin: 0,
    fontSize: '0.8125rem',
    lineHeight: 1.9,
    textAlign: 'center',
    color: colors.textMuted,
  },
});

export const MainMenu = _component(
  ({
    canResume,
    onResume,
    onNewGame,
    onSaves,
    onEncyclopedia,
    onSettings,
  }: {
    /** 有一局正在进行（没分出胜负）：给“继续”这个入口 */
    canResume: boolean;
    onResume: () => void;
    onNewGame: () => void;
    onSaves: () => void;
    onEncyclopedia: () => void;
    onSettings: () => void;
  }) =>
    () => {
      const ui = useUi().menu;
      return (
        <div {...css.attrs(styles.root)}>
          <Frame sx={styles.panel}>
            <h1 {...css.attrs(styles.name)}>{ui.name}</h1>
            <p {...css.attrs(styles.poem)}>{ui.poem}</p>
            <Stack>
              {canResume && (
                <ActionButton icon={Play} active onPress={onResume}>
                  {ui.resume}
                </ActionButton>
              )}
              <ActionButton icon={RotateCcw} active={!canResume} onPress={onNewGame}>
                {ui.newGame}
              </ActionButton>
              <ActionButton icon={History} onPress={onSaves}>
                {ui.saves}
              </ActionButton>
              <ActionButton icon={BookOpen} onPress={onEncyclopedia}>
                {ui.encyclopedia}
              </ActionButton>
              <ActionButton icon={Settings} onPress={onSettings}>
                {ui.settings}
              </ActionButton>
            </Stack>
            <Note>{ui.about}</Note>
          </Frame>
        </div>
      );
    },
);
