/** 选中的地区：它的情况，以及守方能在这里开关的措施 */
import { MEASURE_TEXT, regionName, regions } from '@miwang/content';
import {
  HAS_DISASTER,
  HAS_GATHERING,
  MEASURE_BITS,
  MEASURES,
  type Measure,
  type OutbreakView,
} from '@miwang/sim';
import { ActionButton, Fact, Frame, Meter, Note, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { amount, compact, measureCost, percent } from './format.ts';

const CLIMATE = ['热带', '温带', '寒带'];
const WEALTH = ['低收入', '中低收入', '中高收入', '高收入'];
const DENSITY = ['人口稀疏', '人口一般', '人口稠密'];

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
      const level = view.intensity[index] ?? 0;
      const bits = view.measures[index] ?? 0;
      const happening = view.happening[index] ?? 0;
      const active = MEASURES.filter((measure) => (bits & MEASURE_BITS[measure]) !== 0);
      return (
        <Frame title={regionName(index)} onClose={onClose} closeLabel="取消选中">
          <Meter
            label={view.attacker ? '感染程度' : '上报程度'}
            value={level}
            detail={percent.format(level)}
            tone={level > 0.5 ? 'danger' : 'signal'}
          />
          <Stack gap="xs">
            <Fact
              label={`人口（${region.populationYear} 年）`}
              value={compact.format(region.population)}
            />
            <Fact
              label={view.attacker ? '现有感染' : '现有病例（估）'}
              value={compact.format(view.cases[index] ?? 0)}
            />
            <Fact label="死亡" value={compact.format(view.deaths[index] ?? 0)} />
            {(view.immune[index] ?? 0) > 0 && (
              <Fact label="已接种" value={percent.format(view.immune[index] ?? 0)} />
            )}
            <Fact
              label="条件"
              value={`${CLIMATE[region.climate]} · ${WEALTH[region.wealth]} · ${DENSITY[region.density]}`}
            />
            <Fact
              label="路线"
              value={`陆路 ${region.neighbors.length} · 航线 ${region.air.to.length} · 海运 ${region.sea.to.length}`}
            />
          </Stack>
          {(happening & HAS_GATHERING) !== 0 && <Note tone="signal">这里正有大型集会。</Note>}
          {(happening & HAS_DISASTER) !== 0 && <Note tone="danger">这里正遭受自然灾害。</Note>}
          {view.attacker ? (
            <Note>
              {active.length > 0
                ? `守方在这里：${active.map((measure) => MEASURE_TEXT[measure].name).join('、')}`
                : '守方还没有在这里采取措施。'}
            </Note>
          ) : (
            <Stack>
              {MEASURES.map((measure) => {
                const on = (bits & MEASURE_BITS[measure]) !== 0;
                const cost = measureCost(index, measure);
                return (
                  <ActionButton
                    key={measure}
                    active={on}
                    title={MEASURE_TEXT[measure].detail}
                    detail={
                      on
                        ? `每天 ${amount.format(cost.daily)}`
                        : `${amount.format(cost.setup)} + 每天 ${amount.format(cost.daily)}`
                    }
                    disabled={!on && view.resource < cost.setup}
                    onPress={() => onMeasure(measure, !on)}
                  >
                    {MEASURE_TEXT[measure].name}
                  </ActionButton>
                );
              })}
            </Stack>
          )}
        </Frame>
      );
    },
);
