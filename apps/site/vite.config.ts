/** 文档站的构建配置：和别的应用同一套 TSX 编译 */
import { vueTsxPro } from '@zerodep-dev/vue-tsx-pro-tsx/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [...vueTsxPro()],
  // 固定端口：和游戏（5180）、旧文档站（5181、5182）、试验场（5183、5184）错开；被占用时报错而不是换端口
  server: { port: 5185, strictPort: true },
  preview: { port: 5186, strictPort: true },
});
