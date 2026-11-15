/**
 * 站点的外壳，舞台版：顶栏、左边的导航、右边的本页目录各占一层（不跟着正文滚），正文是一块由引擎滚动的内容。
 * 上游用的是组件库的 AppShell，它靠浏览器的整页滚动和 `position: sticky` 把顶栏、侧栏粘住；
 * 滚动由引擎接管之后正文并没有真的在滚，粘不住，所以要粘着的东西改成各自成层（见 stage 包的 StageScroll）。
 * 用法和 AppShell 对得上的那几个属性一样（brand、header、sidebar、aside、propsMain、正文），App.tsx 里换个名字就行。
 *
 * 跟 AppShell 一样的：
 * - 窗口窄于 64rem 时左边的导航收进从起始边滑出的抽屉，顶栏最前面出现打开它的按钮；抽屉里点了链接、窗口变宽了自动关。
 * - 窄于 80rem 时不放右边那一栏。
 * - 顶栏结束边的全屏按钮（手机宽度不显示）：进去后不显示顶栏和左边的导航，正文占满，同时请求浏览器全屏；
 *   右上角留一个退出按钮，Esc 也退出。浏览器不让全屏时照样把这两块收起来。
 * - 最前面有“跳到正文”的链接（Tab 聚焦时才出现）。
 * 还没有的：侧栏收起成图标栏（站点没用到）；顶栏是实底的（AppShell 的是半透明带模糊，要合成器会“模糊下面的层”才做得出）。
 */
import { Maximize, Menu, Minimize } from '@lucide/icons';
import { Drawer, IconButton, ScrollArea, SkipLink } from '@rune-engine/components';
import { provideScrollRoot } from '@rune-engine/components/scroll-root';
import { StageLayer, StageScroll, type StageScrollHandle } from '@rune-engine/stage';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css, type SxStyles } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  watch,
  type VNodeChild,
} from 'vue';
import { useRouter } from 'vue-router';

export interface StageShellProps {
  /** 顶栏最前面的站点名 */
  brand?: VNodeChild;
  /** 顶栏里站点名后面的东西 */
  header?: VNodeChild;
  /** 左边的导航；窗口窄时收进抽屉 */
  sidebar?: VNodeChild;
  /** 右边的一栏（本页目录）；没有就不占地方，窗口窄时不显示 */
  aside?: VNodeChild;
  /** 正文那一块的样式 */
  propsMain?: { sx?: SxStyles };
  children?: VNodeChild;
}

/** 顶栏的高、左右两栏的宽（像素；和 AppShell 默认的 3rem、16rem、14rem 一样大） */
const HEADER = 48;
const SIDEBAR = 256;
const ASIDE = 224;
/** 窗口宽到多少才有全屏按钮、左边的导航才常驻、才放右边那一栏（同 AppShell 的 48rem、64rem、80rem 断点） */
const FULLSCREEN_FROM = 768;
const SIDEBAR_FROM = 1024;
const ASIDE_FROM = 1280;
/** 全屏时的退出按钮、“跳到正文”离窗口的边多远（像素） */
const EDGE = 8;

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
  // 窄屏：最前面是打开导航的按钮，离边上留一点
  headerNarrow: { paddingInlineStart: '_md' },
  brand: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  // 导航常驻时站点名这一格和导航同宽
  brandRail: { boxSizing: 'border-box', width: `${SIDEBAR}px`, paddingInlineStart: '_lg' },
  headerContent: { display: 'flex', alignItems: 'center', gap: '_md', flexGrow: 1, minWidth: 0 },
  headerMain: { display: 'flex', alignItems: 'center', gap: '_md', flexGrow: 1, minWidth: 0 },
  button: { flexShrink: 0 },
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
  // 全屏时不显示：留在页面里，退出后侧栏滚到哪、展开了哪几组都还在
  hidden: { display: 'none' },
  // 正文的视口：上下左右的边跟着顶栏、两栏在不在走（写在行内样式里）
  viewport: { position: 'absolute', insetBlockEnd: 0 },
  main: {
    boxSizing: 'border-box',
    minWidth: 0,
    paddingInline: '_xl',
    color: '_text',
    fontSize: '_md',
    lineHeight: '_normal',
  },
  // 全屏时的退出按钮：不用时淡一点，不抢正文
  exit: {
    backgroundColor: '_surfaceTranslucent',
    opacity: { default: 0.6, _hover: 1, _focusVisible: 1 },
    pointerEvents: 'auto',
  },
  // “跳到正文”自己占一层，在层里就地放着（它原来是钉在窗口左上角的）；没聚焦时挪到层外面去了，看不见
  skip: { position: 'static', display: 'block', pointerEvents: 'auto' },
  // 抽屉直接挂在舞台的层里，层是不接指针的：给它打开（自己不占地方）
  drawer: { display: 'contents', pointerEvents: 'auto' },
});

export const StageShell = _component(
  ({ brand, header, sidebar, aside, propsMain, children }: StageShellProps) => {
    const router = useRouter();
    const mainId = `${useId()}-main`;
    const scroll = shallowRef<StageScrollHandle | null>(null);
    // 站点里盯着“整页滚动”的组件（本页目录的高亮、回到顶部）：滚的是正文这一块
    provideScrollRoot(() => scroll.value?.element ?? null);

    let size = _state({ width: innerWidth, height: innerHeight });
    /** 窄屏时导航的抽屉开着没有 */
    let drawerOpen = _state(false);
    let fullscreen = _state(false);
    const wide = () => size.width >= SIDEBAR_FROM;
    const resize = () => {
      size = { width: innerWidth, height: innerHeight };
      // 变宽后导航已经常驻了，抽屉没必要再开着
      if (wide()) drawerOpen = false;
    };
    // 抽屉里点了链接（通常是换页）：关上
    const closeOnNavigate = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) drawerOpen = false;
    };

    // 全屏：状态是这里的 fullscreen，浏览器全屏只是顺带的。请求被拒绝时照样收起顶栏和导航，
    // 所以要记下有没有真的进去：只有进去过，离开浏览器全屏（用户按 Esc）才算退出
    let inBrowserFullscreen = false;
    watch(
      () => fullscreen,
      (on) => {
        if (on) {
          drawerOpen = false;
          void document.documentElement.requestFullscreen?.()?.catch(() => undefined);
        } else if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
      },
    );
    // 进、出之后焦点跟到对应的按钮上：原来聚焦的按钮随顶栏收起来了，焦点会掉到页面开头。
    // 焦点还在看得见的地方（正文里的控件）就不动
    watch(
      () => fullscreen,
      (on) => {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && active.checkVisibility?.() !== false) return;
        document
          .querySelector<HTMLElement>(on ? '[data-shell="exit"]' : '[data-shell="fullscreen"]')
          ?.focus();
      },
      { flush: 'post' },
    );
    const onFullscreenChange = () => {
      if (document.fullscreenElement) inBrowserFullscreen = true;
      else if (inBrowserFullscreen) {
        inBrowserFullscreen = false;
        fullscreen = false;
      }
    };
    // 没进浏览器全屏时 Esc 由这里退出；进去了的话浏览器自己处理。弹层先处理了的 Esc 不算
    const onKey = (event: KeyboardEvent) => {
      if (fullscreen && event.key === 'Escape' && !event.defaultPrevented) {
        if (!document.fullscreenElement) fullscreen = false;
      }
    };
    onMounted(() => {
      addEventListener('resize', resize);
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('keydown', onKey);
    });
    onBeforeUnmount(() => {
      removeEventListener('resize', resize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKey);
      if (inBrowserFullscreen && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    });

    // 路由自带的“换页回到顶部、带锚点滚到那一节”滚的是窗口；这里照着做一遍
    router.afterEach((to, from) => {
      if (to.path === from.path && to.hash === from.hash) return;
      void nextTick(() => {
        const target = to.hash && document.getElementById(decodeURIComponent(to.hash.slice(1)));
        if (target) scroll.value?.reveal(target, { align: 'start', smooth: to.path === from.path });
        else if (to.path !== from.path) scroll.value?.scrollTo(0);
      });
    });

    /** 全屏时的退出按钮那一层有多宽：贴着窗口的结束边放 */
    let exitWidth = _state(0);
    const setExit = (element: HTMLElement | null) => {
      if (element) exitWidth = element.offsetWidth;
    };

    return () => {
      const top = fullscreen ? 0 : HEADER;
      const railHeight = `${size.height - top}px`;
      const withSidebar = Boolean(sidebar) && wide();
      const withAside = Boolean(aside) && size.width >= ASIDE_FROM;
      return (
        <>
          {/*
            各层的先后就是键盘 Tab 走的先后（画进画布时层按 order 排在界面画布里）：跳到正文、顶栏、导航、正文、本页目录。
            它们互不遮挡（正文只露出视口那一块），谁的 order 大没有关系；要压在别人上面的（退出全屏、跳到正文）另外给大的
          */}
          {/* 压在顶栏上面（聚焦时盖住它的一角）；tabindex 让它不管排在哪都是头一个 */}
          <StageLayer fit="content" order={1.5} x={EDGE} y={EDGE}>
            <SkipLink href={`#${mainId}`} tabindex={1} sx={styles.skip} />
          </StageLayer>
          <StageLayer fit="content" order={0.3} x={0} y={0}>
            <header
              style={{ width: `${size.width}px` }}
              {...css.attrs(
                styles.header,
                !withSidebar && styles.headerNarrow,
                fullscreen && styles.hidden,
              )}
            >
              {Boolean(sidebar) && !wide() && (
                <IconButton
                  icon={Menu}
                  variant="ghost"
                  tone="neutral"
                  aria-label="打开导航"
                  aria-expanded={drawerOpen}
                  sx={styles.button}
                  onClick={() => (drawerOpen = true)}
                />
              )}
              <div {...css.attrs(styles.brand, withSidebar && styles.brandRail)}>{brand}</div>
              <div {...css.attrs(styles.headerContent)}>
                <div {...css.attrs(styles.headerMain)}>{header}</div>
                {size.width >= FULLSCREEN_FROM && (
                  <IconButton
                    icon={Maximize}
                    variant="ghost"
                    tone="neutral"
                    aria-label="全屏"
                    title="全屏"
                    data-shell="fullscreen"
                    sx={styles.button}
                    onClick={() => (fullscreen = true)}
                  />
                )}
              </div>
            </header>
          </StageLayer>
          {withSidebar && (
            <StageLayer fit="content" order={0.4} x={0} y={HEADER}>
              <div
                style={{ height: railHeight }}
                {...css.attrs(styles.rail, styles.sidebar, fullscreen && styles.hidden)}
              >
                <ScrollArea sx={styles.railScroll} propsContent={{ sx: styles.railContent }}>
                  {sidebar}
                </ScrollArea>
              </div>
            </StageLayer>
          )}
          <StageScroll
            sx={styles.viewport}
            contentSx={[styles.main, propsMain?.sx]}
            onReady={(handle) => (scroll.value = handle)}
            // 视口的边跟着顶栏、两栏在不在走
            style={{
              insetBlockStart: `${top}px`,
              insetInlineStart: withSidebar && !fullscreen ? `${SIDEBAR}px` : '0px',
              insetInlineEnd: withAside ? `${ASIDE}px` : '0px',
            }}
          >
            <main id={mainId} tabindex={-1}>
              {children}
            </main>
          </StageScroll>
          {withAside && (
            <StageLayer fit="content" order={0.6} x={size.width - ASIDE} y={top}>
              <aside style={{ height: railHeight }} {...css.attrs(styles.rail, styles.aside)}>
                <ScrollArea sx={styles.railScroll} propsContent={{ sx: styles.railContent }}>
                  {aside}
                </ScrollArea>
              </aside>
            </StageLayer>
          )}
          {fullscreen && (
            <StageLayer
              fit="content"
              order={1.4}
              x={size.width - exitWidth - EDGE * 2}
              y={EDGE}
              layerRef={setExit}
            >
              <IconButton
                icon={Minimize}
                variant="ghost"
                tone="neutral"
                aria-label="退出全屏"
                title="退出全屏"
                data-shell="exit"
                sx={styles.exit}
                onClick={() => (fullscreen = false)}
              />
            </StageLayer>
          )}
          {Boolean(sidebar) && !wide() && (
            <div {...css.attrs(styles.drawer)}>
              <Drawer title="导航" side="start" _open={drawerOpen} onClick={closeOnNavigate}>
                {sidebar}
              </Drawer>
            </div>
          )}
        </>
      );
    };
  },
);
