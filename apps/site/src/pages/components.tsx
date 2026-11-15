/** 建在内核上的一小套组件 */
import {
  Badge,
  Button,
  Caption,
  Card,
  CodeBlock,
  Column,
  Divider,
  Heading,
  Label,
  Link,
  Muted,
  Paragraph,
  Row,
  Switch,
  Tabs,
} from '@rune-engine/kit';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { Demo } from '../Demo';
import { go } from '../router';

export const Components = _component(() => {
  let presses = _state(0);
  let tab = _state(0);
  let wifi = _state(true);
  let sync = _state(false);
  const TABS = ['概览', '明细', '记录'];
  return () => (
    <>
      <Heading level={1}>组件</Heading>
      <Paragraph>
        一小套基础组件（kit 包），都是用 View 和 Text 搭的，没有一个网页元素。够搭这个文档站；
        之后按层把完整的组件库重写到这上面。右上角的开关可以换深色、浅色。
      </Paragraph>

      <Demo
        title="按钮"
        note="三种样子、三种色调、两种大小；不可用的变淡、点不到。"
        code={`<Button onPress={() => presses++}>主要操作</Button>
<Button variant="outline">次要</Button>
<Button variant="ghost" tone="neutral">取消</Button>
<Button tone="danger">删除</Button>
<Button size="sm" disabled>不可用</Button>`}
      >
        <Row gap={10} align="center">
          <Button onPress={() => presses++}>主要操作</Button>
          <Button variant="outline" onPress={() => presses++}>
            次要
          </Button>
          <Button variant="ghost" tone="neutral" onPress={() => presses++}>
            取消
          </Button>
          <Button tone="danger" onPress={() => presses++}>
            删除
          </Button>
          <Button tone="danger" variant="outline" onPress={() => presses++}>
            删除
          </Button>
        </Row>
        <Row gap={10} align="center">
          <Button size="sm" onPress={() => presses++}>
            小的
          </Button>
          <Button size="sm" tone="neutral" onPress={() => presses++}>
            中性
          </Button>
          <Button size="sm" disabled>
            不可用
          </Button>
          <Muted>{`按了 ${presses} 次`}</Muted>
        </Row>
      </Demo>

      <Demo title="标记" code={`<Badge tone="success">已完成</Badge>`}>
        <Row gap={8}>
          <Badge>草稿</Badge>
          <Badge tone="accent">进行中</Badge>
          <Badge tone="success">已完成</Badge>
          <Badge tone="warning">待付款</Badge>
          <Badge tone="danger">已退款</Badge>
        </Row>
      </Demo>

      <Demo
        title="页签、开关"
        note="状态由使用方拿着：点了叫回调，改不改由你。"
        code={`<Tabs tabs={['概览', '明细', '记录']} active={tab} onChange={(index) => (tab = index)} />
<Switch checked={wifi} onChange={(next) => (wifi = next)} />`}
      >
        <Tabs tabs={TABS} active={tab} onChange={(index) => (tab = index)} />
        <Muted>{`现在是“${TABS[tab]}”`}</Muted>
        <Divider />
        <Row gap={12} align="center">
          <Switch checked={wifi} onChange={(next) => (wifi = next)} />
          <Label>无线网络</Label>
          <Caption>{wifi ? '开着' : '关了'}</Caption>
        </Row>
        <Row gap={12} align="center">
          <Switch checked={sync} onChange={(next) => (sync = next)} />
          <Label>自动同步</Label>
          <Caption>{sync ? '开着' : '关了'}</Caption>
        </Row>
      </Demo>

      <Demo
        title="卡片、链接"
        code={`<Card>
  <Heading level={3}>订单 SO100001</Heading>
  <Muted>林小满 · 上海</Muted>
  <Link onPress={() => go('/performance')}>看两万行的表</Link>
</Card>`}
      >
        <Row gap={12} align="stretch">
          <Card style={{ flex: 1 }}>
            <Row gap={8} align="center">
              <Heading level={3}>订单 SO100001</Heading>
              <Badge tone="warning">待付款</Badge>
            </Row>
            <Muted>林小满 · 上海 · ¥412.33</Muted>
            <Link onPress={() => go('/performance')}>看两万行的表 →</Link>
          </Card>
          <Card style={{ flex: 1 }}>
            <Row gap={8} align="center">
              <Heading level={3}>订单 SO100002</Heading>
              <Badge tone="success">已完成</Badge>
            </Row>
            <Muted>周一航 · 北京 · ¥1839.01</Muted>
            <Link onPress={() => go('/selection')}>试试选中这张卡片上的字 →</Link>
          </Card>
        </Row>
      </Demo>

      <Demo title="代码块" note="等宽、照原样换行；太宽了按住 Shift 滚滚轮横着滚；右上角复制。">
        <Column gap={8}>
          <CodeBlock
            code={`const styles = themed(({ colors }) => ({
  card: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
}));

export const Card = _component(({ children }) => () => <View style={styles().card}>{children}</View>);`}
          />
        </Column>
      </Demo>
    </>
  );
});
