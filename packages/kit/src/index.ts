/**
 * 一小套基础组件，建在自己画的界面（view 包）上：节点是 View / Text，不是网页元素。
 * 现在够搭一个文档站：主题、文字、按钮、卡片、标记、链接、开关、页签、导航项、滚动区域、代码块。
 */
export { darkTheme, lightTheme, MONO, setTheme, theme, themed, type Theme } from './theme';
export { Caption, Heading, Label, Muted, Paragraph, type TextProps } from './Typography';
export { Button, type ButtonProps } from './Button';
export { Badge, Card, Column, Divider, Link, Row, type StackProps } from './surfaces';
export { NavItem, Switch, Tabs } from './controls';
export { ScrollArea, type ScrollAreaProps } from './ScrollArea';
export { CodeBlock } from './CodeBlock';
