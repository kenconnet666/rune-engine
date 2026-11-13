/**
 * 主界面：整屏的地图（画布在渲染 Worker 里画），上面压一层界面。
 * 界面层自己不接收指针，只有面板和按钮接收：拖得动、点得到下面的地图。
 *
 * 布局：左边一列是态势和新闻，右边一列是选中的地区和双方的概况，底下一排是时间和地图的控制。
 * 进化、研究这两件要细看的事在盖住画面的工作台里做（从右边的概况打开）。
 * 地图和界面互相配合：指针停在一个地区上，旁边出现它的名字；点一下选中，右侧出现它的详情；
 * 点一条和地区有关的新闻，地图飞过去并选中它。
 */
import { Callout, colors, fonts, Note, Scroll, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted } from 'vue';
import { placeName, useFormats, useUi } from './i18n.ts';
import { createMapController, type MapController } from './map.ts';
import { ControlBar } from './panels/ControlBar.tsx';
import { Encyclopedia } from './panels/Encyclopedia.tsx';
import { MainMenu } from './panels/MainMenu.tsx';
import { NewsPanel } from './panels/NewsPanel.tsx';
import { OpponentPanel } from './panels/OpponentPanel.tsx';
import { OutcomePanel } from './panels/OutcomePanel.tsx';
import { PathogenPanel } from './panels/PathogenPanel.tsx';
import { RegionPanel } from './panels/RegionPanel.tsx';
import { ResearchPanel } from './panels/ResearchPanel.tsx';
import { SettingsDialog } from './panels/SettingsDialog.tsx';
import { SetupDialog } from './panels/SetupDialog.tsx';
import { StatusPanel } from './panels/StatusPanel.tsx';
import { TrendPanel } from './panels/TrendPanel.tsx';
import { Workbench } from './panels/Workbench.tsx';
import { createGameSession, type GameSession } from './session.ts';

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
  /**
   * 盖在游戏上面的那一层现在是什么：主菜单、开局设置、百科、设置、工作台（进化或研究，看这一方是谁），或者没有。
   * 同一时间只有一个；百科和设置是从主菜单进去的，关掉回到主菜单。
   */
  let overlay = _state<'menu' | 'setup' | 'encyclopedia' | 'settings' | 'workbench' | null>(null);
  onMounted(() => {
    if (!canvas) return;
    game = createGameSession(canvas);
    map = createMapController(canvas, game.renderLink);
    // 自己开的局先到主菜单，时间停着；加入别人房间的直接进对局
    if (game.role === 'host') openMenu();
  });
  /** 回到主菜单：对局暂停 */
  const openMenu = () => {
    overlay = 'menu';
    game?.setPaused(true);
  };

  onBeforeUnmount(() => {
    map?.dispose();
    game?.dispose();
  });

  return () => {
    const ui = useUi();
    const format = useFormats();
    const view = game?.view.value ?? null;
    const hovered = map?.hovered.value ?? -1;
    const selected = map?.selected.value ?? -1;
    const pointer = map?.pointer.value ?? null;

    /** 最下面那行小字：出错了说错误，否则说这一局的来历 */
    const note = (session: GameSession) => {
      if (session.renderError.value) return ui.app.renderLost(session.renderError.value);
      if (session.role === 'guest') return ui.app.guest(session.room.value ?? '');
      const resumed = session.resumed.value;
      if (resumed) return ui.app.resumed(resumed.ticks, resumed.replayMs.toFixed(0));
      return ui.app.disclaimer;
    };

    return (
      <div {...css.attrs(styles.root)}>
        <canvas ref={_toRef(canvas)} aria-label={ui.app.mapLabel} {...css.attrs(styles.canvas)} />
        <div {...css.attrs(styles.layer)}>
          <Scroll sx={[styles.column, styles.left]}>
            <StatusPanel view={view} />
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
                />
              )}
              {/* 自己能动手的那块排在前面 */}
              {view.attacker ? (
                <>
                  <PathogenPanel view={view} onOpen={() => (overlay = 'workbench')} />
                  <ResearchPanel view={view} onOpen={() => {}} />
                </>
              ) : (
                <>
                  <ResearchPanel view={view} onOpen={() => (overlay = 'workbench')} />
                  <PathogenPanel view={view} onOpen={() => {}} />
                </>
              )}
              <OpponentPanel game={game} />
            </Scroll>
          )}

          <div {...css.attrs(styles.bottom)}>
            {game && <ControlBar game={game} map={map} onMenu={openMenu} />}
            {game && (
              <Note tone={game.renderError.value != null ? 'danger' : 'muted'} sx={styles.note}>
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
        {view && overlay === 'workbench' && !view.outcome && (
          <Workbench
            view={view}
            onEvolve={(trait) => game?.send({ type: 'evolve', trait })}
            onResearch={(tech) => game?.send({ type: 'research', tech })}
            onClose={() => (overlay = null)}
          />
        )}
        {view?.outcome && overlay === null && (
          <OutcomePanel
            view={view}
            onRestart={game?.role === 'host' ? () => (overlay = 'setup') : undefined}
          />
        )}
        {game && overlay === 'menu' && (
          <MainMenu
            canResume={view != null && !view.outcome}
            onResume={() => {
              overlay = null;
              game?.setPaused(false);
            }}
            onNewGame={() => (overlay = 'setup')}
            onEncyclopedia={() => (overlay = 'encyclopedia')}
            onSettings={() => (overlay = 'settings')}
          />
        )}
        {game && overlay === 'setup' && (
          <SetupDialog
            game={game}
            onStart={(setup) => {
              overlay = null;
              map?.select(-1);
              game?.restart(setup);
            }}
            // 没开始就关掉：有一局在打就回主菜单，已经分出胜负的回到结算
            onClose={() => (overlay = view?.outcome ? null : 'menu')}
          />
        )}
        {overlay === 'encyclopedia' && <Encyclopedia onClose={() => (overlay = 'menu')} />}
        {overlay === 'settings' && <SettingsDialog onClose={() => (overlay = 'menu')} />}
      </div>
    );
  };
});
