/**
 * 试验场的外壳（普通网页元素）：上面一条工具栏——换落地方式、换行数、跑“改一批”“连着滚”、看几个数；
 * 下面整块是那张表。表用哪种方式落地看地址里的 mode：view 是自己画的（view 包），dom 是网页元素。
 * 换方式、换行数都是整页重新加载：画布交给渲染线程之后收不回来，而且挂载时间要从干净的页面量起。
 */
import { createViewHost, type ViewHost, type ViewNode } from '@rune-engine/view';
import { runViewRenderer } from '@rune-engine/view/renderer';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { createApp, nextTick, onMounted } from 'vue';
import { COLORS, orders, selected, shuffle } from './data';
import { TableDom } from './TableDom';
import { TableView } from './TableView';

export type LabMode = 'view' | 'dom';

/** 给量性能的脚本用的（scripts/browser/lab.mjs）：页面上按钮做的就是这几件事 */
export interface LabBench {
  readonly mode: LabMode;
  readonly rows: number;
  /** 从开始挂载到之后第二帧过了多久（毫秒）；其中脚本占多少 */
  mountMs: number;
  mountScriptMs: number;
  /** 改一批（200 格）：脚本多久、到之后第二帧多久 */
  update(): Promise<{ scriptMs: number; frameMs: number }>;
  /** 连着滚这么久（毫秒）：主线程一秒几帧、最长的一帧 */
  scroll(ms: number): Promise<{ fps: number; worstMs: number }>;
  /** 现在选中的是哪一行（序号）、表格滚到哪了 */
  state(): { selected: number | null; scrollTop: number };
  /** 渲染线程刚报上来的帧率（自己画的才有） */
  render: { fps: number; worstMs: number } | null;
  /** 自己画的：最近一次重排、列显示列表各多久，列了多少项 */
  host: { layoutMs: number; buildMs: number; items: number } | null;
}

declare global {
  interface Window {
    __lab?: LabBench;
  }
}

const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

type Css = Record<string, string | number>;
const page: Css = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  background: COLORS.page,
  color: COLORS.text,
  font: '13px/1.5 system-ui, sans-serif',
};
// 工具栏两行：上面是按钮，下面是读数。高度是定死的——两种落地下表格的位置要一样，截图才比得了
const bar: Css = {
  flexShrink: 0,
  padding: '8px 12px',
  borderBottom: `1px solid ${COLORS.line}`,
};
const controls: Css = { display: 'flex', alignItems: 'center', gap: '14px', height: '28px' };
const stage: Css = { position: 'relative', display: 'flex', flex: 1, minHeight: 0 };
const fill: Css = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
};
const button: Css = {
  padding: '3px 10px',
  color: 'inherit',
  font: 'inherit',
  background: '#2a2c36',
  border: `1px solid ${COLORS.line}`,
  borderRadius: '6px',
  cursor: 'pointer',
};
const chip = (on: boolean): Css => ({
  ...button,
  textDecoration: 'none',
  background: on ? '#3b5bdb' : '#2a2c36',
});
const numbers: Css = {
  height: '20px',
  marginTop: '4px',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  fontVariantNumeric: 'tabular-nums',
  color: COLORS.muted,
};

export const Lab = _component(({ mode, rows }: { mode: LabMode; rows: number }) => {
  let container: HTMLElement | null = null;
  let mounted = _state('挂载中…');
  let updated = _state('');
  let scrolled = _state('');
  let mainRate = _state('');
  let renderRate = _state('');
  let hostNote = _state('');

  const link = (next: { mode?: LabMode; rows?: number }) =>
    `?mode=${next.mode ?? mode}&rows=${next.rows ?? rows}`;

  onMounted(async () => {
    if (!container) return;
    let scrollTo: (top: number) => void = () => {};
    let limit = () => 0;
    let scrollTop = () => 0;
    let host: ViewHost | null = null;
    const bench: LabBench = {
      mode,
      rows,
      mountMs: 0,
      mountScriptMs: 0,
      render: null,
      host: null,
      state: () => ({ selected: selected.value, scrollTop: scrollTop() }),
      async update() {
        const started = performance.now();
        shuffle();
        await nextTick();
        const scriptMs = performance.now() - started;
        await frame();
        const frameMs = (await frame()) - started;
        updated = `改 200 格：脚本 ${scriptMs.toFixed(1)} 毫秒，到出画面 ${frameMs.toFixed(1)} 毫秒`;
        return { scriptMs, frameMs };
      },
      async scroll(ms) {
        const gaps: number[] = [];
        let last = await frame();
        const started = last;
        let top = 0;
        let step = 37;
        while (last - started < ms) {
          top += step;
          if (top > limit() || top < 0) {
            step = -step;
            top += step * 2;
          }
          scrollTo(top);
          const now = await frame();
          gaps.push(now - last);
          last = now;
        }
        const fps = gaps.length / (ms / 1000);
        const worstMs = Math.max(...gaps);
        scrolled = `连着滚：主线程一秒 ${fps.toFixed(0)} 帧，最长一帧 ${worstMs.toFixed(0)} 毫秒`;
        return { fps, worstMs };
      },
    };

    const started = performance.now();
    if (mode === 'dom') {
      createApp(TableDom, {
        onBody(element: HTMLElement | null) {
          if (!element) return;
          scrollTo = (top) => (element.scrollTop = top);
          limit = () => element.scrollHeight - element.clientHeight;
          scrollTop = () => element.scrollTop;
        },
      }).mount(container);
    } else {
      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, fill);
      container.append(canvas);
      const renderer = runViewRenderer(canvas, {
        onStats(stats) {
          bench.render = stats;
          renderRate = `渲染线程 ${stats.fps.toFixed(0)} 帧（最长 ${stats.worstMs.toFixed(0)} 毫秒）`;
        },
      });
      host = createViewHost(canvas, { send: renderer.send });
      host.mount(TableView, {
        onBody(node: ViewNode | null) {
          if (!node) return;
          scrollTo = (top) => node.scrollTo(0, top);
          limit = () => node.maxScrollTop;
          scrollTop = () => node.scrollTop;
        },
      });
    }
    bench.mountScriptMs = performance.now() - started;
    await frame();
    bench.mountMs = (await frame()) - started;
    mounted = `${orders.value.length} 行挂载：脚本 ${bench.mountScriptMs.toFixed(0)} 毫秒，到出画面 ${bench.mountMs.toFixed(0)} 毫秒`;
    window.__lab = bench;

    // 主线程的帧率：半秒算一次；顺带把自己画的那几个数抄出来
    let since = 0;
    let last = 0;
    let frames = 0;
    let worst = 0;
    const tick = (now: number) => {
      if (last > 0) worst = Math.max(worst, now - last);
      last = now;
      frames++;
      if (now - since >= 500) {
        if (since > 0) {
          mainRate = `主线程 ${((frames * 1000) / (now - since)).toFixed(0)} 帧（最长 ${worst.toFixed(0)} 毫秒）`;
        }
        since = now;
        frames = 0;
        worst = 0;
        if (host) {
          const { layoutMs, buildMs, items } = host.stats;
          bench.host = { layoutMs, buildMs, items };
          hostNote = `上次排版 ${layoutMs.toFixed(2)} 毫秒，列表 ${buildMs.toFixed(2)} 毫秒，${items} 项`;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return () => (
    <div style={page}>
      <div style={bar}>
        <div style={controls}>
          <strong>试验场 · 订单表</strong>
          <span>
            <a href={link({ mode: 'view' })} style={chip(mode === 'view')}>
              自己画
            </a>{' '}
            <a href={link({ mode: 'dom' })} style={chip(mode === 'dom')}>
              网页元素
            </a>
          </span>
          <span>
            {[2000, 20000].map((count) => (
              <>
                <a key={count} href={link({ rows: count })} style={chip(rows === count)}>
                  {count} 行
                </a>{' '}
              </>
            ))}
          </span>
          <button type="button" style={button} onClick={() => void window.__lab?.update()}>
            改 200 格
          </button>
          <button type="button" style={button} onClick={() => void window.__lab?.scroll(3000)}>
            连着滚 3 秒
          </button>
        </div>
        <div style={numbers}>
          {[mainRate, renderRate, mounted, updated, scrolled, hostNote].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div
        data-lab-stage
        style={stage}
        ref={(element: unknown) => (container = element as HTMLElement | null)}
      />
    </div>
  );
});
