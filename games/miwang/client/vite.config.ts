import { vueTsxPro } from '@zerodep-dev/vue-tsx-pro-tsx/vite';
import { defineConfig } from 'vite';

/**
 * 服务端（联机的房间、云存档）在另一个进程里（games/miwang/server，本地是 wrangler dev）：把 /api 转给它，
 * 页面就可以像部署之后那样用同一个来源的地址（WebSocket 也转）。没起那个服务时这条转发只是连不上，不影响别的。
 */
const api = { '/api': { target: 'http://127.0.0.1:8787', ws: true } };

/**
 * 两种模式：
 *   默认                 没有服务端：联机的房间只在同一个浏览器的标签页之间通，没有云存档（单独开发客户端时不用另起服务）
 *   --mode online        有服务端，和页面同一个来源（/api）；部署出去的就是这一种
 * 也可以用环境变量 VITE_API_URL 指到别处部署的服务端。
 */
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL ?? (mode === 'online' ? '/api' : ''),
    ),
  },
  plugins: [...vueTsxPro()],
  // 只面向最新的正式版 Chrome：不转旧语法
  build: { target: 'esnext' },
  worker: { format: 'es' },
  // 启动时就把这几个依赖打好包：否则第一次打开页面时才发现它们，会多刷新一次
  // （decimal.js 是内核的依赖，不是客户端直接装的：按“经谁引进来”的写法指给它）
  optimizeDeps: {
    include: [
      'vue',
      '@rune-engine/i18n > @internationalized/date',
      '@rune-engine/core > decimal.js',
    ],
  },
  server: { port: 5180, strictPort: true, proxy: api },
  preview: { proxy: api },
}));
