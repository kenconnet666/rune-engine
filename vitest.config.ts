import { defineConfig } from 'vitest/config';

// 模拟相关的包都不依赖浏览器：测试直接在 Node 里跑
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'games/*/*/src/**/*.test.ts'],
  },
});
