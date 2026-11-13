/**
 * 主界面：整屏的地图（画布在渲染 Worker 里画），上面压一层界面。
 * 界面层自己不接收指针，只有面板和按钮接收：点得到下面的地图。
 */
import { DateFormatter, parseDate } from '@internationalized/date';
import { regions } from '@miwang/content';
import {
  ATTACKER,
  COSTS,
  DEFENDER,
  MEASURE_BITS,
  type OutbreakView,
  type Trait,
} from '@miwang/sim';
import { ActionButton, colors, fonts, Frame, Readout, Segmented } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted } from 'vue';
import { createGameSession, type GameSession } from './session.ts';

const TRAITS: { trait: Trait; label: string }[] = [
  { trait: 'transmission', label: '更易传播' },
  { trait: 'severity', label: '症状更重' },
  { trait: 'stealth', label: '更难发现' },
];

const dateFormat = new DateFormatter('zh-CN', { dateStyle: 'long', timeZone: 'UTC' });
const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });

const styles = css.create({
  root: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' },
  // 避开刘海和手势区（手机横屏）
  layer: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gridTemplateRows: 'auto 1fr auto',
    gap: '0.75rem',
    paddingBlock: 'max(0.75rem, env(safe-area-inset-top))',
    paddingInline: 'max(0.75rem, env(safe-area-inset-left))',
    pointerEvents: 'none',
  },
  status: { gridColumn: '1', gridRow: '1' },
  readouts: { display: 'flex', flexWrap: 'wrap', gap: '1.25rem' },
  date: { fontFamily: fonts.numeric, fontSize: '0.9375rem', color: colors.text },
  side: {
    gridColumn: '3',
    gridRow: '1 / span 2',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '15rem',
    overflowY: 'auto',
  },
  actions: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  bottom: {
    gridColumn: '1 / span 3',
    gridRow: '3',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  controls: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  note: {
    maxWidth: '26rem',
    fontFamily: fonts.text,
    fontSize: '0.75rem',
    lineHeight: 1.5,
    color: colors.textMuted,
  },
  // 邀请地址要能选中复制（页面整体关了选字）
  invite: { userSelect: 'text', pointerEvents: 'auto', wordBreak: 'break-all', color: colors.text },
  error: { color: colors.danger },
});

/** 守方的“重点地区”：上报最多的几个，可以逐个封锁 */
function hotRegions(view: OutbreakView) {
  return [...view.intensity.keys()]
    .filter((index) => view.intensity[index]! > 0)
    .sort((a, b) => view.intensity[b]! - view.intensity[a]!)
    .slice(0, 6);
}

export const App = _component(() => {
  let canvas = _state.raw<HTMLCanvasElement | null>(null);
  let game = _state.raw<GameSession | null>(null);
  let invite = _state<string | null>(null);
  onMounted(() => {
    if (canvas) game = createGameSession(canvas);
  });
  onBeforeUnmount(() => game?.dispose());

  /** 最下面那行小字：出错了说错误，否则说这一局的来历 */
  const note = (session: GameSession) => {
    if (session.renderError.value) return session.renderError.value;
    if (session.role === 'guest') return `已加入房间 ${session.room.value}，主机在另一位玩家那边。`;
    const resumed = session.resumed.value;
    if (resumed) {
      return `这一局是照着记录重放接上的：${resumed.ticks} 天，用了 ${resumed.replayMs.toFixed(0)} 毫秒。`;
    }
    return '架构验证版：人口、航线、传播参数都是占位数，不是任何真实疾病。';
  };

  return () => {
    const view = game?.view.value ?? null;
    const attacker = game?.player.value === ATTACKER;
    const host = game?.role === 'host';
    const human = game?.opponent.value === 'human';
    return (
      <div {...css.attrs(styles.root)}>
        <canvas
          ref={_toRef(canvas)}
          aria-label="世界地图：各地区的感染程度"
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
                    {hotRegions(view).map((index) => {
                      const locked = (view.measures[index]! & MEASURE_BITS.lockdown) !== 0;
                      return (
                        <ActionButton
                          key={index}
                          active={locked}
                          detail={locked ? '封锁中' : `封锁 · ${COSTS.measure}`}
                          disabled={!locked && view.resource < COSTS.measure}
                          onPress={() =>
                            game?.send({
                              type: 'measure',
                              region: index,
                              measure: 'lockdown',
                              on: !locked,
                            })
                          }
                        >
                          {regions[index]?.name}
                        </ActionButton>
                      );
                    })}
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
        </div>
      </div>
    );
  };
});
