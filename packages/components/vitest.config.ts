import { vueTsxPro } from '@zerodep-dev/vue-tsx-pro-tsx/vite';
import { defineConfig } from 'vitest/config';

// 测试时完整编译，样式走运行时引擎（预设的默认）
export default defineConfig({
  plugins: [...vueTsxPro()],
  // ExcelJS 的 Node 版（excel.js）在 VM 上下文里引 uuid 的 esm-node 出错；浏览器版自带依赖，与使用方的打包器取的一致（package.json 的 browser）
  resolve: { alias: { exceljs: 'exceljs/dist/exceljs.min.js' } },
  test: {
    name: 'components',
    environment: 'happy-dom',
    // 每个 Worker 只建一次 happy-dom，每个测试文件仍是新的 VM 上下文与 window：建环境、导入模块占了大半时间
    pool: 'vmForks',
    setupFiles: ['./src/utils/.test/setup.ts'],
    passWithNoTests: true,
  },
});
