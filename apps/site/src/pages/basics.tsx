/** 排版、文字、画法 */
import { Caption, Column, Heading, Muted, Paragraph, Row, Tabs, themed } from '@rune-engine/kit';
import { Text, View, type ViewStyle } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { Block, Demo } from '../Demo';

const styles = themed(({ colors }) => ({
  frame: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
  },
  swatch: { width: 72, height: 48, borderRadius: 8, backgroundColor: colors.accent },
  hint: { color: colors.faint },
}));

export const Layout = _component(() => {
  let justify = _state(0);
  let align = _state(1);
  const JUSTIFY = ['flex-start', 'center', 'flex-end', 'space-between'] as const;
  const ALIGN = ['flex-start', 'center', 'flex-end', 'stretch'] as const;
  return () => (
    <>
      <Heading level={1}>排版</Heading>
      <Paragraph>
        每个盒子都是弹性容器。和 CSS 不一样的地方：默认竖着排、子节点横向撑满；默认不会自己缩，
        要“占满剩下的地方”写 flex: 1；长度只有像素。
      </Paragraph>

      <Demo
        title="横排、竖排、间隔"
        note="flexDirection 定方向，gap 是相邻两个之间的空。"
        code={`<View style={{ flexDirection: 'row', gap: 8 }}>
  <Block label="一" /> <Block label="二" /> <Block label="三" />
</View>
<View style={{ gap: 8 }}>{/* 默认竖着排，横向撑满 */}
  <Block label="甲" /> <Block label="乙" />
</View>`}
      >
        <Row gap={8}>
          <Block label="一" />
          <Block label="二" />
          <Block label="三" />
        </Row>
        <Column gap={8}>
          <Block label="甲（竖排里横向撑满）" />
          <Block label="乙" />
        </Column>
      </Demo>

      <Demo
        title="按份数分"
        note="定宽的照定的；写了 flexGrow 的按份数分剩下的地方。拖动窗口的宽度看它们怎么变。"
        code={`<View style={{ flexDirection: 'row', gap: 8 }}>
  <View style={{ width: 120 }} />      {/* 定宽 */}
  <View style={{ flexGrow: 1 }} />     {/* 一份 */}
  <View style={{ flexGrow: 2 }} />     {/* 两份 */}
</View>`}
      >
        <Row gap={8}>
          <Block label="定宽 120" width={120} />
          <Block label="一份" grow={1} />
          <Block label="两份" grow={2} />
        </Row>
      </Demo>

      <Demo
        title="两个方向的对齐"
        note="justifyContent 管主轴（横排时是左右），alignItems 管交叉轴（横排时是上下）。点页签换。"
        code={`<View style={{ flexDirection: 'row', height: 120, justifyContent, alignItems }}>…</View>`}
      >
        <Row gap={12} align="center">
          <Caption>主轴</Caption>
          <Tabs tabs={JUSTIFY} active={justify} onChange={(index) => (justify = index)} />
        </Row>
        <Row gap={12} align="center">
          <Caption>交叉轴</Caption>
          <Tabs tabs={ALIGN} active={align} onChange={(index) => (align = index)} />
        </Row>
        <View
          style={{
            ...styles().frame,
            flexDirection: 'row',
            gap: 8,
            height: 120,
            padding: 8,
            justifyContent: JUSTIFY[justify],
            alignItems: ALIGN[align],
          }}
        >
          <Block label="一" width={64} height="auto" />
          <Block label="二" width={64} height={56} />
          <Block label="三" width={64} height="auto" />
        </View>
      </Demo>

      <Demo
        title="绝对定位"
        note="position: 'absolute' 的节点不排队，贴着父节点的边放，盖在排着队的兄弟上面。"
        code={`<View style={{ height: 96 }}>
  <Text>排着队的内容</Text>
  <View style={{ position: 'absolute', right: 8, top: 8, width: 72, height: 28 }} />
  <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 6 }} />
</View>`}
      >
        <View style={{ ...styles().frame, height: 96, padding: 12 }}>
          <Muted>排着队的内容</Muted>
          <View style={{ position: 'absolute', right: 8, top: 8 }}>
            <Block label="右上角" />
          </View>
          <View
            style={{
              ...styles().swatch,
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: 8,
              width: undefined,
              height: 6,
            }}
          />
        </View>
      </Demo>
    </>
  );
});

const LONG =
  '排版要知道一段字占多大：宽度定了，就在这个宽度里折行——中文在字之间折，English breaks between words, 换行符处一定断；一个词比一行还宽（比如 https://example.com/a/very/long/path/that/does/not/fit）就在词里面断。';

export const TextPage = _component(() => {
  let width = _state(1);
  const WIDTHS = [240, 420, 640];
  return () => (
    <>
      <Heading level={1}>文字</Heading>
      <Paragraph>
        量和画都交给浏览器的文字引擎，所以字距、中文、系统字体、字体回退都是浏览器的，不用打包字体。
        一段字整段画进一张图集，之后只是贴图。
      </Paragraph>

      <Demo
        title="折行"
        note="换一个宽度，看同一段字怎么重新折。"
        code={`<View style={{ width }}>
  <Text>{一长段字}</Text>   {/* 竖排里的一段字横向撑满，在这个宽度里折行 */}
</View>`}
      >
        <Tabs
          tabs={WIDTHS.map((each) => `${each} 像素`)}
          active={width}
          onChange={(index) => (width = index)}
        />
        <View style={{ ...styles().frame, width: WIDTHS[width], padding: 12 }}>
          <Paragraph>{LONG}</Paragraph>
        </View>
      </Demo>

      <Demo
        title="最多几行、省略号、不折行"
        note="maxLines 限制行数；textOverflow: 'ellipsis' 在被截掉时末尾放省略号；whiteSpace: 'nowrap' 一行到底。"
        code={`<Text style={{ maxLines: 2, textOverflow: 'ellipsis' }}>{一长段字}</Text>
<Text style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{一长段字}</Text>`}
      >
        <View style={{ ...styles().frame, width: 420, padding: 12, gap: 12 }}>
          <Paragraph style={{ maxLines: 2, textOverflow: 'ellipsis' }}>{LONG}</Paragraph>
          <Paragraph style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{LONG}</Paragraph>
        </View>
      </Demo>

      <Demo title="靠哪边" code={`<Text style={{ textAlign: 'center' }}>居中</Text>`}>
        <View style={{ ...styles().frame, padding: 12, gap: 4 }}>
          <Paragraph>靠左（默认）</Paragraph>
          <Paragraph style={{ textAlign: 'center' }}>居中</Paragraph>
          <Paragraph style={{ textAlign: 'right' }}>靠右</Paragraph>
        </View>
      </Demo>

      <Demo
        title="字号、字重、颜色往下传"
        note="文字的样式写在盒子上，里面的字都跟着用；哪一段自己另写了就用自己的。"
        code={`<View style={{ fontSize: 18, color: '#f5a524' }}>
  <Text>跟着父节点</Text>
  <Text style={{ fontWeight: 700 }}>只改了字重</Text>
  <Text style={{ fontSize: 12, color: '#9aa' }}>自己另写</Text>
</View>`}
      >
        <View style={{ fontSize: 18, lineHeight: 28, color: '#f5a524', gap: 4 }}>
          <Text>跟着父节点：18 像素、橙色</Text>
          <Text style={{ fontWeight: 700 }}>只改了字重</Text>
          <Text style={{ fontSize: 12, lineHeight: 18, ...styles().hint }}>
            自己另写了字号和颜色
          </Text>
        </View>
      </Demo>
    </>
  );
});

export const Paint = _component(() => {
  let count = _state(0);
  const box = (extra: ViewStyle): ViewStyle => ({ ...styles().swatch, ...extra });
  return () => (
    <>
      <Heading level={1}>画法</Heading>
      <Paragraph>
        现在有：底色、圆角、边线、不透明度。矩形和文字在显卡那头是同一批四边形，一次画完；
        圆角和边线是在着色器里按“到边的距离”算出来的，放大缩小都是光滑的。
      </Paragraph>

      <Demo
        title="底色、圆角、边线、不透明度"
        code={`<View style={{ backgroundColor: '#3e63dd', borderRadius: 24 }} />
<View style={{ borderWidth: 2, borderColor: '#3e63dd', borderRadius: 8 }} />
<View style={{ backgroundColor: '#3e63dd', opacity: 0.4 }} />`}
      >
        <Row gap={16} align="center">
          <View style={box({})} />
          <View style={box({ borderRadius: 24 })} />
          <View
            style={box({ backgroundColor: undefined, borderWidth: 2, borderColor: '#3e63dd' })}
          />
          <View style={box({ borderWidth: 3, borderColor: '#f5a524', borderRadius: 16 })} />
          <View style={box({ opacity: 0.4 })} />
          <View style={box({ width: 48, borderRadius: 24 })} />
        </Row>
      </Demo>

      <Demo
        title="指着、按着"
        note="样式里的 hover、active 在指针指着、按着的时候叠上去。只改画法的不用重排。"
        code={`<View
  style={{
    backgroundColor: '#2a2c36',
    hover: { backgroundColor: '#3e63dd' },
    active: { backgroundColor: '#f5a524', borderRadius: 24 },
  }}
  onClick={() => count++}
/>`}
      >
        <Row gap={16} align="center">
          <View
            style={box({
              width: 160,
              backgroundColor: '#2a2c36',
              cursor: 'pointer',
              hover: { backgroundColor: '#3e63dd' },
              active: { backgroundColor: '#f5a524', borderRadius: 24 },
            })}
            onClick={() => count++}
          />
          <Muted>{`点了 ${count} 次`}</Muted>
        </Row>
      </Demo>
    </>
  );
});
