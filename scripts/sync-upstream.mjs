/**
 * 跟上游（vue-tsx-pro）同步：把它某个提交的组件库源码和文档站整份取过来，换掉这边的那两份，
 * 再做这边固定要做的那几处改动。来历、为什么这样做见 packages/components/UPSTREAM.md。
 *
 *   node scripts/sync-upstream.mjs <上游仓库的路径> <提交> <版本号>
 *   pnpm install && pnpm check
 *
 * 只读上游仓库（git archive 一个提交，不碰它的工作区）。这边改过的文件它不认识：
 * 目前组件库的源码没改过，所以是整份换；开始在组件上分叉之后，这个脚本只能用来取出上游的新版本做对比，
 * 合并要按两次提交之间的差异来。
 *
 * 文档站里**这边自己的文件**（OWN）不会被换掉；上游有、这边不要的（SKIP）不取。
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const [upstream, commit, version] = process.argv.slice(2);
if (!upstream || !commit || !version) {
  console.error('用法：node scripts/sync-upstream.mjs <上游仓库的路径> <提交> <版本号>');
  process.exit(1);
}
const repo = join(import.meta.dirname, '..');
const NAME = { from: '@zerodep-dev/vue-tsx-pro-ui', to: '@rune-engine/components' };

/** 文档站里这边自己写的：同步时留着（相对 apps/docs） */
const OWN = ['package.json', 'vite.config.ts', 'tsconfig.json', 'src/main.ts', 'src/stage'];
/**
 * 上游文档站里不取的（相对 apps/docs）：流程中心和它的示例、移动端的演示外框、预渲染和部署、
 * 浏览器里的 TypeScript（流程工作室用的）、样式更新的基准页（要另一个样式库来对比）
 */
const SKIP = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'src/main.ts',
  'vitest.browser.config.ts',
  'wrangler.jsonc',
  'mobile-frame.html',
  'deploy',
  'bench',
  'build/tsgo.ts',
  'build/prerender.ts',
  'public/mobile',
  'public/_headers',
  'public/_redirects',
  'public/.assetsignore',
  'src/entry-server.ts',
  'src/mobile-frame.ts',
  'src/flow-center',
  'src/pages/mobile',
  'src/pages/bench',
  'src/pages/stack/Flow.tsx',
  'src/components/patterns/Workflow',
  // 核对的是上游 package.json 的导出表的形状（这边的导出表直接指向源码，形状不一样）
  'src/test/page-imports.test.ts',
];

/** 取出上游那个提交的几个目录，放到一个临时目录里 */
function archive(paths) {
  const out = mkdtempSync(join(tmpdir(), 'upstream-'));
  const tar = execFileSync('git', ['-C', upstream, 'archive', commit, ...paths], {
    maxBuffer: 1 << 30,
  });
  execFileSync('tar', ['-x', '-C', out], { input: tar });
  return out;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

/** 一个目录里所有文本文件的包名换成这边的；返回改了几个文件 */
function rename(dir) {
  let count = 0;
  for (const path of files(dir)) {
    if (!/\.(ts|tsx|md|json|html)$/.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    if (!text.includes(NAME.from)) continue;
    writeFileSync(path, text.replaceAll(NAME.from, NAME.to));
    count++;
  }
  return count;
}

/** 把文件里的一段换掉；那一段得正好出现一次——上游改了那里的话在这里停下来，人来看 */
function patch(path, from, to) {
  const text = readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  if (count !== 1) {
    throw new Error(
      `${relative(repo, path)}：要换的那一段出现了 ${count} 次（应该正好一次）：\n${from}`,
    );
  }
  writeFileSync(
    path,
    text.replace(from, () => to),
  );
}

/** 把文件里的一块删掉：block 认出那一块，认不出来就停下 */
function cut(path, block) {
  const found = block.exec(readFileSync(path, 'utf8'));
  if (!found) throw new Error(`${relative(repo, path)}：找不到要删的那一块：${block}`);
  patch(path, found[0], '');
}

const out = archive(['packages/ui/src', 'packages/ui/package.json', 'apps/docs']);

// —— 组件库 ——
{
  const pkg = join(repo, 'packages/components');
  const src = join(pkg, 'src');
  rmSync(src, { recursive: true });
  cpSync(join(out, 'packages/ui/src'), src, { recursive: true });
  console.log('组件库：文件', [...files(src)].length, '个，改了包名的', rename(src), '个');

  // 核对“运行时导入的第三方依赖列全了”的那个测试：这边的包不算第三方
  const own = "        !specifier.startsWith('@zerodep-dev/vue-tsx-pro-') &&";
  patch(
    join(src, 'utils/.test/dependencies.test.ts'),
    own,
    `${own}\n        !specifier.startsWith('@rune-engine/') &&`,
  );

  // package.json：导出表、依赖、预构建清单跟着上游走（名字、脚本是这边的）
  const theirs = JSON.parse(readFileSync(join(out, 'packages/ui/package.json'), 'utf8'));
  const path = join(pkg, 'package.json');
  const ours = JSON.parse(readFileSync(path, 'utf8'));
  const exports = {};
  for (const [key, value] of Object.entries(theirs.exports)) {
    if (key === './package.json') continue;
    exports[key] = typeof value === 'string' ? value : value['@vue-tsx-pro/source'];
  }
  const next = {
    exports,
    dependencies: { ...theirs.dependencies, '@zerodep-dev/vue-tsx-pro-tsx': 'catalog:' },
    peerDependencies: theirs.peerDependencies,
    peerDependenciesMeta: theirs.peerDependenciesMeta,
    vueTsxPro: theirs.vueTsxPro,
    devDependencies: theirs.devDependencies,
  };
  const changed = Object.keys(next).filter(
    (key) => JSON.stringify(ours[key]) !== JSON.stringify(next[key]),
  );
  Object.assign(ours, next);
  ours.description = `组件库：从 vue-tsx-pro 的组件库（${version}）复制过来、在这边分叉着改，目标是整套能画进画布（见 UPSTREAM.md）`;
  writeFileSync(path, `${JSON.stringify(ours, null, 2)}\n`);
  console.log('组件库：package.json 里变了的项', changed.length ? changed.join('、') : '（没有）');
}

// —— 文档站 ——
{
  const docs = join(repo, 'apps/docs');
  const theirs = join(out, 'apps/docs');
  for (const path of SKIP) rmSync(join(theirs, path), { recursive: true, force: true });
  // 这边自己的文件先拿出来，换完再放回去
  const kept = mkdtempSync(join(tmpdir(), 'docs-own-'));
  for (const path of OWN) {
    if (existsSync(join(docs, path)))
      cpSync(join(docs, path), join(kept, path), { recursive: true });
  }
  for (const name of ['src', 'build', 'public', 'index.html']) {
    rmSync(join(docs, name), { recursive: true, force: true });
  }
  cpSync(theirs, docs, { recursive: true });
  cpSync(kept, docs, { recursive: true });
  rmSync(kept, { recursive: true });
  console.log(
    '文档站：文件',
    [...files(join(docs, 'src'))].length,
    '个，改了包名的',
    rename(docs),
    '个',
  );

  // 没取过来的那几块，引用它们的地方跟着拿掉
  const router = join(docs, 'src/router.ts');
  patch(router, "import { flowRoutes } from './flow-center/routes';\n", '');
  patch(
    router,
    '      // 流程中心（docs/decisions 0009）：自己的应用外壳，引擎跑在浏览器的 Worker 里\n      flowRoutes,\n',
    '',
  );
  cut(router, /\n {6}\/\/ 样式更新基准：[\s\S]*?\n {6}\},/);
  const nav = join(docs, 'src/site/nav.ts');
  patch(nav, "import { MOBILE_SECTIONS } from '../pages/mobile/sections';\n", '');
  cut(nav, /\n {4}\{\n {6}path: '\/stack\/flow',[\s\S]*?\n {4}\},/);
  cut(nav, /\n\/\/ 移动端：[\s\S]*?\n\};\n/);
  patch(
    nav,
    '[guide, ...componentSections, stack, mobile]',
    '[guide, ...componentSections, stack]',
  );
  // 组件的源码在这边的 packages/components
  const api = join(docs, 'build/api.ts');
  patch(api, "'../../../packages/ui'", "'../../../packages/components'");
  // 这边的导出表直接指向源码（上游是按条件分的对象，源码在 @vue-tsx-pro/source 那一项里）
  patch(
    api,
    [
      "    typeof target === 'object' && target !== null",
      '      ? [',
      '          {',
      '            name: `@rune-engine/components${key.slice(1)}`,',
      "            source: (target as Record<string, string>)['@vue-tsx-pro/source']!.replace(",
      "              './src/',",
      "              '',",
      '            ),',
      '          },',
      '        ]',
      '      : [],',
    ].join('\n'),
    [
      "    typeof target === 'string'",
      "      ? [{ name: `@rune-engine/components${key.slice(1)}`, source: target.replace('./src/', '') }]",
      '      : [],',
    ].join('\n'),
  );
}

rmSync(out, { recursive: true });
// 包名变短了，导入语句的折行跟着变：照这边的格式重排一遍，之后格式检查才认
execFileSync('pnpm exec prettier --write packages/components apps/docs --log-level warn', {
  cwd: repo,
  shell: true,
  stdio: 'inherit',
});
console.log(`同步到了 ${version}（${commit}）。接着：pnpm install && pnpm check`);
