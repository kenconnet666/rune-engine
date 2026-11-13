/**
 * 主界面：整屏的地图（画布在渲染 Worker 里画），上面压一层界面。
 * 界面层自己不接收指针，只有面板和按钮接收：拖得动、点得到下面的地图。
 *
 * 地图和界面互相配合：指针停在一个地区上，旁边出现它的名字；点一下选中，右侧出现它的详情与可做的事；
 * 在“重点地区”里点一个名字，地图飞过去并选中它。
 */
import { DateFormatter, parseDate } from '@internationalized/date';
import { populations, regionName, regions } from '@miwang/content';
import {
  ATTACKER,
  COSTS,
  DEFENDER,
  MEASURE_BITS,
  type Measure,
  type OutbreakView,
  type Trait,
} from '@miwang/sim';
import {
  ActionButton,
  Callout,
  colors,
  Fact,
  fonts,
  Frame,
  Meter,
  Readout,
  Segmented,
  space,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted } from 'vue';
import { createMapController, type MapController } from './map.ts';
import { createGameSession, type GameSession } from './session.ts';

const TRAITS: { trait: Trait; label: string }[] = [
  { trait: 'transmission', label: '更易传播' },
  { trait: 'severity', label: '症状更重' },
  { trait: 'stealth', label: '更难发现' },
];

const MEASURES: { measure: Measure; label: string; on: string }[] = [
  { measure: 'lockdown', label: '封锁', on: '封锁中' },
  { measure: 'testing', label: '加强检测', on: '检测中' },
];

const dateFormat = new DateFormatter('zh-CN', { dateStyle: 'long', timeZone: 'UTC' });
const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 0 });

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
    gridTemplateRows: 'auto 1fr auto',
    gap: space.md,
    paddingBlock: `max(${space.md}, env(safe-area-inset-top))`,
    paddingInline: `max(${space.md}, env(safe-area-inset-left))`,
    pointerEvents: 'none',
  },
  status: { gridColumn: '1', gridRow: '1' },
  readouts: { display: 'flex', flexWrap: 'wrap', gap: space.lg },
  date: { fontFamily: fonts.numeric, fontSize: '0.9375rem', color: colors.text },
  side: {
    gridColumn: '3',
    gridRow: '1 / span 2',
    display: 'flex',
    flexDirection: 'column',
    gap: space.md,
    width: '15rem',
    minHeight: 0,
    overflowY: 'auto',
  },
  actions: { display: 'flex', flexDirection: 'column', gap: space.sm },
  bottom: {
    gridColumn: '1 / span 3',
    gridRow: '3',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  controls: { display: 'flex', flexWrap: 'wrap', gap: space.md },
  zoom: { display: 'flex', gap: space.xs },
  note: {
    maxWidth: '26rem',
    fontFamily: fonts.text,
    fontSize: '0.75rem',
    lineHeight: 1.5,
    color: colors.textMuted,
  },
  // 邀请地址要能选中复制（页面整体关了选字）
  invite: { userSelect: 'text', pointerEvents: 'auto', wordBreak: 'break-all', color: colors.text },
  calloutDetail: { fontFamily: fonts.numeric, color: colors.textMuted },
  error: { color: colors.danger },
});

/** 守方的“重点地区”：上报最多的几个 */
function hotRegions(view: OutbreakView) {
  return [...view.intensity.keys()]
    .filter((index) => view.intensity[index]! > 0)
    .sort((a, b) => view.intensity[b]! - view.intensity[a]!)
    .slice(0, 6);
}

/** 选中的地区：它的情况，以及这一方能对它做的事 */
const RegionPanel = _component(
  ({
    index,
    view,
    onClose,
    onMeasure,
  }: {
    index: number;
    view: OutbreakView;
    onClose: () => void;
    onMeasure: (measure: Measure, on: boolean) => void;
  }) =>
    () => {
      const region = regions[index];
      const level = view.intensity[index] ?? 0;
      const bits = view.measures[index] ?? 0;
      return (
        <Frame title={regionName(index)} onClose={onClose} closeLabel="取消选中">
          <Meter
            label={view.attacker ? '感染程度' : '上报程度'}
            value={level}
            detail={percent.format(level)}
            tone={level > 0.5 ? 'danger' : 'signal'}
          />
          <Fact
            label={`人口（${region?.populationYear} 年）`}
            value={compact.format(populations[index] ?? 0)}
          />
          <Fact label="陆路相邻" value={`${region?.neighbors.length ?? 0} 个地区`} />
          {view.attacker ? (
            (bits & MEASURE_BITS.lockdown) !== 0 && <Fact label="守方措施" value="封锁中" />
          ) : (
            <div {...css.attrs(styles.actions)}>
              {MEASURES.map(({ measure, label, on }) => {
                const active = (bits & MEASURE_BITS[measure]) !== 0;
                return (
                  <ActionButton
                    key={measure}
                    active={active}
                    detail={active ? on : `${COSTS.measure}`}
                    disabled={!active && view.resource < COSTS.measure}
                    onPress={() => onMeasure(measure, !active)}
                  >
                    {label}
                  </ActionButton>
                );
              })}
            </div>
          )}
        </Frame>
      );
    },
);

export const App = _component(() => {
  let canvas = _state.raw<HTMLCanvasElement | null>(null);
  let game = _state.raw<GameSession | null>(null);
  let map = _state.raw<MapController | null>(null);
  let invite = _state<string | null>(null);
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
    return '架构验证版：航线和传播参数都是占位数，不是任何真实疾病。';
  };

  return () => {
    const view = game?.view.value ?? null;
    const attacker = game?.player.value === ATTACKER;
    const host = game?.role === 'host';
    const human = game?.opponent.value === 'human';
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
          <div {...css.attrs(styles.status)}>
            <Frame title={attacker ? '攻方 · 真实态势' : '守方 · 上报态势'}>
              <span {...css.attrs(styles.date)}>
                {view
                  ? `${dateFormat.format(parseDate(view.date).toDate('UTC'))} · 第 ${view.tick} 天`
                  : '正在等主机…'}
              </span>
              {view && (
                <div {...css.attrs(styles.readouts)}>
                  <Readout
                    label={attacker ? '正在发病' : '累计上报'}
                    value={compact.format(view.totals.cases)}
                    tone="signal"
                  />
                  <Readout label="死亡" value={compact.format(view.totals.deaths)} tone="danger" />
                  <Readout label="波及地区" value={`${view.totals.regions} / ${regions.length}`} />
                  <Readout
                    label={attacker ? '变异点数' : '防控预算'}
                    value={whole.format(Math.floor(view.resource))}
                    tone="calm"
                  />
                </div>
              )}
            </Frame>
          </div>

          {view && game && (
            <div {...css.attrs(styles.side)}>
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
              {attacker ? (
                <Frame title="病原体">
                  <div {...css.attrs(styles.actions)}>
                    {TRAITS.map(({ trait, label }) => (
                      <ActionButton
                        key={trait}
                        detail={`${view.traits[trait]} 级 · ${COSTS.evolve} 点`}
                        disabled={view.resource < COSTS.evolve}
                        onPress={() => game?.send({ type: 'evolve', trait })}
                      >
                        {label}
                      </ActionButton>
                    ))}
                  </div>
                </Frame>
              ) : (
                <Frame title="重点地区">
                  <div {...css.attrs(styles.actions)}>
                    {hotRegions(view).map((index) => (
                      <ActionButton
                        key={index}
                        active={index === selected}
                        detail={percent.format(view.intensity[index]!)}
                        onPress={() => map?.select(index, true)}
                      >
                        {regionName(index)}
                      </ActionButton>
                    ))}
                    {hotRegions(view).length === 0 && (
                      <span {...css.attrs(styles.note)}>还没有地区上报病例。</span>
                    )}
                  </div>
                </Frame>
              )}
              <Frame title={human ? '对手 · 另一位玩家' : '对手 · 电脑'}>
                {host && !human && (
                  <ActionButton onPress={() => (invite = game?.openRoom() ?? null)}>
                    邀请另一位玩家
                  </ActionButton>
                )}
                {invite && !human && (
                  <span {...css.attrs(styles.note)}>
                    在这台电脑的另一个标签页打开下面的地址（现在只能连同一个浏览器，网络直连还没做）：
                    <br />
                    <span {...css.attrs(styles.invite)}>{invite}</span>
                  </span>
                )}
                {human && (
                  <span {...css.attrs(styles.note)}>房间 {game.room.value}：两位玩家都在。</span>
                )}
              </Frame>
            </div>
          )}

          <div {...css.attrs(styles.bottom)}>
            <div {...css.attrs(styles.controls)}>
              <Segmented
                label="时间"
                value={game?.paused.value ? 0 : (game?.speed.value ?? 1)}
                options={[
                  { value: 0, label: '暂停' },
                  { value: 1, label: '1×' },
                  { value: 3, label: '3×' },
                  { value: 10, label: '10×' },
                ]}
                onChange={(value) => {
                  game?.setPaused(value === 0);
                  if (value !== 0) game?.setSpeed(Number(value));
                }}
              />
              <div {...css.attrs(styles.zoom)}>
                <ActionButton compact aria-label="放大" onPress={() => map?.zoomBy(1.6)}>
                  ＋
                </ActionButton>
                <ActionButton compact aria-label="缩小" onPress={() => map?.zoomBy(1 / 1.6)}>
                  －
                </ActionButton>
                <ActionButton aria-label="回到整张地图" onPress={() => map?.reset()}>
                  全图
                </ActionButton>
              </div>
              {host && !human && (
                <Segmented
                  label="扮演"
                  value={game?.player.value ?? ATTACKER}
                  options={[
                    { value: ATTACKER, label: '攻方' },
                    { value: DEFENDER, label: '守方' },
                  ]}
                  onChange={(value) => game?.setPlayer(Number(value))}
                />
              )}
              {host && <ActionButton onPress={() => game?.restart()}>新开一局</ActionButton>}
            </div>
            {game && (
              <span {...css.attrs(styles.note, game.renderError.value != null && styles.error)}>
                {note(game)}
              </span>
            )}
          </div>

          {view && pointer && hovered >= 0 && (
            <Callout x={pointer.x} y={pointer.y}>
              <span>{regionName(hovered)}</span>
              <span {...css.attrs(styles.calloutDetail)}>
                {attacker ? '感染程度' : '上报程度'} {percent.format(view.intensity[hovered] ?? 0)}
              </span>
            </Callout>
          )}
        </div>
      </div>
    );
  };
});
