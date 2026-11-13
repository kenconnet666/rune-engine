/** 新闻：最近发生的事，新的在上面。点一条和地区有关的，地图飞过去 */
import { EVENT_TEXT, OUTCOME_TEXT, regionName, TECH_TEXT, TRAIT_TEXT } from '@miwang/content';
import type { NewsItem, OutbreakView } from '@miwang/sim';
import { colors, fonts, Frame, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';

/** 一次显示几条 */
const SHOWN = 7;

const styles = css.create({
  root: { width: '21rem' },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.xs,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  item: {
    display: 'flex',
    gap: space.sm,
    width: '100%',
    padding: 0,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    lineHeight: 1.45,
    textAlign: 'start',
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: 0,
    outline: 'none',
  },
  linked: { cursor: 'pointer', color: { default: colors.text, ':hover': colors.signal } },
  day: {
    flexShrink: 0,
    // 放得下“第 1234 天”，不换行
    width: '4.4rem',
    whiteSpace: 'nowrap',
    fontFamily: fonts.numeric,
    fontVariantNumeric: 'tabular-nums',
    color: colors.textMuted,
  },
});

/** 一条新闻的一句话 */
function sentence(item: NewsItem, attacker: boolean): string {
  const place = item.region >= 0 ? regionName(item.region) : '';
  switch (item.kind) {
    case 'spread':
      return `${place}出现了感染`;
    case 'report':
      return `${place}上报了第一例`;
    case 'evolve': {
      const name = TRAIT_TEXT[item.subject]?.name ?? item.subject;
      return attacker ? `获得性状：${name}` : `病原体出现新的性状：${name}`;
    }
    case 'research':
      return `研究完成：${TECH_TEXT[item.subject]?.name ?? item.subject}`;
    case 'vaccine':
      return '疫苗开始在各地接种';
    case 'traced':
      return `溯源完成：起源地是${place}`;
    case 'event': {
      const event = EVENT_TEXT[item.subject];
      return place ? `${place}：${event?.name ?? item.subject}` : (event?.name ?? item.subject);
    }
    case 'outcome':
      return OUTCOME_TEXT[item.subject] ?? item.subject;
  }
}

export const NewsPanel = _component(
  ({ view, onLocate }: { view: OutbreakView; onLocate: (region: number) => void }) =>
    () => {
      const recent = view.news.slice(-SHOWN).reverse();
      return (
        <Frame title="新闻" sx={styles.root}>
          {recent.length === 0 && <Note>还没有什么消息。</Note>}
          <ul {...css.attrs(styles.list)}>
            {recent.map((item) => (
              <li key={`${item.tick}-${item.kind}-${item.region}-${item.subject}`}>
                <button
                  type="button"
                  disabled={item.region < 0}
                  onClick={() => onLocate(item.region)}
                  {...css.attrs(styles.item, item.region >= 0 && styles.linked)}
                >
                  <span {...css.attrs(styles.day)}>第 {item.tick} 天</span>
                  <span>{sentence(item, view.attacker)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Frame>
      );
    },
);
