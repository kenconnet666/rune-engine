import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // 模拟相关的包都不依赖浏览器：测试直接在 Node 里跑
      {
        test: {
          name: 'node',
          include: ['packages/*/src/**/*.test.ts', 'games/*/*/src/**/*.test.ts'],
          exclude: ['packages/components/**'],
        },
      },
      // 组件库的测试要先编译 TSX、在模拟的 DOM 里跑：用它自己的配置
      'packages/components',
    ],
  },
});
