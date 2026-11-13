/**
 * 主界面：整屏的地图（画布在渲染 Worker 里画），上面压一层界面。
 * 界面层自己不接收指针，只有面板和按钮接收：拖得动、点得到下面的地图。
 *
 * 布局：左边一列是态势和新闻，右边一列是选中的地区和这一方能做的事，底下一排是时间和地图的控制。
 * 地图和界面互相配合：指针停在一个地区上，旁边出现它的名字；点一下选中，右侧出现它的详情；
 * 点一条和地区有关的新闻，地图飞过去并选中它。
 */
import { regionName } from '@miwang/content';
import { Callout, colors, fonts, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted } from 'vue';
import { createMapController, type MapController } from './map.ts';
import { ControlBar } from './panels/ControlBar.tsx';
import { percent } from './panels/format.ts';
import { NewsPanel } from './panels/NewsPanel.tsx';
import { OpponentPanel } from './panels/OpponentPanel.tsx';
import { OutcomePanel } from './panels/OutcomePanel.tsx';
import { PathogenPanel } from './panels/PathogenPanel.tsx';
import { RegionPanel } from './panels/RegionPanel.tsx';
import { ResearchPanel } from './panels/ResearchPanel.tsx';
import { StatusPanel } from './panels/StatusPanel.tsx';
import { createGameSession, type GameSession } from './session.ts';

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
    overflowY: 'auto',
    scrollbarWidth: 'thin',
  },
  left: { gridColumn: '1', gridRow: '1' },
  right: { gridColumn: '3', gridRow: '1', width: '17rem' },
  bottom: {
    gridColumn: '1 / span 3',
    gridRow: '2',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  note: { maxWidth: '26rem' },
  calloutDetail: { fontFamily: fonts.numeric, color: colors.textMuted },
});

export const App = _component(() => {
  let canvas = _state.raw<HTMLCanvasElement | null>(null);
  let game = _state.raw<GameSession | null>(null);
  let map = _state.raw<MapController | null>(null);
  onMounted(() => {
    if (!canvas) return;
    game = createGameSession(canvas);
    map = createMapController(canvas, game.renderLink);
  });
  onBeforeUnmount(() => {
    map?.dispose();
    game?.dispose();
  });

  /** 最下面那行小字：出错了说错误，否则说这一局的来历 */
  const note = (session: GameSession) => {
    if (session.renderError.value) return session.renderError.value;
    if (session.role === 'guest') return `已加入房间 ${session.room.value}，主机在另一位玩家那边。`;
    const resumed = session.resumed.value;
    if (resumed) {
      return `这一局是照着记录重放接上的：${resumed.ticks} 天，用了 ${resumed.replayMs.toFixed(0)} 毫秒。`;
    }
    return '数值还在调：航线是模型估的，病原体不对应任何真实疾病。';
  };

  return () => {
    const view = game?.view.value ?? null;
    const hovered = map?.hovered.value ?? -1;
    const selected = map?.selected.value ?? -1;
    const pointer = map?.pointer.value ?? null;
    return (
      <div {...css.attrs(styles.root)}>
        <canvas
          ref={_toRef(canvas)}
          aria-label="世界地图：拖动平移，滚轮或双指缩放，点一个地区看详情"
          {...css.attrs(styles.canvas)}
        />
        <div {...css.attrs(styles.layer)}>
          <div {...css.attrs(styles.column, styles.left)}>
            <StatusPanel view={view} />
            {view && <NewsPanel view={view} onLocate={(region) => map?.select(region, true)} />}
          </div>

          {view && game && (
            <div {...css.attrs(styles.column, styles.right)}>
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
                  <PathogenPanel
                    view={view}
                    onEvolve={(trait) => game?.send({ type: 'evolve', trait })}
                  />
                  <ResearchPanel view={view} onResearch={() => {}} />
                </>
              ) : (
                <>
                  <ResearchPanel
                    view={view}
                    onResearch={(tech) => game?.send({ type: 'research', tech })}
                  />
                  <PathogenPanel view={view} onEvolve={() => {}} />
                </>
              )}
              <OpponentPanel game={game} />
            </div>
          )}

          <div {...css.attrs(styles.bottom)}>
            {game && <ControlBar game={game} map={map} />}
            {game && (
              <Note tone={game.renderError.value != null ? 'danger' : 'muted'} sx={styles.note}>
                {note(game)}
              </Note>
            )}
          </div>

          {view && pointer && hovered >= 0 && (
            <Callout x={pointer.x} y={pointer.y}>
              <span>{regionName(hovered)}</span>
              <span {...css.attrs(styles.calloutDetail)}>
                {view.attacker ? '感染程度' : '上报程度'}{' '}
                {percent.format(view.intensity[hovered] ?? 0)}
              </span>
            </Callout>
          )}
        </div>
        {view?.outcome && (
          <OutcomePanel
            view={view}
            onRestart={game?.role === 'host' ? () => game?.restart() : undefined}
          />
        )}
      </div>
    );
  };
});
