/**
 * 右下角的开关：现在是哪种摆法（画进画布 / 普通网页），点一下换成另一种。
 * 故意不用组件库的组件：它是用来看组件库的，自己不该受组件库的影响。
 */
import { useStage } from '@rune-engine/stage';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { stageMode, switchStageMode } from './mode';

const styles = css.create({
  root: {
    position: 'absolute',
    insetInlineEnd: '1rem',
    insetBlockEnd: '1rem',
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
  canvas: { backgroundColor: '#f5a524' },
  dom: { backgroundColor: '#8b93a7' },
});

export const StageSwitch = _component(() => {
  const stage = useStage();
  return () => {
    const unsupported = stageMode === 'canvas' && stage?.supported === false;
    return (
      <button
        type="button"
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
      </button>
    );
  };
});
