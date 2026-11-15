/** 试验场的构建配置：和别的应用同一套 TSX 编译 */
import { vueTsxPro } from '@zerodep-dev/vue-tsx-pro-tsx/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [...vueTsxPro()],
  // 固定端口：和游戏（5180）、文档站（5181、预览 5182）错开；被占用时报错而不是换端口
  server: { port: 5183, strictPort: true },
  preview: { port: 5184, strictPort: true },
});
