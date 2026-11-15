/** 性能、还没做的 */
import {
  Badge,
  Button,
  Caption,
  Heading,
  Muted,
  Paragraph,
  Row,
  ScrollArea,
  themed,
} from '@rune-engine/kit';
import { Text, View, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import type { VNodeChild } from 'vue';
import { Demo } from '../Demo';

const styles = themed(({ colors }) => ({
  frame: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
  },
  head: {
    flexDirection: 'row',
    height: 36,
    backgroundColor: colors.surface,
    color: colors.muted,
    fontWeight: 600,
  },
  row: { flexDirection: 'row', height: 32, hover: { backgroundColor: colors.hover } },
  rowOdd: {
    flexDirection: 'row',
    height: 32,
    backgroundColor: colors.surface,
    hover: { backgroundColor: colors.hover },
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingInline: 12,
    overflow: 'hidden',
  },
  wide: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingInline: 12,
    overflow: 'hidden',
  },
  good: { color: colors.success },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemText: { flex: 1 },
}));

/** 量出来的数（开发模式，160 Hz；scripts/browser/lab.mjs） */
const NUMBERS = [
  ['', '2000 行：网页元素', '2000 行：自己画', '两万行：网页元素', '两万行：自己画'],
  ['挂载到出画面', '962 毫秒', '569 毫秒', '8.5 秒', '2.9 秒'],
  ['改 200 格到出画面', '50 毫秒', '14 毫秒', '129 毫秒', '17 毫秒'],
  ['连着滚，主线程帧率', '121 帧/秒', '146 帧/秒', '38 帧/秒', '142 帧/秒'],
];

const CITIES = ['上海', '北京', '杭州', '深圳', '成都', '武汉', '南京', '西安'];
const STATES = ['待付款', '备货中', '已发货', '已完成'];
const COUNTS = [1000, 5000, 20000];

export const Performance = _component(() => {
  let size = _state(0);
  let took = _state('');
  const resize = (index: number) => {
    const started = performance.now();
    size = index;
    // 等界面更新完、下一帧出来再看花了多久
    requestAnimationFrame(() =>
      requestAnimationFrame(
        () =>
          (took = `换成 ${COUNTS[index]} 行用了 ${Math.round(performance.now() - started)} 毫秒`),
      ),
    );
  };
  return () => (
    <>
      <Heading level={1}>性能</Heading>
      <Paragraph>
        用画布就是要比网页元素更快。同一张订单表（7
        列、每行一个状态标记），一边是普通的网页元素，一边是自己画的， 由同一份 Vue
        组件驱动，量挂载、更新、滚动。右上角一直显示着两条线程现在的帧率。
      </Paragraph>

      <View style={styles().frame}>
        {NUMBERS.map((cells, index) => (
          <View
            key={cells[1]}
            style={index === 0 ? styles().head : index % 2 ? styles().row : styles().rowOdd}
          >
            {cells.map((cell, column) => (
              <View key={`${column}`} style={column === 0 ? styles().wide : styles().cell}>
                <Text
                  style={index > 0 && column % 2 === 0 && column > 0 ? styles().good : undefined}
                >
                  {cell}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Caption>
        开发模式下量的，机器忙的时候数会差不少，看两边的比例。并排对比的页面在试验场（pnpm
        dev:lab）。
      </Caption>

      <Demo
        title="一张长表"
        note="这张表就在这一页里，没有做任何“只渲染露出来的行”的处理：每一行都是真的节点。换行数看挂载要多久，滚一滚看帧率。"
      >
        <Row gap={8} align="center">
          {COUNTS.map((count, index) => (
            <Button
              key={count}
              size="sm"
              variant={index === size ? 'solid' : 'outline'}
              tone={index === size ? 'accent' : 'neutral'}
              onPress={() => resize(index)}
            >
              {`${count} 行`}
            </Button>
          ))}
          <Muted>{took}</Muted>
        </Row>
        <View style={styles().frame}>
          <View style={styles().head}>
            {['单号', '城市', '状态', '金额'].map((title) => (
              <View key={title} style={styles().cell}>
                <Text>{title}</Text>
              </View>
            ))}
          </View>
          <ScrollArea style={{ height: 320 }}>
            {Array.from({ length: COUNTS[size]! }, (_, index) => (
              <View key={index} style={index % 2 ? styles().rowOdd : styles().row}>
                <View style={styles().cell}>
                  <Text>{`SO${100001 + index}`}</Text>
                </View>
                <View style={styles().cell}>
                  <Text>{CITIES[(index * 7) % CITIES.length]}</Text>
                </View>
                <View style={styles().cell}>
                  <Text>{STATES[(index * 3) % STATES.length]}</Text>
                </View>
                <View style={styles().cell}>
                  <Text>{`¥${((index * 37) % 9000) + 10}.00`}</Text>
                </View>
              </View>
            ))}
          </ScrollArea>
        </View>
      </Demo>

      <Heading>快在哪</Heading>
      <Paragraph>
        节点只是一个普通对象，不是网页元素：建一个、改一个都便宜得多。排版只重排变了的那一条线。
        每帧只把露出来的东西列成一张表交给渲染线程，两万行的表每帧也就一百来项；矩形和文字在显卡那头一次画完。
      </Paragraph>
    </>
  );
});

const DONE = [
  '节点树，Vue 驱动（组件、响应式、插槽都是 Vue 的）',
  '弹性盒子排版：横排竖排、伸缩、对齐、间隔、内外边距、绝对定位',
  '文字：折行、省略号、对齐、字体往下传',
  '画法：底色、圆角、边线、不透明度',
  '指针：点击、进出、指着和按着的样式、抓住指针拖、滚轮滚动',
  '选中文字和复制',
  '一小套组件：按钮、标记、卡片、页签、开关、滚动区域、代码块',
];
const TODO: [string, string][] = [
  ['一段字里混排', '中间夹一个加粗的词、一段行内代码、一个链接'],
  ['网格排版、百分比', '组件库里有不少用网格和百分比的'],
  ['过渡和动画', '在渲染线程里走，主线程忙也不卡'],
  ['滚动搬到渲染线程', '现在滚动在主线程，主线程卡住它也卡'],
  ['阴影、渐变、图片、图标', '图标是矢量路径，打算和文字一样画进图集'],
  ['焦点和键盘', 'Tab 走焦点、回车空格触发、方向键'],
  ['文字输入', '输入框、输入法（Chrome 上可以直接接在画布上）、粘贴'],
  ['无障碍', '读屏看不到画布上的东西，要另建一棵隐藏的元素树'],
  ['页内查找', '浏览器的 Ctrl+F 看不到画布上的字，要自己做'],
  ['彩色亚像素的文字', '现在是灰度抗锯齿，低分屏上比网页元素略粗'],
  ['完整的组件库', '样式写法对上之后，按层重写'],
];

export const Roadmap = _component(() => {
  const item = (style: ViewStyle | undefined, mark: VNodeChild, title: string, note?: string) => (
    <View key={title} style={styles().item}>
      {mark}
      <View style={styles().itemText}>
        <Paragraph style={style}>{title}</Paragraph>
        {note ? <Caption>{note}</Caption> : null}
      </View>
    </View>
  );
  return () => (
    <>
      <Heading level={1}>做了什么、还没做什么</Heading>
      <Paragraph>这是第一步：内核，加上够搭这个站的一小套组件。</Paragraph>

      <Heading>已经有的</Heading>
      <View style={{ gap: 8 }}>
        {DONE.map((title) => item(undefined, <Badge tone="success">有了</Badge>, title))}
      </View>

      <Heading>还没做的</Heading>
      <View style={{ gap: 10 }}>
        {TODO.map(([title, note]) => item(undefined, <Badge>没做</Badge>, title, note))}
      </View>
    </>
  );
});
