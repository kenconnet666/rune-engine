/** 开始：这是什么、怎么用 */
import { Badge, Button, Card, CodeBlock, Heading, Muted, Paragraph, Row } from '@rune-engine/kit';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { go } from '../router';

const USAGE = `import { createViewHost, Text, View } from '@rune-engine/view';
import { runViewRenderer } from '@rune-engine/view/renderer';

const App = _component(() => () => (
  <View style={{ flex: 1, padding: 16, backgroundColor: '#17181c', color: '#e6e6e6' }}>
    <View
      style={{
        alignSelf: 'flex-start',
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#2a2c36',
        hover: { backgroundColor: '#3b5bdb' },
      }}
      onClick={() => console.log('点了')}
    >
      <Text>一个按钮</Text>
    </View>
  </View>
));

const renderer = runViewRenderer(canvas); // 起渲染线程，画布交给它
const host = createViewHost(canvas, { send: renderer.send });
host.mount(App);`;

export const Start = _component(() => () => (
  <>
    <Heading level={1}>自己画的界面</Heading>
    <Paragraph>
      你现在看到的整个页面——顶栏、导航、这段字、下面的按钮——都画在一张画布里，没有一个网页元素。
      节点树、样式、排版、文字折行、指针命中、选中和复制，都是我们自己的；画是在渲染线程里用 WebGPU
      画的。 组件照常用 Vue 写。
    </Paragraph>
    <Row gap={8}>
      <Badge tone="accent">Vue 驱动</Badge>
      <Badge tone="success">WebGPU 画</Badge>
      <Badge tone="warning">还在第一步</Badge>
    </Row>

    <Heading>为什么这么做</Heading>
    <Paragraph>
      用画布就是要比网页元素更快、更跟手。网页元素每多一个，浏览器就要多算一份样式、多排一次版、多记一份怎么画；
      自己的节点只是一个普通对象。同一张两万行的表，自己画的挂载、更新、滚动都比网页元素快几倍（见“性能”那一页）。
    </Paragraph>
    <Paragraph>
      界面的逻辑和排版在主线程，画在渲染线程。指针的位置一到就转给排版和命中（不等下一帧），
      所以输入到画出来的延迟不比主线程自己画的长，而主线程忙的时候画面照样是满帧的。
    </Paragraph>

    <Heading>怎么用</Heading>
    <Muted>元素只有两种：View 是盒子，Text 是一段字。样式写在 style 上，名字照着 CSS 起。</Muted>
    <CodeBlock code={USAGE} />

    <Heading>从哪看起</Heading>
    <Card>
      <Paragraph>
        左边的导航是按“内核有什么”排的：排版、文字、画法、指针和滚动、选中和复制，然后是建在它上面的一小套组件。
        每一页的示例都是活的，可以点、可以拖、可以选中文字按 Ctrl+C 复制。
      </Paragraph>
      <Row gap={8}>
        <Button onPress={() => go('/layout')}>先看排版</Button>
        <Button variant="outline" onPress={() => go('/selection')}>
          试试选中和复制
        </Button>
        <Button variant="ghost" tone="neutral" onPress={() => go('/roadmap')}>
          还没做的
        </Button>
      </Row>
    </Card>
  </>
));
