/**
 * 地区榜：按一样数从高到低排出前几个地区——现在最重的、这一周涨得最多的、传播最快的、医疗最吃紧的。
 * 点一行，地图飞过去并选中它。一百多个地区里“现在该看哪里”，靠它。
 */
import type { OutbreakView } from '@miwang/sim';
import { colors, fonts, Frame, Note, Segmented, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { ListOrdered } from 'lucide';
import { placeName, useFormats, useUi } from '../i18n.ts';

/** 排出前几个 */
const SHOWN = 5;

const BOARDS = ['cases', 'growth', 'reproduction', 'strain'] as const;
type Board = (typeof BOARDS)[number];

const styles = css.create({
  root: { width: '22rem' },
  list: { display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none' },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.25rem 1fr auto',
    alignItems: 'baseline',
    gap: space.sm,
    width: '100%',
    paddingBlock: '0.3rem',
    paddingInline: 0,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    textAlign: 'start',
    color: { default: colors.text, ':hover': colors.signal },
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: '2px',
    outlineColor: colors.focus,
    pointerEvents: 'auto',
  },
  place: { fontFamily: fonts.numeric, color: colors.textMuted },
  value: { fontFamily: fonts.numeric, fontVariantNumeric: 'tabular-nums', color: colors.text },
});

export const RankPanel = _component(
  ({
    view,
    growth,
    onLocate,
  }: {
    view: OutbreakView;
    /** 各地区这一周的增量；数据还不够时是 null */
    growth: Float64Array | null;
    onLocate: (region: number) => void;
  }) => {
    let board = _state<Board>('cases');
    return () => {
      const ui = useUi().rank;
      const format = useFormats();

      /** 这一榜的数；没有数可排（不知道底细、数据还不够）时是 null */
      const values: ArrayLike<number> | null =
        board === 'cases'
          ? view.cases
          : board === 'growth'
            ? growth
            : board === 'strain'
              ? view.strain
              : view.pathogen.known
                ? view.reproduction
                : null;
      const write = (value: number) =>
        board === 'reproduction'
          ? value.toFixed(2)
          : board === 'strain'
            ? format.percent(value)
            : board === 'growth'
              ? `+${format.compact(value)}`
              : format.compact(value);

      const top = values
        ? Array.from(values, (value, region) => ({ region, value }))
            // 传播数只排已经有病例的地方：没有病例的地方数再高也还没事
            .filter(
              ({ region, value }) =>
                value > 0 && (board !== 'reproduction' || view.cases[region]! > 0),
            )
            .sort((a, b) => b.value - a.value)
            .slice(0, SHOWN)
        : [];

      return (
        <Frame icon={ListOrdered} title={ui.title} data-board={board} sx={styles.root}>
          <Segmented
            label={ui.title}
            value={board}
            options={BOARDS.map((id) => ({ value: id, label: ui.boards[id] }))}
            onChange={(value) => (board = value as Board)}
          />
          {values === null && (
            <Note>{board === 'growth' ? ui.growthPending : ui.reproductionUnknown}</Note>
          )}
          {values !== null && top.length === 0 && <Note>{ui.empty}</Note>}
          <ol {...css.attrs(styles.list)}>
            {top.map(({ region, value }, index) => (
              <li key={region}>
                <button type="button" onClick={() => onLocate(region)} {...css.attrs(styles.row)}>
                  <span {...css.attrs(styles.place)}>{index + 1}</span>
                  <span>{placeName(region)}</span>
                  <span {...css.attrs(styles.value)}>{write(value)}</span>
                </button>
              </li>
            ))}
          </ol>
        </Frame>
      );
    };
  },
);
