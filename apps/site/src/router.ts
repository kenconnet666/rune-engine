/**
 * 路由：现在在哪一页就是地址里的路径。整站画在画布里，没有 <a>，链接是节点上的点击——
 * 点了改地址（pushState，不重新加载），浏览器的前进后退照常能用。
 */
import { shallowRef } from 'vue';

/** 现在的路径 */
export const route = shallowRef(location.pathname);

export function go(path: string): void {
  if (path === route.value) return;
  history.pushState(null, '', path);
  route.value = path;
}

addEventListener('popstate', () => (route.value = location.pathname));
