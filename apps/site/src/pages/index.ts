/** 站里有哪些页：路径、名字、在导航的哪一组 */
import type { Component } from 'vue';
import { Layout, Paint, TextPage } from './basics';
import { Components } from './components';
import { Events, Selection } from './interact';
import { Performance, Roadmap } from './more';
import { Start } from './start';

export interface Page {
  readonly path: string;
  readonly title: string;
  readonly section: string;
  readonly component: Component;
}

export const sections = ['指南', '内核', '组件', '其它'] as const;

export const pages: readonly Page[] = [
  { path: '/', title: '开始', section: '指南', component: Start as Component },
  { path: '/layout', title: '排版', section: '内核', component: Layout as Component },
  { path: '/text', title: '文字', section: '内核', component: TextPage as Component },
  { path: '/paint', title: '画法', section: '内核', component: Paint as Component },
  { path: '/events', title: '指针和滚动', section: '内核', component: Events as Component },
  { path: '/selection', title: '选中和复制', section: '内核', component: Selection as Component },
  { path: '/components', title: '基础组件', section: '组件', component: Components as Component },
  { path: '/performance', title: '性能', section: '其它', component: Performance as Component },
  {
    path: '/roadmap',
    title: '做了什么、还没做什么',
    section: '其它',
    component: Roadmap as Component,
  },
];
