/**
 * 致谢的文档和致谢表对得上：docs/credits.md 是给人看的，表（content 的 tables/credits.ts）是游戏里“关于”页用的，
 * 加了新依赖只改了一处的话这里会不过。
 */
import { readFileSync } from 'node:fs';
import { CREDITS, SOURCES } from '@miwang/content';
import { expect, it } from 'vitest';

it('docs/credits.md 里列全了致谢表的每一项（名字、许可证、链接）和每一条资料出处', () => {
  const doc = readFileSync(new URL('../../../../docs/credits.md', import.meta.url), 'utf8');
  const lines = doc.split(/\r?\n/);
  for (const credit of Object.values(CREDITS).flat()) {
    expect(doc, credit.name).toContain(credit.name);
    // 许可证和链接写在这一项的同一行里
    const line = lines.find((candidate) => candidate.includes(credit.url));
    expect(line, `${credit.name} 的链接`).toBeDefined();
    expect(line, `${credit.name} 的许可证`).toContain(credit.license);
  }
  for (const source of Object.values(SOURCES).flat()) {
    expect(doc, source.url).toContain(source.url);
  }
});
