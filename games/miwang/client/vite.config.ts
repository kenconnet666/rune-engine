import { vueTsxPro } from '@zerodep-dev/vue-tsx-pro-tsx/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [...vueTsxPro()],
  // 只面向最新的正式版 Chrome：不转旧语法
  build: { target: 'esnext' },
  worker: { format: 'es' },
  // 启动时就把这几个依赖打好包：否则第一次打开页面时才发现它们，会多刷新一次
  optimizeDeps: { include: ['vue', 'decimal.js', '@internationalized/date'] },
  server: { port: 5180, strictPort: true },
});
