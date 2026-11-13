/**
 * 包之间的边界检查（pnpm check:boundaries）：
 *   1. 依赖方向：引擎的包不能依赖游戏；每个包只能依赖下面表里允许的工作区包；
 *   2. 确定性：模拟相关的包（core、net、游戏的 sim）里不能直接用结果随引擎而变的函数与时间。
 * 任何一条不满足就列出来并以 1 退出。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');

/** 每个工作区包允许依赖的工作区包（没列出的包不许出现在仓库里：加包时先在这里登记） */
const ALLOWED = {
  '@rune-engine/core': [],
  '@rune-engine/net': ['@rune-engine/core'],
  '@rune-engine/render': [],
  '@rune-engine/assets-build': ['@rune-engine/render'],
  '@rune-engine/ui': [],
  '@rune-engine/input': [],
  '@rune-engine/audio': [],
  '@rune-engine/i18n': [],
  '@rune-engine/runtime': ['@rune-engine/core', '@rune-engine/net'],
  '@rune-engine/transport': ['@rune-engine/net'],
  '@rune-engine/edge': ['@rune-engine/net'],
  '@miwang/sim': ['@rune-engine/core'],
  '@miwang/content': ['@miwang/sim', '@rune-engine/assets-build', '@rune-engine/render'],
  '@miwang/server': ['@rune-engine/edge', '@rune-engine/net', '@rune-engine/transport'],
  '@miwang/client': [
    '@miwang/sim',
    '@miwang/content',
    '@rune-engine/audio',
    '@rune-engine/core',
    '@rune-engine/i18n',
    '@rune-engine/input',
    '@rune-engine/net',
    '@rune-engine/render',
    '@rune-engine/runtime',
    '@rune-engine/transport',
    '@rune-engine/ui',
  ],
};

/** 模拟相关的包：两端要算出逐位相同的结果 */
const DETERMINISTIC = ['packages/core/src', 'packages/net/src', 'games/miwang/sim/src'];
/** 实测在不同引擎之间不一致的函数，以及会让两次运行不一样的来源 */
const FORBIDDEN =
  /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log2|log10|log1p|cbrt|random)\b|\bDate\.now\b|\bnew Date\b|\bperformance\.now\b/;

const problems = [];

const packageDirs = ['packages', 'games/miwang'].flatMap((dir) =>
  readdirSync(join(root, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, dir, entry.name)),
);

for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const allowed = ALLOWED[manifest.name];
  if (!allowed) {
    problems.push(`${manifest.name}：没有在 scripts/check-boundaries.mjs 的 ALLOWED 里登记`);
    continue;
  }
  const used = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter(
    (name) => name in ALLOWED,
  );
  for (const name of used) {
    if (!allowed.includes(name)) problems.push(`${manifest.name} 不能依赖 ${name}`);
  }
}

function* sources(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) yield path;
  }
}

for (const dir of DETERMINISTIC) {
  for (const path of sources(join(root, dir))) {
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        // 注释里提到这些函数（解释为什么不用）不算
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        const match = FORBIDDEN.exec(code);
        if (match) {
          problems.push(
            `${relative(root, path).replaceAll('\\', '/')}:${index + 1} 用了 ${match[0]}：模拟里用 @rune-engine/core 的确定性版本`,
          );
        }
      });
  }
}

if (problems.length) {
  console.log(`边界检查没过：\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`边界检查通过（${packageDirs.length} 个包）`);
