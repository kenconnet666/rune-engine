/**
 * 文档站的外壳：上面一条顶栏，左边导航，右边是当前这一页（能滚）。整站都是 view 包的节点，画在一张画布里。
 */
import {
  Caption,
  darkTheme,
  Heading,
  lightTheme,
  NavItem,
  ScrollArea,
  setTheme,
  Switch,
  theme,
  themed,
} from '@rune-engine/kit';
import { Text, View, type ViewNode } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { h, watch } from 'vue';
import { pages, sections } from './pages';
import { renderRate, useMainRate } from './rates';
import { go, route } from './router';

/** 正文最宽多少、两边至少留多少（像素） */
const CONTENT_WIDTH = 820;
const GUTTER = 32;

const styles = themed(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.page, color: colors.text, fontSize: 14, lineHeight: 22 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 48,
    paddingInline: 16,
    backgroundColor: colors.surface,
    userSelect: 'none',
  },
  brand: { fontSize: 16, lineHeight: 24, fontWeight: 700 },
  tag: { color: colors.faint },
  spacer: { flex: 1 },
  line: { height: 1, backgroundColor: colors.border },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 232, backgroundColor: colors.surface },
  sidebarContent: { padding: 12, gap: 2, userSelect: 'none' },
  section: { paddingInline: 10, paddingTop: 12, paddingBottom: 4 },
  rule: { width: 1, backgroundColor: colors.border },
  main: { flex: 1 },
  notFound: { gap: 8 },
}));

const PAGE = { gap: 28 };

export const App = _component(() => {
  const mainRate = useMainRate();
  /** 正文那一块有多宽：据此算两边留多少，让正文居中 */
  let width = _state(0);
  let content: ViewNode | null = null;
  // 换页回到顶上
  watch(route, () => content?.scrollTo(0, 0));

  const rate = (label: string, stats: { fps: number; worstMs: number } | null) =>
    stats ? `${label} ${Math.round(stats.fps)} 帧` : '';

  return () => {
    const page = pages.find((each) => each.path === route.value);
    const Page = page?.component;
    const gutter = Math.max(GUTTER, (width - CONTENT_WIDTH) / 2);
    return (
      <View style={styles().root}>
        <View style={styles().header}>
          <Text style={styles().brand}>自己画的界面</Text>
          <Caption style={styles().tag}>整站画在一张画布里，没有网页元素</Caption>
          <View style={styles().spacer} />
          <Caption>
            {[rate('主线程', mainRate.value), rate('渲染线程', renderRate.value)]
              .filter(Boolean)
              .join(' · ')}
          </Caption>
          <Caption>{theme.value === darkTheme ? '深色' : '浅色'}</Caption>
          <Switch
            checked={theme.value === lightTheme}
            onChange={(light) => setTheme(light ? lightTheme : darkTheme)}
          />
        </View>
        <View style={styles().line} />
        <View style={styles().body}>
          <ScrollArea style={styles().sidebar} contentStyle={styles().sidebarContent}>
            {sections.map((section) => (
              <View key={section}>
                <View style={styles().section}>
                  <Caption>{section}</Caption>
                </View>
                {pages
                  .filter((each) => each.section === section)
                  .map((each) => (
                    <NavItem
                      key={each.path}
                      active={each.path === route.value}
                      onPress={() => go(each.path)}
                    >
                      {each.title}
                    </NavItem>
                  ))}
              </View>
            ))}
          </ScrollArea>
          <View style={styles().rule} />
          <ScrollArea
            style={styles().main}
            contentStyle={{ paddingInline: gutter, paddingBlock: 28, gap: 28 }}
            onNode={(node) => (content = node)}
            onLayout={(node) => (width = node.width)}
          >
            <View key={route.value} style={PAGE}>
              {Page ? (
                h(Page)
              ) : (
                <View style={styles().notFound}>
                  <Heading level={1}>没有这一页</Heading>
                  <Caption>{route.value}</Caption>
                </View>
              )}
            </View>
          </ScrollArea>
        </View>
      </View>
    );
  };
});
