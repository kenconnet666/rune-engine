/** 新闻：最近发生的事，新的在上面，每条前面一个图标。点一条和地区有关的，地图飞过去 */
import type { NewsItem, OutbreakView } from '@miwang/sim';
import { colors, fonts, Frame, Icon, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Newspaper } from 'lucide';
import { placeName, useContent, useUi } from '../i18n.ts';
import { newsIcon } from '../icons.ts';

/** 一次显示几条 */
const SHOWN = 8;

const styles = css.create({
  root: { width: '22rem' },
  list: {
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  item: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    paddingBlock: '0.3rem',
    paddingInline: 0,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    lineHeight: 1.4,
    textAlign: 'start',
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: 0,
    outline: 'none',
  },
  linked: { cursor: 'pointer', color: { default: colors.text, ':hover': colors.signal } },
  icon: { color: colors.textMuted },
  // 坏消息的图标用警示色，自己这一方的进展用信号色：扫一眼就知道哪几条要紧
  bad: { color: colors.danger },
  good: { color: colors.signal },
  day: {
    fontFamily: fonts.numeric,
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    color: colors.textMuted,
  },
});

export const NewsPanel = _component(
  ({ view, onLocate }: { view: OutbreakView; onLocate: (region: number) => void }) =>
    () => {
      const ui = useUi().news;
      const content = useContent();
      const { attacker } = view;

      /** 一条新闻的一句话 */
      const sentence = (item: NewsItem): string => {
        const place = item.region >= 0 ? placeName(item.region) : '';
        switch (item.kind) {
          case 'spread':
            return ui.spread(place);
          case 'report':
            return ui.report(place);
          case 'evolve': {
            const name = content.traits[item.subject]?.name ?? item.subject;
            return attacker ? ui.evolved(name) : ui.evolvedSeen(name);
          }
          case 'research':
            return ui.research(content.techs[item.subject]?.name ?? item.subject);
          case 'vaccine':
            return ui.vaccine;
          case 'traced':
            return ui.traced(place);
          case 'event': {
            const name = content.events[item.subject]?.name ?? item.subject;
            return place ? ui.eventAt(place, name) : name;
          }
          case 'outcome':
            return content.outcomes[item.subject as keyof typeof content.outcomes] ?? item.subject;
        }
      };

      /** 这条消息对这一方是好是坏：攻方乐见扩散和变异，守方乐见研究和疫苗 */
      const mood = (item: NewsItem) => {
        const forAttacker = item.kind === 'spread' || item.kind === 'evolve';
        const forDefender =
          item.kind === 'research' || item.kind === 'vaccine' || item.kind === 'traced';
        if (forAttacker) return attacker ? styles.good : styles.bad;
        if (forDefender) return attacker ? styles.bad : styles.good;
        return item.kind === 'report' && !attacker ? styles.bad : null;
      };

      const recent = view.news.slice(-SHOWN).reverse();
      return (
        <Frame icon={Newspaper} title={ui.title} sx={styles.root}>
          {recent.length === 0 && <Note>{ui.empty}</Note>}
          <ul {...css.attrs(styles.list)}>
            {recent.map((item) => (
              <li key={`${item.tick}-${item.kind}-${item.region}-${item.subject}`}>
                <button
                  type="button"
                  disabled={item.region < 0}
                  onClick={() => onLocate(item.region)}
                  {...css.attrs(styles.item, item.region >= 0 && styles.linked)}
                >
                  <Icon
                    icon={newsIcon(item.kind, item.subject)}
                    size="0.9375rem"
                    sx={[styles.icon, mood(item)]}
                  />
                  <span>{sentence(item)}</span>
                  <span {...css.attrs(styles.day)}>{ui.day(item.tick)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Frame>
      );
    },
);
