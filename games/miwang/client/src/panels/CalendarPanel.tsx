/**
 * 日程：正在进行的、已经预告的事（出行高峰、雨季、国际赛事）——什么时候开始、还剩几天、会改变什么。
 * 和随机的事件不同，这些是能提前准备的；赛事有主办地，点一下地图飞过去。幅度从日程表里取。
 */
import { CALENDAR } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { colors, focusRing, fonts, Frame, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { CalendarDays } from 'lucide';
import { placeName, useContent, useUi } from '../i18n.ts';
import { modifierAmount } from '../screens/effects.ts';

const styles = css.create({
  root: { width: '22rem' },
  list: { display: 'flex', flexDirection: 'column', gap: space.sm, margin: 0, padding: 0 },
  item: { display: 'flex', flexDirection: 'column', gap: '0.125rem', listStyle: 'none' },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  name: { fontSize: '0.875rem', color: colors.text },
  when: {
    fontFamily: fonts.numeric,
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    color: colors.textMuted,
    whiteSpace: 'nowrap',
  },
  // 正在进行的：时间那一栏用信号色
  active: { color: colors.signal },
  place: {
    padding: 0,
    font: 'inherit',
    color: { default: colors.signal, ':hover': colors.text },
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
  },
});

export const CalendarPanel = _component(
  ({ view, onLocate }: { view: OutbreakView; onLocate: (region: number) => void }) =>
    () => {
      if (view.calendar.length === 0) return null;
      const ui = useUi().calendar;
      const content = useContent();
      return (
        <Frame icon={CalendarDays} title={ui.title} sx={styles.root}>
          <ul {...css.attrs(styles.list)}>
            {view.calendar.map((entry) => {
              const amount = CALENDAR.find((def) => def.id === entry.id)?.amount ?? 0;
              return (
                <li key={entry.id} data-calendar={entry.id} {...css.attrs(styles.item)}>
                  <span {...css.attrs(styles.head)}>
                    <span {...css.attrs(styles.name)}>
                      {content.calendar[entry.id]?.name ?? entry.id}
                    </span>
                    <span {...css.attrs(styles.when, entry.startsIn === 0 && styles.active)}>
                      {entry.startsIn > 0
                        ? ui.startsIn(entry.startsIn)
                        : ui.daysLeft(entry.daysLeft)}
                    </span>
                  </span>
                  <Note>
                    {entry.region >= 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => onLocate(entry.region)}
                          {...css.attrs(focusRing.visible, styles.place)}
                        >
                          {ui.at(placeName(entry.region))}
                        </button>
                        {' · '}
                      </>
                    )}
                    {ui.effects[entry.kind](modifierAmount(amount))}
                  </Note>
                </li>
              );
            })}
          </ul>
        </Frame>
      );
    },
);
