/**
 * 下载体积的预算（pnpm check:budget）：构建之后量一遍客户端各个文件压缩后的大小，超了线就以 1 退出。
 * 线定在现状上面留出两三成：正常加功能不会碰到，不小心把一个大依赖打进来会。
 * 量的是 gzip 之后的大小（线上传输时还会更小一点，用 brotli）。别的几项预算见 docs/performance.md。
 *
 *   pnpm --filter @miwang/client build && pnpm check:budget
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = join(import.meta.dirname, '../games/miwang/client/dist');

/** 各类文件的上限（gzip 后，KB）。first 是打开页面就要下的那几样加起来；细节网格是画面出来以后才去拿的 */
const BUDGETS = [
  { name: '页面的脚本和样式', match: /^assets\/index-.*\.(js|css)$/, limitKb: 180, first: true },
  { name: '主机线程（模拟）', match: /^assets\/host\.worker-.*\.js$/, limitKb: 32, first: true },
  { name: '渲染线程', match: /^assets\/render\.worker-.*\.js$/, limitKb: 48, first: true },
  {
    name: '地图网格（粗）',
    match: /^assets\/world-mesh-(?!detail).*\.bin$/,
    limitKb: 150,
    first: true,
  },
  { name: '地图网格（细，后台加载）', match: /^assets\/world-mesh-detail-.*\.bin$/, limitKb: 1300 },
  { name: 'index.html', match: /^index\.html$/, limitKb: 4, first: true },
];
/** 打开页面就要下的东西加起来不超过这么多 */
const FIRST_LOAD_LIMIT_KB = 400;

function* files(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) yield* files(join(dir, entry.name), `${path}/`);
    else yield path;
  }
}

let all;
try {
  all = [...files(dist)];
} catch {
  console.error(`没有构建产物（${dist}）：先跑 pnpm --filter @miwang/client build`);
  process.exit(1);
}

const sizes = new Map(all.map((path) => [path, gzipSync(readFileSync(join(dist, path))).length]));
const kb = (bytes) => `${(bytes / 1024).toFixed(1).padStart(7)} KB`;
const problems = [];
let firstLoad = 0;
const counted = new Set();

for (const budget of BUDGETS) {
  const matched = all.filter((path) => budget.match.test(path));
  if (matched.length === 0) {
    problems.push(`${budget.name}：构建产物里没找到（文件名的规则变了？）`);
    continue;
  }
  const bytes = matched.reduce((sum, path) => sum + sizes.get(path), 0);
  for (const path of matched) counted.add(path);
  if (budget.first) firstLoad += bytes;
  const over = bytes > budget.limitKb * 1024;
  console.log(
    `${over ? '✗' : '✓'} ${budget.name.padEnd(14, '　')} ${kb(bytes)} / ${String(budget.limitKb).padStart(5)} KB`,
  );
  if (over) problems.push(`${budget.name}：${kb(bytes).trim()}，超过了 ${budget.limitKb} KB`);
}

// 预算表里没列到的文件：新冒出来的东西要有人看一眼，决定它算哪一类
const unlisted = all.filter((path) => !counted.has(path));
for (const path of unlisted) problems.push(`${path}（${kb(sizes.get(path)).trim()}）不在预算表里`);

const overFirst = firstLoad > FIRST_LOAD_LIMIT_KB * 1024;
console.log(
  `${overFirst ? '✗' : '✓'} ${'打开页面要下的合计'.padEnd(14, '　')} ${kb(firstLoad)} / ${String(FIRST_LOAD_LIMIT_KB).padStart(5)} KB`,
);
if (overFirst)
  problems.push(`打开页面要下的合计 ${kb(firstLoad).trim()}，超过了 ${FIRST_LOAD_LIMIT_KB} KB`);

if (problems.length > 0) {
  console.error(`\n下载体积的预算没过：\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('下载体积的预算通过');
