/**
 * 右下角的开关：现在是哪种摆法（画进画布 / 普通网页），点一下换成另一种。
 * 故意不用组件库的组件：它是用来看组件库的，自己不该受组件库的影响。
 * 它自己占一层（只有按钮那么大）：上面的帧率半秒变一次，只重拍这一小块。
 * 帧率是两条线程的：主线程（网页自己的帧）和渲染线程（画进画布时才有）；括号里是这半秒里最长的一帧。
 */
import { StageLayer, useStage } from '@rune-engine/stage';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { onBeforeUnmount, onMounted } from 'vue';
import { useFrameRates } from './frame-rate';
import { stageMode, switchStageMode } from './mode';

/** 离窗口右下角多远（像素） */
const MARGIN = 16;

const styles = css.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingBlock: '0.375rem',
    paddingInline: '0.75rem',
    font: '500 0.8125rem/1.4 system-ui, sans-serif',
    color: '#fff',
    backgroundColor: { default: 'rgba(20, 24, 32, 0.88)', ':hover': 'rgba(40, 48, 64, 0.95)' },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: '999px',
    boxShadow: '0 0.25rem 1rem rgba(0, 0, 0, 0.35)',
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  dot: { width: '0.5rem', height: '0.5rem', borderRadius: '50%' },
  // 数字等宽：不然每次变都在抖
  rates: { fontVariantNumeric: 'tabular-nums', opacity: 0.8 },
  canvas: { backgroundColor: '#f5a524' },
  dom: { backgroundColor: '#8b93a7' },
});

export const StageSwitch = _component(() => {
  const stage = useStage();
  const rates = useFrameRates();
  const show = (label: string, stats: { fps: number; worstMs: number } | null) =>
    stats ? `${label} ${Math.round(stats.fps)} 帧（最长 ${Math.round(stats.worstMs)} 毫秒）` : '';
  let layer: HTMLElement | null = null;
  /** 这一层的左上角放在哪：窗口的右下角往里收一点 */
  let at = _state({ x: 0, y: 0 });
  const place = () => {
    if (!layer) return;
    at = {
      x: innerWidth - layer.offsetWidth - MARGIN,
      y: innerHeight - layer.offsetHeight - MARGIN,
    };
  };
  // 这一层的元素比这个组件晚一拍才有（舞台挂上之后才传送过去）：元素来了再摆
  const setLayer = (element: HTMLElement | null) => {
    layer = element;
    place();
  };
  onMounted(() => addEventListener('resize', place));
  onBeforeUnmount(() => removeEventListener('resize', place));

  return () => {
    const unsupported = stageMode === 'canvas' && stage?.supported === false;
    return (
      <StageLayer fit="content" order={2.9} x={at.x} y={at.y} layerRef={setLayer}>
        <button
          type="button"
          data-stage-switch
          title="换一种摆法（整页重新加载）"
          onClick={() => switchStageMode(stageMode === 'canvas' ? 'dom' : 'canvas')}
          {...css.attrs(styles.root)}
        >
          <span {...css.attrs(styles.dot, stageMode === 'canvas' ? styles.canvas : styles.dom)} />
          {unsupported
            ? '这个浏览器不能画进画布（现在是普通网页）'
            : stageMode === 'canvas'
              ? '现在：画进画布 · 点一下换成普通网页'
              : '现在：普通网页 · 点一下换成画进画布'}
          <span {...css.attrs(styles.rates)}>
            {[show('主线程', rates.main.value), show('渲染线程', rates.render.value)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </button>
      </StageLayer>
    );
  };
});
