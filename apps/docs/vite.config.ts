/**
 * 文档站的构建配置。站点本身是从 vue-tsx-pro 复制来的（scripts/sync-upstream.mjs），这个文件是这边自己的：
 * 没有流程中心、移动端外框、预渲染那几样，组件库直接用 packages/components 的源码（改了组件立刻热更新）。
 */
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
import { browserCompile, vueTsxPro } from '@zerodep-dev/vue-tsx-pro-tsx/vite';
import {
  builtinSystemThemes,
  builtinThemeBootColors,
  themeBootScript,
} from '@rune-engine/components/theme-boot';
import { componentApi } from './build/api.ts';
import { demoSource } from './build/demo.ts';
import { iconImports } from './build/icons.ts';
import { docPages } from './build/pages.ts';

/** 应用加载前按记住的主题设好页面底色，不先闪一下亮色（跟随系统时按系统的明暗与对比度，同 site/theme.ts） */
function themeBoot(): Plugin {
  return {
    name: 'docs:theme-boot',
    transformIndexHtml: () => [
      {
        tag: 'script',
        children: themeBootScript({ themes: builtinThemeBootColors, system: builtinSystemThemes }),
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    iconImports(),
    ...vueTsxPro(),
    // 代码演练场在浏览器里编译 TSX：Babel 的 Node 模块替身与预构建
    browserCompile(),
    demoSource(),
    docPages(),
    componentApi(),
    themeBoot(),
  ],
  // 固定端口：和游戏的开发服务器（5180）错开；被占用时报错而不是换端口
  server: {
    port: 5181,
    strictPort: true,
    warmup: { clientFiles: ['./src/main.ts'] },
  },
  optimizeDeps: {
    include: [
      // 示例里用到的（组件库源码不在运行时导入它）
      'decimal.js',
      'rune-ui-font',
      // 代码高亮的几种语言（src/site/ui.ts 按需导入）：第一次出现代码块时才发现的话，会重新预构建并刷新页面
      '@shikijs/langs/css',
      '@shikijs/langs/html',
      '@shikijs/langs/javascript',
      '@shikijs/langs/json',
      '@shikijs/langs/shellscript',
      '@shikijs/langs/tsx',
      '@shikijs/langs/typescript',
      // 演练场的编辑器：进入演练场才加载，预构建好免得那时才发现新依赖、重新预构建并刷新页面
      '@codemirror/autocomplete',
      '@codemirror/commands',
      '@codemirror/lang-javascript',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/view',
      '@lezer/highlight',
    ],
  },
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1000,
    // 字体分片（rune-ui-font）不内联：内联进 CSS 的小分片不管页面用不用得到，都随 CSS 一起下载
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    rolldownOptions: { experimental: { lazyBarrel: true } },
  },
  test: {
    name: 'docs',
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    // 真浏览器里跑的那批（*.browser.test）还没接上，见 tsconfig.json
    exclude: [...configDefaults.exclude, '**/*.browser.test.{ts,tsx}'],
  },
});
