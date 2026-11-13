/**
 * 关于与致谢：这个游戏是什么、不是什么；用到的数据、参考资料、开源软件各是什么许可、在哪里。
 * 内容照 content 包的致谢表（tables/credits.ts）和各病原体档案的出处（SOURCES）列，不在这里另写一份。
 */
import { CREDITS, SOURCES, type CreditSection } from '@miwang/content';
import { colors, Dialog, fonts, Note, Scroll, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { useContent, useUi } from '../i18n.ts';

const styles = css.create({
  root: { width: 'min(46rem, calc(100vw - 2rem))' },
  body: { flexGrow: 1, minHeight: 0, padding: space.lg },
  text: { margin: 0, fontSize: '0.875rem', lineHeight: 1.7, color: colors.text },
  // 一项：名字（链接）和许可证一行，下面一行说它用来做什么
  item: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    columnGap: space.md,
    paddingBlock: space.xs,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    fontSize: '0.8125rem',
  },
  link: {
    color: { default: colors.text, ':hover': colors.signal },
    textDecorationLine: 'underline',
    textDecorationColor: colors.lineStrong,
    textUnderlineOffset: '0.2em',
    // 页面整体不接收指针、关了选字：链接要点得到
    pointerEvents: 'auto',
  },
  license: { fontFamily: fonts.numeric, color: colors.textMuted },
  purpose: { gridColumn: '1 / span 2', color: colors.textMuted, lineHeight: 1.6 },
});

const SECTIONS: readonly CreditSection[] = ['data', 'references', 'runtime', 'tools'];

/** 各病原体档案的出处，同一个页面只列一次 */
const sources = [
  ...new Map(
    Object.values(SOURCES)
      .flat()
      .map((source) => [source.url, source]),
  ).values(),
];

const link = (url: string, text: string) => (
  <a href={url} target="_blank" rel="noreferrer" {...css.attrs(styles.link)}>
    {text}
  </a>
);

export const About = _component(({ onClose }: { onClose: () => void }) => () => {
  const ui = useUi().about;
  const content = useContent();
  return (
    <Dialog title={ui.title} onClose={onClose} sx={styles.root}>
      <Scroll sx={styles.body}>
        <Stack gap="lg">
          <Stack gap="sm">
            {ui.intro.map((paragraph) => (
              <p key={paragraph} {...css.attrs(styles.text)}>
                {paragraph}
              </p>
            ))}
          </Stack>

          {SECTIONS.map((section) => (
            <Stack key={section} gap="xs">
              <Note>{ui.sections[section]}</Note>
              {CREDITS[section].map((credit) => (
                <div key={credit.id} data-credit={credit.id} {...css.attrs(styles.item)}>
                  {link(credit.url, credit.name)}
                  <span {...css.attrs(styles.license)}>{credit.license}</span>
                  <span {...css.attrs(styles.purpose)}>{content.credits[credit.id]}</span>
                </div>
              ))}
            </Stack>
          ))}

          <Stack gap="xs">
            <Note>{ui.sources}</Note>
            <p {...css.attrs(styles.text)}>{ui.sourcesNote}</p>
            {sources.map((source) => (
              <div key={source.url} {...css.attrs(styles.item)}>
                {link(source.url, source.title)}
              </div>
            ))}
          </Stack>

          <Stack gap="xs">
            <Note>{ui.ownWork}</Note>
            <p {...css.attrs(styles.text)}>{ui.ownWorkText}</p>
          </Stack>
        </Stack>
      </Scroll>
    </Dialog>
  );
});
