/**
 * 主界面：整屏的地图（画布在渲染 Worker 里画），上面压一层界面。
 * 界面层自己不接收指针，只有面板和按钮接收：拖得动、点得到下面的地图。
 *
 * 布局：左边一列是态势和新闻，右边一列是选中的地区和双方的概况，底下一排是时间和地图的控制。
 * 进化、研究这两件要细看的事在盖住画面的工作台里做（从右边的概况打开）。
 *
 * 目录：panels/ 是对局里一直在的那几块面板，screens/ 是盖住画面的那几层（主菜单、开局设置、工作台、百科、设置、结算）。
 * 地图和界面互相配合：指针停在一个地区上，旁边出现它的名字；点一下选中，右侧出现它的详情；
 * 点一条和地区有关的新闻，地图飞过去并选中它。
 */
import { Callout, colors, colorSafeTheme, fonts, Note, Scroll, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { CHAPTERS, type ChapterId } from '@miwang/content';
import { onBeforeUnmount, onMounted, watchEffect } from 'vue';
import { watchHints } from './chapters/hints.ts';
import { markChapterPassed } from './chapters/progress.ts';
import { placeName, useFormats, useUi } from './i18n.ts';
import { createMapController, type MapController } from './map.ts';
import { palette } from './palette.ts';
import { ControlBar } from './panels/ControlBar.tsx';
import { GoalPanel } from './panels/GoalPanel.tsx';
import { HintPanel } from './panels/HintPanel.tsx';
import { MapOverlay } from './panels/MapOverlay.tsx';
import { Chapters } from './screens/Chapters.tsx';
import { Encyclopedia } from './screens/Encyclopedia.tsx';
import { Joining } from './screens/Joining.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { MainMenu } from './screens/MainMenu.tsx';
import { NewsPanel } from './panels/NewsPanel.tsx';
import { PlaybackBar } from './panels/PlaybackBar.tsx';
import { OpponentPanel } from './panels/OpponentPanel.tsx';
import { Outcome } from './screens/Outcome.tsx';
import { Saves } from './screens/saves/Saves.tsx';
import { PathogenPanel } from './panels/PathogenPanel.tsx';
import { RegionPanel } from './panels/RegionPanel.tsx';
import { ResearchPanel } from './panels/ResearchPanel.tsx';
import { Settings } from './screens/Settings.tsx';
import { Setup } from './screens/Setup.tsx';
import { StatusPanel } from './panels/StatusPanel.tsx';
import { TrendPanel } from './panels/TrendPanel.tsx';
import { Workbench } from './screens/Workbench.tsx';
import { createGameSession, type GameSession } from './session/index.ts';
import { createGameAudio, type GameAudio } from './sound.ts';

/** 小屏幕（手机横屏、很矮的窗口）：两边的面板只留最要紧的，把地图让出来 */
const COMPACT = '@media (max-height: 560px), (max-width: 1000px)';

const styles = css.create({
  root: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    outline: 'none',
    cursor: { default: 'grab', ':active': 'grabbing' },
  },
  // 避开刘海和手势区（手机横屏）
  layer: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gridTemplateRows: '1fr auto',
    gap: space.md,
    paddingBlock: `max(${space.md}, env(safe-area-inset-top))`,
    paddingInline: `max(${space.md}, env(safe-area-inset-left))`,
    pointerEvents: 'none',
  },
  // 两边的列：内容多了自己滚动，不把底下的控制挤出屏幕
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.md,
    minHeight: 0,
    // 给滚动条留出位置，不压在面板的边上
    paddingInlineEnd: space.xs,
  },
  left: { gridColumn: '1', gridRow: '1' },
  right: { gridColumn: '3', gridRow: '1', width: '19rem' },
  bottom: {
    gridColumn: '1 / span 3',
    gridRow: '2',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  // 趋势、新闻、底下那行小字是锦上添花的：小屏幕上收起来
  extra: { display: { default: 'contents', [COMPACT]: 'none' } },
  note: { maxWidth: '26rem', display: { default: 'block', [COMPACT]: 'none' } },
  calloutDetail: { fontFamily: fonts.numeric, color: colors.textMuted },
});

export const App = _component(() => {
  let canvas = _state.raw<HTMLCanvasElement | null>(null);
  let game = _state.raw<GameSession | null>(null);
  let map = _state.raw<MapController | null>(null);
  let audio = _state.raw<GameAudio | null>(null);
  /**
   * 盖在游戏上面的那一层现在是什么：主菜单、章节、开局设置、联机大厅、存档、百科、设置、工作台（进化或研究，看这一方是谁），或者没有。
   * 同一时间只有一个；章节、联机、存档、百科和设置是从主菜单进去的，关掉回到主菜单。
   */
  let overlay = _state<
    | 'menu'
    | 'chapters'
    | 'setup'
    | 'lobby'
    | 'saves'
    | 'encyclopedia'
    | 'settings'
    | 'workbench'
    | null
  >(null);
  onMounted(() => {
    if (!canvas) return;
    game = createGameSession(canvas);
    map = createMapController(canvas, game.renderLink);
    audio = createGameAudio();
    // 自己开的局先到主菜单，时间停着；加入别人房间的直接进对局
    if (game.role === 'host') openMenu();
  });
  /** 回到主菜单：对局暂停 */
  const openMenu = () => {
    overlay = 'menu';
    game?.setPaused(true);
  };
  /** 客人离开房间：回到不带房间号的地址，变回自己开局的主人 */
  const leaveRoom = () => {
    const url = new URL(location.href);
    url.search = '';
    location.href = url.href;
  };

  // 章节里的教学提示：到了该讲的时候讲一句
  const hints = watchHints(() => game?.view.value ?? null);
  // 章节打赢了记一笔（章节页上打勾）
  watchEffect(() => {
    const now = game?.view.value;
    if (now?.scenario && now.outcome?.winner === now.player && !game?.playback.value) {
      markChapterPassed(now.scenario.id as ChapterId, now.attacker);
    }
  });
  /** 开一局（章节或者普通对局）：盖着的那一层收起来，地图上选中的清掉 */
  const startGame = (setup: Parameters<GameSession['restart']>[0]) => {
    overlay = null;
    map?.select(-1);
    game?.restart(setup);
  };

  // 声音跟着状态走：有新闻就响提示音，局势越紧音乐越急；在菜单里、暂停着的时候音乐停下
  watchEffect(() => {
    if (game) audio?.update(game.view.value, overlay === null && !game.paused.value);
  });

  onBeforeUnmount(() => {
    map?.dispose();
    game?.dispose();
    audio?.dispose();
  });

  return () => {
    const ui = useUi();
    const format = useFormats();
    const view = game?.view.value ?? null;
    const hovered = map?.hovered.value ?? -1;
    const selected = map?.selected.value ?? -1;
    const pointer = map?.pointer.value ?? null;
    /** 正在回放：只能看，不能操作 */
    const watching = game?.playback.value != null;
    /** 打的是章节的话，它后面的那一章（最后一章、普通对局没有） */
    const chapterIndex = CHAPTERS.findIndex((chapter) => chapter.id === view?.scenario?.id);
    const nextChapter = chapterIndex >= 0 ? CHAPTERS[chapterIndex + 1]?.id : undefined;

    /** 最下面那行小字：出错了说错误，否则说这一局的来历 */
    const note = (session: GameSession) => {
      if (session.renderError.value) return ui.app.renderLost(session.renderError.value);
      const room = session.room.value;
      if (session.role === 'guest' && room) {
        return room.state === 'joined'
          ? ui.app.guest(room.code, ui.lobby.paths[room.path])
          : ui.app.guestAway;
      }
      const resumed = session.resumed.value;
      if (resumed) return ui.app.resumed(resumed.ticks, resumed.replayMs.toFixed(0));
      return ui.app.disclaimer;
    };

    return (
      <div {...css.attrs(styles.root, palette.value === 'safe' && colorSafeTheme)}>
        <canvas ref={_toRef(canvas)} aria-label={ui.app.mapLabel} {...css.attrs(styles.canvas)} />
        {/* 地名和标记压在地图上、界面的下面 */}
        {view && map && canvas && <MapOverlay map={map} view={view} canvas={canvas} />}
        <div {...css.attrs(styles.layer)}>
          <Scroll sx={[styles.column, styles.left]}>
            <StatusPanel view={view} />
            {view?.scenario && <GoalPanel view={view} />}
            {hints.current.value && overlay === null && !watching && (
              <HintPanel hint={hints.current.value} onDismiss={hints.dismiss} />
            )}
            {view && (
              <div {...css.attrs(styles.extra)}>
                <TrendPanel view={view} />
                <NewsPanel view={view} onLocate={(region) => map?.select(region, true)} />
              </div>
            )}
          </Scroll>

          {view && game && (
            <Scroll sx={[styles.column, styles.right]}>
              {selected >= 0 && (
                <RegionPanel
                  index={selected}
                  view={view}
                  onClose={() => map?.select(-1)}
                  onMeasure={(measure, on) =>
                    game?.send({ type: 'measure', region: selected, measure, on })
                  }
                  readonly={watching}
                />
              )}
              {/* 自己能动手的那块排在前面 */}
              {view.attacker ? (
                <>
                  <PathogenPanel
                    view={view}
                    onOpen={() => (overlay = 'workbench')}
                    readonly={watching}
                  />
                  <ResearchPanel view={view} onOpen={() => {}} />
                </>
              ) : (
                <>
                  <ResearchPanel
                    view={view}
                    onOpen={() => (overlay = 'workbench')}
                    readonly={watching}
                  />
                  <PathogenPanel view={view} onOpen={() => {}} />
                </>
              )}
              {!watching && <OpponentPanel game={game} onOnline={() => (overlay = 'lobby')} />}
            </Scroll>
          )}

          <div {...css.attrs(styles.bottom)}>
            {game && <ControlBar game={game} map={map} onMenu={openMenu} />}
            {game && (
              <Note
                tone={
                  game.renderError.value != null ||
                  (game.role === 'guest' && game.room.value?.state !== 'joined')
                    ? 'danger'
                    : 'muted'
                }
                sx={styles.note}
              >
                {note(game)}
              </Note>
            )}
          </div>

          {view && pointer && hovered >= 0 && (
            <Callout x={pointer.x} y={pointer.y}>
              <span>{placeName(hovered)}</span>
              <span {...css.attrs(styles.calloutDetail)}>
                {view.attacker ? ui.app.infection : ui.app.reported}{' '}
                {format.percent(view.intensity[hovered] ?? 0)}
              </span>
            </Callout>
          )}
        </div>
        {game && overlay === null && <PlaybackBar game={game} />}
        {view && overlay === 'workbench' && !view.outcome && !watching && (
          <Workbench
            view={view}
            onEvolve={(trait) => game?.send({ type: 'evolve', trait })}
            onResearch={(tech) => game?.send({ type: 'research', tech })}
            onClose={() => (overlay = null)}
          />
        )}
        {view?.outcome && overlay === null && !watching && (
          <Outcome
            view={view}
            onRestart={game?.role === 'host' ? () => (overlay = 'setup') : undefined}
            onNextChapter={
              game?.role === 'host' && nextChapter && view.outcome.winner === view.player
                ? () => startGame({ chapter: nextChapter, player: view.player })
                : undefined
            }
            onReplayChapter={
              game?.role === 'host' && view.scenario
                ? () => startGame({ chapter: view.scenario?.id as ChapterId, player: view.player })
                : undefined
            }
          />
        )}
        {game && overlay === 'menu' && (
          <MainMenu
            canResume={view != null && !view.outcome}
            onResume={() => {
              overlay = null;
              game?.setPaused(false);
            }}
            guest={game.role === 'guest'}
            onChapters={() => (overlay = 'chapters')}
            onNewGame={() => (overlay = 'setup')}
            onOnline={() => (overlay = 'lobby')}
            onSaves={() => (overlay = 'saves')}
            onEncyclopedia={() => (overlay = 'encyclopedia')}
            onSettings={() => (overlay = 'settings')}
            onLeave={leaveRoom}
          />
        )}
        {overlay === 'chapters' && (
          <Chapters onStart={startGame} onClose={() => (overlay = 'menu')} />
        )}
        {game && overlay === 'lobby' && <Lobby game={game} onClose={() => (overlay = 'menu')} />}
        {/* 客人还没接上主人的时候：说明现在卡在哪一步，进不去的话说原因 */}
        {game?.role === 'guest' &&
          game.room.value &&
          overlay === null &&
          (view === null || game.room.value.state === 'closed') && (
            <Joining room={game.room.value} onLeave={leaveRoom} />
          )}
        {game && overlay === 'setup' && (
          <Setup
            game={game}
            onStart={startGame}
            // 没开始就关掉：有一局在打就回主菜单，已经分出胜负的回到结算
            onClose={() => (overlay = view?.outcome ? null : 'menu')}
          />
        )}
        {game && overlay === 'saves' && (
          <Saves
            view={watching ? null : view}
            current={watching ? null : game.recording()}
            onLoad={(recording) => {
              overlay = null;
              map?.select(-1);
              game?.load(recording);
            }}
            onWatch={(recording) => {
              overlay = null;
              map?.select(-1);
              game?.watch(recording);
            }}
            onClose={() => (overlay = 'menu')}
          />
        )}
        {overlay === 'encyclopedia' && <Encyclopedia onClose={() => (overlay = 'menu')} />}
        {overlay === 'settings' && <Settings audio={audio} onClose={() => (overlay = 'menu')} />}
      </div>
    );
  };
});
