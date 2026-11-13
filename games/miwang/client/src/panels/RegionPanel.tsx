/** 选中的地区：它的情况；守方在这里开关措施（一面图块，开着的亮起来），攻方看得到守方开了哪些 */
import { regions } from '@miwang/content';
import {
  HAS_DISASTER,
  HAS_GATHERING,
  MEASURE_BITS,
  MEASURES,
  type Measure,
  type OutbreakView,
} from '@miwang/sim';
import { colors, Fact, Frame, Icon, Meter, Note, space, Stack, Tile } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { CloudRainWind, MapPin, PartyPopper } from 'lucide';
import { placeName, useContent, useFormats, useUi } from '../i18n.ts';
import { MEASURE_ICONS } from '../icons.ts';
import { measureCost } from '../rules.ts';

const styles = css.create({
  measures: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
  // 攻方看到的：守方开着的措施排成一排小图标
  seen: { display: 'flex', flexWrap: 'wrap', gap: space.sm, color: colors.signal },
  heading: { display: 'flex', justifyContent: 'space-between' },
});

export const RegionPanel = _component(
  ({
    index,
    view,
    onClose,
    onMeasure,
  }: {
    index: number;
    view: OutbreakView;
    onClose: () => void;
    onMeasure: (measure: Measure, on: boolean) => void;
  }) =>
    () => {
      const region = regions[index];
      if (!region) return null;
      const ui = useUi();
      const content = useContent();
      const format = useFormats();
      const level = view.intensity[index] ?? 0;
      const bits = view.measures[index] ?? 0;
      const happening = view.happening[index] ?? 0;
      const active = MEASURES.filter((measure) => (bits & MEASURE_BITS[measure]) !== 0);
      return (
        <Frame
          icon={MapPin}
          title={placeName(index)}
          onClose={onClose}
          closeLabel={ui.region.deselect}
        >
          <Meter
            label={view.attacker ? ui.app.infection : ui.app.reported}
            value={level}
            detail={format.percent(level)}
            tone={level > 0.5 ? 'danger' : 'signal'}
          />
          <Stack gap="xs">
            <Fact
              label={ui.region.population(region.populationYear)}
              value={format.compact(region.population)}
            />
            <Fact
              label={view.attacker ? ui.status.infections : ui.status.cases}
              value={format.compact(view.cases[index] ?? 0)}
            />
            <Fact label={ui.status.deaths} value={format.compact(view.deaths[index] ?? 0)} />
            {(view.immune[index] ?? 0) > 0 && (
              <Fact label={ui.region.immune} value={format.percent(view.immune[index] ?? 0)} />
            )}
            <Fact
              label={ui.region.conditions}
              value={`${content.climates[region.climate]} · ${content.wealth[region.wealth]} · ${content.density[region.density]}`}
            />
            <Fact
              label={ui.region.routes}
              value={ui.region.routeCounts(
                region.neighbors.length,
                region.air.to.length,
                region.sea.to.length,
              )}
            />
          </Stack>
          {(happening & HAS_GATHERING) !== 0 && (
            <Note icon={PartyPopper} tone="signal">
              {ui.region.gathering}
            </Note>
          )}
          {(happening & HAS_DISASTER) !== 0 && (
            <Note icon={CloudRainWind} tone="danger">
              {ui.region.disaster}
            </Note>
          )}

          {view.attacker ? (
            active.length === 0 ? (
              <Note>{ui.region.defenderNone}</Note>
            ) : (
              <Stack gap="xs">
                <Note>
                  {ui.region.defenderHere(
                    ui.list(active.map((measure) => content.measures[measure].name)),
                  )}
                </Note>
                <div {...css.attrs(styles.seen)}>
                  {active.map((measure) => (
                    <Icon
                      key={measure}
                      icon={MEASURE_ICONS[measure]}
                      label={content.measures[measure].name}
                    />
                  ))}
                </div>
              </Stack>
            )
          ) : (
            <Stack>
              <Note sx={styles.heading}>
                <span>{ui.region.measures}</span>
                <span>{ui.region.measuresOn(active.length)}</span>
              </Note>
              <div {...css.attrs(styles.measures)}>
                {MEASURES.map((measure) => {
                  const on = (bits & MEASURE_BITS[measure]) !== 0;
                  const cost = measureCost(index, measure);
                  const { name, detail } = content.measures[measure];
                  return (
                    <Tile
                      key={measure}
                      icon={MEASURE_ICONS[measure]}
                      label={name}
                      // 开着的显示每天花多少，没开的显示开它要预付多少
                      detail={
                        on
                          ? ui.region.daily(format.amount(cost.daily))
                          : ui.region.setup(format.amount(cost.setup))
                      }
                      state={on ? 'owned' : 'available'}
                      title={ui.region.measureHint(
                        name,
                        detail,
                        format.amount(cost.setup),
                        format.amount(cost.daily),
                      )}
                      aria-pressed={on}
                      disabled={!on && view.resource < cost.setup}
                      onPress={() => onMeasure(measure, !on)}
                    />
                  );
                })}
              </div>
            </Stack>
          )}
        </Frame>
      );
    },
);
