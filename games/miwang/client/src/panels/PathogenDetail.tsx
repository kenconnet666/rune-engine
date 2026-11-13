/**
 * 一种病原体的介绍：是什么、在这局游戏里打起来怎样、它的原型在公开资料里的几条事实和出处。
 * 开局设置和百科都用它。
 */
import { SOURCES } from '@miwang/content';
import { colors, focusRing, Icon, Note, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { ExternalLink } from 'lucide';
import { useContent, useUi } from '../i18n.ts';
import { pathogenIcon } from '../icons.ts';

const styles = css.create({
  name: { display: 'flex', alignItems: 'center', gap: space.md, fontSize: '1.25rem' },
  text: { margin: 0, lineHeight: 1.65, color: colors.text },
  facts: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    margin: 0,
    paddingInlineStart: '1.1rem',
    lineHeight: 1.6,
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.xs,
    fontSize: '0.8125rem',
    color: { default: colors.calm, ':hover': colors.text },
    textDecorationLine: 'underline',
    textUnderlineOffset: '0.2em',
  },
});

export const PathogenDetail = _component(({ id }: { id: string }) => () => {
  const ui = useUi().setup;
  const text = useContent().pathogens[id];
  if (!text) return null;
  const sources = SOURCES[id] ?? [];
  return (
    <Stack gap="md">
      <div {...css.attrs(styles.name)}>
        <Icon icon={pathogenIcon(id)} size="2rem" weight={1.5} />
        <Stack gap="xs">
          <span>{text.name}</span>
          <Note>{text.kind}</Note>
        </Stack>
      </div>
      <p {...css.attrs(styles.text)}>{text.summary}</p>
      <Stack gap="xs">
        <Note>{ui.play}</Note>
        <p {...css.attrs(styles.text)}>{text.play}</p>
      </Stack>
      <Stack gap="xs">
        <Note>{ui.facts}</Note>
        <ul {...css.attrs(styles.facts)}>
          {text.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </Stack>
      {sources.length > 0 && (
        <Stack gap="xs">
          <Note>{ui.sources}</Note>
          {sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              {...css.attrs(focusRing.visible, styles.link)}
            >
              {source.title}
              <Icon icon={ExternalLink} size="0.8125rem" />
            </a>
          ))}
          <Note>{ui.note}</Note>
        </Stack>
      )}
    </Stack>
  );
});
