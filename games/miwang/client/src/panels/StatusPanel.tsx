/** 左上角的态势：日期、几个最要紧的数字、离灾厄线多远、公众信任 */
import { regions } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { colors, Fact, fonts, Frame, Meter, Readout, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { amount, compact, longDate, percent, whole } from './format.ts';

const styles = css.create({
  root: { width: '21rem' },
  date: { fontFamily: fonts.numeric, fontSize: '0.9375rem', color: colors.text },
});

export const StatusPanel = _component(({ view }: { view: OutbreakView | null }) => () => {
  if (!view) {
    return (
      <Frame title="态势" sx={styles.root}>
        <span {...css.attrs(styles.date)}>正在等主机…</span>
      </Frame>
    );
  }
  const { attacker, totals, defense } = view;
  return (
    <Frame title={attacker ? '攻方 · 真实态势' : '守方 · 上报态势'} sx={styles.root}>
      <span {...css.attrs(styles.date)}>
        {longDate(view.date)} · 第 {view.tick} 天
      </span>
      <Stack row gap="lg" wrap>
        <Readout
          label={attacker ? '现有感染' : '现有病例（估）'}
          value={compact.format(totals.cases)}
          tone="signal"
        />
        <Readout label="死亡" value={compact.format(totals.deaths)} tone="danger" />
        <Readout label="波及地区" value={`${totals.regions} / ${regions.length}`} />
        <Readout
          label={attacker ? '变异点' : '预算'}
          value={whole.format(Math.floor(view.resource))}
          tone="calm"
        />
      </Stack>
      <Meter
        label={attacker ? '灾厄（到头就赢）' : '灾厄（到头就输，按上报的死亡算）'}
        value={view.calamity}
        detail={percent.format(view.calamity)}
        tone="danger"
      />
      <Meter
        label="公众信任"
        value={defense.trust}
        detail={`${percent.format(defense.trust)} · 措施见效 ${percent.format(defense.compliance)}`}
        tone="calm"
      />
      {!attacker && (
        <Fact
          label="每天收支"
          value={`+${amount.format(defense.income)}  −${amount.format(defense.upkeep)}`}
        />
      )}
    </Frame>
  );
});
