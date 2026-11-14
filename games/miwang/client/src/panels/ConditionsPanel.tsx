/**
 * 这一局的世界：开局时抽到的那两条条件（一条对攻方有利，一条对守方有利），各是什么意思。
 * 整局不变，所以放在左边一栏靠后的位置；没有条件的局（章节、关掉了的）不出现。
 */
import { CONDITIONS } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { colors, Frame, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Earth } from 'lucide';
import { useContent, useUi } from '../i18n.ts';

const styles = css.create({
  root: { width: '22rem' },
  list: { display: 'flex', flexDirection: 'column', gap: space.sm, margin: 0, padding: 0 },
  item: { display: 'flex', flexDirection: 'column', gap: '0.125rem', listStyle: 'none' },
  name: { fontSize: '0.875rem' },
  // 对自己有利的用平稳色，不利的用警示色
  good: { color: colors.calm },
  bad: { color: colors.danger },
  detail: { fontSize: '0.8125rem', lineHeight: 1.5, color: colors.textMuted },
});

export const ConditionsPanel = _component(({ view }: { view: OutbreakView }) => () => {
  if (view.conditions.length === 0) return null;
  const ui = useUi().conditions;
  const content = useContent();
  return (
    <Frame icon={Earth} title={ui.title} sx={styles.root}>
      <ul {...css.attrs(styles.list)}>
        {view.conditions.map((id) => {
          const mine =
            CONDITIONS.find((condition) => condition.id === id)?.favours ===
            (view.attacker ? 'attacker' : 'defender');
          return (
            <li key={id} data-condition={id} {...css.attrs(styles.item)}>
              <span {...css.attrs(styles.name, mine ? styles.good : styles.bad)}>
                {content.conditions[id]?.name ?? id}
                {' · '}
                {mine ? ui.good : ui.bad}
              </span>
              <span {...css.attrs(styles.detail)}>{content.conditions[id]?.detail}</span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
});
