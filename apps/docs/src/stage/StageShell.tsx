/**
 * 站点的外壳，舞台版：顶栏、左边的导航、右边的本页目录各占一层（不跟着正文滚），正文是一块由引擎滚动的内容。
 * 上游用的是组件库的 AppShell，它靠浏览器的整页滚动和 `position: sticky` 把顶栏、侧栏粘住；
 * 滚动由引擎接管之后正文并没有真的在滚，粘不住，所以要粘着的东西改成各自成层（见 stage 包的 StageScroll）。
 * 用法和 AppShell 对得上的那几个属性一样（brand、header、sidebar、aside、propsMain、正文），App.tsx 里换个名字就行。
 * 和 AppShell 比还缺的：窄屏时侧栏收进抽屉、侧栏收起成图标栏、全屏、跳到正文的链接。
 */
import { ScrollArea } from '@rune-engine/components';
import { provideScrollRoot } from '@rune-engine/components/scroll-root';
import { StageLayer, StageScroll, type StageScrollHandle } from '@rune-engine/stage';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { nextTick, onBeforeUnmount, onMounted, shallowRef, type VNodeChild } from 'vue';
import { useRouter } from 'vue-router';

export interface StageShellProps {
  /** 顶栏最前面的站点名 */
  brand?: VNodeChild;
  /** 顶栏里站点名后面的东西 */
  header?: VNodeChild;
  /** 左边的导航 */
  sidebar?: VNodeChild;
  /** 右边的一栏（本页目录）；没有就不占地方 */
  aside?: VNodeChild;
  /** 正文那一块的样式 */
  propsMain?: { sx?: SxStyles };
  children?: VNodeChild;
}

/** 顶栏的高、左右两栏的宽（像素；和 AppShell 默认的 3rem、16rem、14rem 一样大） */
const HEADER = 48;
const SIDEBAR = 256;
const ASIDE = 224;
/** 窗口窄于这么多时不放右边那一栏（同 AppShell 的 80rem 断点） */
const ASIDE_FROM = 1280;

const styles = css.create({
  header: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: '_md',
    height: `${HEADER}px`,
    paddingInlineEnd: '_lg',
    color: '_text',
    fontSize: '_md',
    lineHeight: '_normal',
    borderBlockEndWidth: '_xs',
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: '_border',
    backgroundColor: '_surface',
    pointerEvents: 'auto',
  },
  brand: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    width: `${SIDEBAR}px`,
    flexShrink: 0,
    paddingInlineStart: '_lg',
  },
  headerContent: { display: 'flex', alignItems: 'center', gap: '_md', flexGrow: 1, minWidth: 0 },
  rail: {
    boxSizing: 'border-box',
    color: '_text',
    fontSize: '_md',
    lineHeight: '_normal',
    backgroundColor: '_surface',
    pointerEvents: 'auto',
  },
  sidebar: {
    width: `${SIDEBAR}px`,
    borderInlineEndWidth: '_xs',
    borderInlineEndStyle: 'solid',
    borderInlineEndColor: '_border',
  },
  aside: { width: `${ASIDE}px` },
  railScroll: { height: '100%' },
  railContent: { paddingBlock: '_lg', paddingInline: '_md' },
  // 正文的视口：顶栏下面、两栏之间
  viewport: { position: 'absolute', insetBlockStart: `${HEADER}px`, insetBlockEnd: 0 },
  main: {
    boxSizing: 'border-box',
    minWidth: 0,
    paddingInline: '_xl',
    color: '_text',
    fontSize: '_md',
    lineHeight: '_normal',
  },
});

export const StageShell = _component(
  ({ brand, header, sidebar, aside, propsMain, children }: StageShellProps) => {
    const router = useRouter();
    const scroll = shallowRef<StageScrollHandle | null>(null);
    // 站点里盯着“整页滚动”的组件（本页目录的高亮、回到顶部）：滚的是正文这一块
    provideScrollRoot(() => scroll.value?.element ?? null);

    let size = _state({ width: innerWidth, height: innerHeight });
    const resize = () => (size = { width: innerWidth, height: innerHeight });
    onMounted(() => addEventListener('resize', resize));
    onBeforeUnmount(() => removeEventListener('resize', resize));

    // 路由自带的“换页回到顶部、带锚点滚到那一节”滚的是窗口；这里照着做一遍
    router.afterEach((to, from) => {
      if (to.path === from.path && to.hash === from.hash) return;
      void nextTick(() => {
        const target = to.hash && document.getElementById(decodeURIComponent(to.hash.slice(1)));
        if (target) scroll.value?.reveal(target, { align: 'start', smooth: to.path === from.path });
        else if (to.path !== from.path) scroll.value?.scrollTo(0);
      });
    });

    return () => {
      const railHeight = `${size.height - HEADER}px`;
      const withAside = Boolean(aside) && size.width >= ASIDE_FROM;
      return (
        <>
          <StageScroll
            sx={styles.viewport}
            contentSx={[styles.main, propsMain?.sx]}
            onReady={(handle) => (scroll.value = handle)}
            // 视口的左右边跟着两栏在不在走
            style={{
              insetInlineStart: `${SIDEBAR}px`,
              insetInlineEnd: withAside ? `${ASIDE}px` : '0px',
            }}
          >
            <main>{children}</main>
          </StageScroll>
          <StageLayer fit="content" order={1.2} x={0} y={HEADER}>
            <div style={{ height: railHeight }} {...css.attrs(styles.rail, styles.sidebar)}>
              <ScrollArea sx={styles.railScroll} propsContent={{ sx: styles.railContent }}>
                {sidebar}
              </ScrollArea>
            </div>
          </StageLayer>
          {withAside && (
            <StageLayer fit="content" order={1.2} x={size.width - ASIDE} y={HEADER}>
              <div style={{ height: railHeight }} {...css.attrs(styles.rail, styles.aside)}>
                <ScrollArea sx={styles.railScroll} propsContent={{ sx: styles.railContent }}>
                  {aside}
                </ScrollArea>
              </div>
            </StageLayer>
          )}
          <StageLayer fit="content" order={1.3} x={0} y={0}>
            <header style={{ width: `${size.width}px` }} {...css.attrs(styles.header)}>
              <div {...css.attrs(styles.brand)}>{brand}</div>
              <div {...css.attrs(styles.headerContent)}>{header}</div>
            </header>
          </StageLayer>
        </>
      );
    };
  },
);
