/**
 * 代码演练场的主线程部分：把代码交给 Worker 编译、执行结果拿到组件（组件库的 browser-compile 入口）。
 * 用户代码里的 import 都从这张模块表取：复用文档站已经加载的 vue、组件库，不再下载一份。
 */
import * as tsx from '@zerodep-dev/vue-tsx-pro-tsx';
import * as css from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import * as ui from '@rune-engine/components';
import * as tokens from '@rune-engine/components/tokens';
import * as vars from '@rune-engine/components/vars';
import * as vue from 'vue';
import type { Component } from 'vue';
import {
  createCompileClient,
  evaluateModule,
  importedModules,
  type CompileResult,
} from '@zerodep-dev/vue-tsx-pro-tsx/browser-compile';
import CompileWorker from '@zerodep-dev/vue-tsx-pro-tsx/browser-compile/worker?worker';

/** 一直在的模块：文档站本来就加载了 */
const MODULES: Record<string, unknown> = {
  vue,
  '@zerodep-dev/vue-tsx-pro-tsx': tsx,
  '@zerodep-dev/vue-tsx-pro-tsx/styles': css,
  '@rune-engine/components': ui,
  '@rune-engine/components/tokens': tokens,
  '@rune-engine/components/vars': vars,
};

/** 代码里用到时才加载的模块（图标很多；地图、省市区数据几百 KB、3D 带着 three；子路径不在文档站的首屏里） */
const LAZY_MODULES: Record<string, () => Promise<unknown>> = {
  '@lucide/icons': () => import('@lucide/icons'),
  '@rune-engine/components/area': () => import('@rune-engine/components/area'),
  '@rune-engine/components/testing': () => import('@rune-engine/components/testing'),
  '@rune-engine/components/charts': () => import('@rune-engine/components/charts'),
  '@rune-engine/components/maps': () => import('@rune-engine/components/maps'),
  '@rune-engine/components/patterns': () => import('@rune-engine/components/patterns'),
  '@rune-engine/components/diagram': () => import('@rune-engine/components/diagram'),
  '@rune-engine/components/theme-customize': () =>
    import('@rune-engine/components/theme-customize'),
  '@rune-engine/components/xlsx': () => import('@rune-engine/components/xlsx'),
  '@rune-engine/components/code-editor': () => import('@rune-engine/components/code-editor'),
  '@rune-engine/components/three': () => import('@rune-engine/components/three'),
  '@rune-engine/components/docs-kit': () => import('@rune-engine/components/docs-kit'),
  three: () => import('three'),
};

/** 用户代码能导入的模块名（组件库的子路径都要在：pages 测试检查） */
export const playgroundModuleNames: readonly string[] = [
  ...Object.keys(MODULES),
  ...Object.keys(LAZY_MODULES),
];

/** 用户代码能导入的模块：一直在的，加上代码里用到的按需模块 */
async function moduleTable(code: string): Promise<Record<string, unknown>> {
  const table: Record<string, unknown> = { ...MODULES };
  for (const name of importedModules(code)) {
    const load = LAZY_MODULES[name];
    if (load) table[name] = await load();
  }
  return table;
}

const compiler = createCompileClient(() => new CompileWorker());

/** 编译一段代码（第一次调用时启动 Worker） */
export function compile(code: string): Promise<CompileResult> {
  return compiler.compile(code, { filename: 'Playground.tsx' });
}

/** 执行编译结果，返回它默认导出的组件 */
export async function evaluate(code: string): Promise<Component> {
  const exports = evaluateModule<{ default?: Component }>(code, await moduleTable(code));
  if (!exports.default) throw new Error('代码要 export default 一个组件');
  return exports.default;
}
