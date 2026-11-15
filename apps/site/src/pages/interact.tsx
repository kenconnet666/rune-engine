/** 指针和滚动、选中和复制 */
import {
  Button,
  Caption,
  Heading,
  Muted,
  Paragraph,
  Row,
  ScrollArea,
  themed,
} from '@rune-engine/kit';
import { Text, View, type ViewPointerEvent } from '@rune-engine/view';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { Demo } from '../Demo';

const styles = themed(({ colors }) => ({
  frame: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
  },
  pad: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  inner: {
    width: 160,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    color: colors.accentText,
    hover: { backgroundColor: colors.accent, color: colors.accentContrast },
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.hover, userSelect: 'none' },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  knob: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: colors.accent,
    cursor: 'grab',
    active: { cursor: 'grabbing' },
  },
  row: { flexDirection: 'row', alignItems: 'center', height: 32, paddingInline: 12 },
  rowOdd: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingInline: 12,
    backgroundColor: colors.surface,
  },
  cell: { width: 120 },
  quote: { padding: 16, gap: 8, borderRadius: 8, backgroundColor: colors.surface },
}));

export const Events = _component(() => {
  let log = _state<string[]>([]);
  const say = (line: string) => (log = [line, ...log].slice(0, 5));
  /** 滑块的位置（0–1）和它那条轨道有多宽 */
  let value = _state(0.3);
  let trackWidth = _state(0);
  let dragging: { pointer: number; value: number } | null = null;
  const KNOB = 20;

  return () => (
    <>
      <Heading level={1}>指针和滚动</Heading>
      <Paragraph>
        浏览器不知道节点在哪。页面只把“指针到了画布上的哪个位置”交进来，谁被点到、谁被指着、该滚哪个盒子，
        都是我们自己算的。事件照网页的习惯：点击从被点到的节点往上冒，进来、出去不冒。
      </Paragraph>

      <Demo
        title="点击、进出"
        note="里面的色块和外面的框各有处理函数：点色块，点击先到它、再冒到外面；进到色块里不算从外面出去。"
        code={`<View onClick={() => say('外面被点')} onPointerenter={…} onPointerleave={…}>
  <View onClick={() => say('里面被点')} onPointerenter={…} onPointerleave={…} />
</View>`}
      >
        <View
          style={styles().pad}
          onClick={() => say('外面：点击（冒上来的，或者直接点的空白）')}
          onPointerenter={() => say('外面：进来')}
          onPointerleave={() => say('外面：出去')}
        >
          <View
            style={styles().inner}
            onClick={() => say('里面：点击')}
            onPointerenter={() => say('里面：进来')}
            onPointerleave={() => say('里面：出去')}
          >
            <Text>指着我、点我</Text>
          </View>
        </View>
        <View style={{ gap: 2, height: 100 }}>
          {log.length === 0 ? <Caption>动一动指针，这里会记下发生了什么</Caption> : null}
          {log.map((line, index) => (
            <Caption key={`${index}${line}`}>{line}</Caption>
          ))}
        </View>
      </Demo>

      <Demo
        title="拖：按下时抓住指针"
        note="在 pointerdown 里叫 event.capture()，之后指针挪到哪、在哪松开都发给这个节点。滚动条的滑块也是这么拖的。"
        code={`<View
  onPointerdown={(event) => { event.capture(); dragging = { pointer: event.x, value }; }}
  onPointermove={(event) => { if (dragging) value = dragging.value + (event.x - dragging.pointer) / width; }}
  onPointerup={() => (dragging = null)}
/>`}
      >
        <View style={{ paddingBlock: 8 }}>
          <View style={styles().track} onLayout={(node) => (trackWidth = node.width)}>
            <View style={{ ...styles().fill, width: value * trackWidth }} />
            <View
              style={{ ...styles().knob, left: value * (trackWidth - KNOB) }}
              onPointerdown={(event: ViewPointerEvent) => {
                event.capture();
                dragging = { pointer: event.x, value };
              }}
              onPointermove={(event: ViewPointerEvent) => {
                if (!dragging || trackWidth <= KNOB) return;
                const next = dragging.value + (event.x - dragging.pointer) / (trackWidth - KNOB);
                value = Math.max(0, Math.min(1, next));
              }}
              onPointerup={() => (dragging = null)}
            />
          </View>
        </View>
        <Muted>{`${Math.round(value * 100)}%`}</Muted>
      </Demo>

      <Demo
        title="滚动"
        note="overflow: 'scroll' 的盒子滚轮能滚，滚到头了交给外面的。这里的列表有两千行，每帧只处理露出来的那几行。"
        code={`<ScrollArea style={{ height: 220 }}>
  {rows.map((row) => <Row key={row} … />)}
</ScrollArea>`}
      >
        <ScrollArea style={{ ...styles().frame, height: 220 }}>
          {Array.from({ length: 2000 }, (_, index) => (
            <View key={index} style={index % 2 ? styles().rowOdd : styles().row}>
              <Text style={styles().cell}>{`第 ${index + 1} 行`}</Text>
              <Text>{`这是列表里的第 ${index + 1} 项，滚轮滚它，或者拖右边的滑块`}</Text>
            </View>
          ))}
        </ScrollArea>
      </Demo>
    </>
  );
});

export const Selection = _component(() => {
  let pasted = _state('');
  return () => (
    <>
      <Heading level={1}>选中和复制</Heading>
      <Paragraph>
        画布上的字对浏览器来说只是像素，浏览器自带的拖选认不出来，所以选区是我们自己的：
        从哪段字的第几个字符到哪段字的第几个字符。这一页的字、整个站的字，都可以选。
      </Paragraph>

      <Demo
        title="试一试"
        note="拖着选；双击选一个词；三击选整段；按着 Shift 再点一下是接着选；Ctrl+A 全选；Esc 或者点空白处取消。选好了按 Ctrl+C。"
      >
        <View style={styles().quote}>
          <Paragraph>
            人生天地之间，若白驹之过隙，忽然而已。The quick brown fox jumps over the lazy dog.
          </Paragraph>
          <Paragraph>
            选区可以跨段、跨行、跨格子。光标停在哪是按“字”算的——一个表情 👍、一个带声调的字母 é
            各算一个。
          </Paragraph>
        </View>
        <Row gap={8} align="center">
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              void navigator.clipboard.readText().then(
                (text) => (pasted = text || '（剪贴板是空的）'),
                () => (pasted = '（浏览器没让读剪贴板）'),
              );
            }}
          >
            看看剪贴板里现在是什么
          </Button>
          <Caption>点了之后浏览器可能先问一次许可</Caption>
        </Row>
        {pasted ? <Muted style={{ whiteSpace: 'pre' }}>{pasted}</Muted> : null}
      </Demo>

      <Demo
        title="表格：复制出来列对得上"
        note="同一横排里的两段字之间放的是制表符，换行放的是换行符。选几行贴进表格软件，每个格子各归各位。"
      >
        <View style={styles().frame}>
          {[
            ['品名', '数量', '单价'],
            ['苹果', '3 斤', '¥12.50'],
            ['香蕉', '1 把', '¥8.00'],
            ['Dragon fruit', '2 个', '¥19.80'],
          ].map((cells, index) => (
            <View key={cells[0]} style={index % 2 ? styles().rowOdd : styles().row}>
              {cells.map((cell) => (
                <Text key={cell} style={styles().cell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Demo>

      <Demo
        title="不让选"
        note="userSelect: 'none' 的节点连同里面的字都选不中，复制时也跳过。按钮、导航上的字就是这样。"
        code={`<View style={{ userSelect: 'none' }}>
  <Text>这段字选不中</Text>
</View>`}
      >
        <Paragraph>这一段可以选。</Paragraph>
        <View style={{ userSelect: 'none' }}>
          <Paragraph>这一段选不中，从上面拖到下面时会跳过它。</Paragraph>
        </View>
        <Paragraph>这一段又可以选了。</Paragraph>
      </Demo>

      <Heading>还没有的</Heading>
      <Paragraph>
        拖到滚动区域边上时还不会自动滚。浏览器的页内查找（Ctrl+F）、网页翻译看不到画布上的字，要另做。
      </Paragraph>
    </>
  );
});
