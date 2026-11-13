/** 左上角的态势：哪一天、几个最要紧的数字、离灾厄线多远、公众信任 */
import { regions } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { colors, fonts, Frame, Meter, Readout, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Activity, Biohazard, Coins, Dna, Globe, ShieldCheck, Skull } from 'lucide';
import { useFormats, useUi } from '../i18n.ts';

const styles = css.create({
  root: { width: '22rem' },
  day: {
    display: 'flex',
    alignItems: 'baseline',
    gap: space.md,
    fontFamily: fonts.numeric,
    color: colors.text,
  },
  dayNumber: { fontSize: '1.5rem', lineHeight: 1.1 },
  date: { fontSize: '0.8125rem', color: colors.textMuted },
  // 四个读数排成两行两列，位数变了也不会把布局挤歪
  readouts: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: space.lg,
    rowGap: space.md,
    paddingBlock: space.xs,
  },
});

/** 带正负号的每日净值：+3.5、−0.4 */
const signed = (value: number, format: (value: number) => string) =>
  `${value < 0 ? '−' : '+'}${format(Math.abs(value))}`;

export const StatusPanel = _component(({ view }: { view: OutbreakView | null }) => () => {
  const ui = useUi().status;
  const format = useFormats();
  if (!view) {
    return (
      <Frame title={ui.waiting} sx={styles.root}>
        <span {...css.attrs(styles.date)}>…</span>
      </Frame>
    );
  }
  const { attacker, totals, defense } = view;
  return (
    <Frame
      icon={attacker ? Biohazard : ShieldCheck}
      title={attacker ? ui.attacker : ui.defender}
      sx={styles.root}
    >
      <div {...css.attrs(styles.day)}>
        <span {...css.attrs(styles.dayNumber)}>{ui.day(view.tick)}</span>
        <span {...css.attrs(styles.date)}>{format.longDate(view.date)}</span>
      </div>
      <div {...css.attrs(styles.readouts)}>
        <Readout
          icon={Activity}
          label={attacker ? ui.infections : ui.cases}
          value={format.compact(totals.cases)}
          tone="signal"
        />
        <Readout
          icon={Skull}
          label={ui.deaths}
          value={format.compact(totals.deaths)}
          tone="danger"
        />
        <Readout icon={Globe} label={ui.regions} value={`${totals.regions} / ${regions.length}`} />
        <Readout
          icon={attacker ? Dna : Coins}
          label={attacker ? ui.points : ui.budget}
          value={format.whole(Math.floor(view.resource))}
          note={
            attacker ? undefined : ui.perDay(signed(defense.income - defense.upkeep, format.amount))
          }
          tone="calm"
        />
      </div>
      <Meter
        label={attacker ? ui.calamityAttacker : ui.calamityDefender}
        value={view.calamity}
        detail={format.percent(view.calamity)}
        tone="danger"
      />
      <Meter
        label={ui.trust}
        value={defense.trust}
        detail={`${format.percent(defense.trust)} · ${ui.compliance(format.percent(defense.compliance))}`}
        tone="calm"
      />
    </Frame>
  );
});
