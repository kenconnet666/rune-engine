/**
 * 选中的地区：它的情况；守方在这里安排措施，攻方看得到守方开了哪些、开到第几档。
 * 守方那一半：先是“派应急队来这里”，然后分两页——
 *   措施        一面图块，先选力度（轻、中、全力），点一项就开到那一档，再点一下关掉；图块上的小点是现在的档位
 *   预案与推广  预案一下把几项措施设到位（监测、缓解、围堵、全撤，和自己存的一套）；
 *               推广把这里的做法原样用到相邻的、有病例的、或者其余全部地区
 */
import { regions } from '@miwang/content';
import {
  HAS_AID,
  HAS_DISASTER,
  HAS_GATHERING,
  HAS_LEAK,
  HAS_RELIEF,
  HAS_SURGE,
  HAS_UNREST,
  MAX_LEVEL,
  measureLevel,
  MEASURES,
  type Command,
  type MeasureLevel,
  type OutbreakView,
} from '@miwang/sim';
import {
  ActionButton,
  colors,
  Fact,
  Frame,
  Icon,
  Meter,
  Note,
  Segmented,
  space,
  Stack,
  Tabs,
  Tile,
  type IconData,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import {
  Ambulance,
  Bookmark,
  BookmarkPlus,
  CircleOff,
  CloudRainWind,
  Footprints,
  Megaphone,
  Package,
  Tent,
  Copy,
  Eye,
  Flame,
  Lock,
  MapPin,
  PartyPopper,
  ShieldHalf,
  Undo2,
} from 'lucide';
import { placeName, useContent, useFormats, useUi } from '../i18n.ts';
import { MEASURE_ICONS } from '../icons.ts';
import { customPreset, PRESET_IDS, PRESETS, type PresetId } from '../presets.ts';
import { measureCost, planChanges, planOf, RULES, type MeasurePlan } from '../rules.ts';

const styles = css.create({
  measures: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
  // 攻方看到的：守方开着的措施排成一排小图标
  seen: { display: 'flex', flexWrap: 'wrap', gap: space.sm, color: colors.signal },
  brush: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  presets: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: space.sm },
});

const BRUSHES: readonly MeasureLevel[] = [1, 2, 3];

/** 带正负号的数：+3.5、−0.40 */
const signedAmount = (value: number, format: (value: number) => string) =>
  `${value < 0 ? '−' : '+'}${format(Math.abs(value))}`;

const PRESET_ICONS: Readonly<Record<PresetId | 'custom', IconData>> = {
  watch: Eye,
  mitigate: ShieldHalf,
  contain: Lock,
  clear: CircleOff,
  custom: Bookmark,
};

export const RegionPanel = _component(
  ({
    index,
    view,
    onClose,
    onCommand,
    readonly = false,
  }: {
    index: number;
    view: OutbreakView;
    onClose: () => void;
    onCommand: (command: Command) => void;
    /** 只能看（回放时）：措施的图块点不动 */
    readonly?: boolean;
  }) => {
    /** 点一项措施时开到第几档 */
    let brush = _state<MeasureLevel>(MAX_LEVEL);
    /** 守方那一半现在看哪一页 */
    let page = _state<'measures' | 'plans'>('measures');

    /** 把一份方案用到这个地区 */
    const applyHere = (plan: MeasurePlan) => {
      for (const { measure, level } of planChanges(plan, [index], view.measures).changes) {
        onCommand({ type: 'measure', region: index, measure, level });
      }
    };
    /** 把这里的做法用到别的地区：病例重的排在前面，钱不够时先顾它们 */
    const copyTo = (targets: readonly number[]) => {
      const ordered = targets.toSorted((a, b) => (view.cases[b] ?? 0) - (view.cases[a] ?? 0));
      const plan = planOf(view.measures[index] ?? 0);
      for (const change of planChanges(plan, ordered, view.measures).changes) {
        onCommand({ type: 'measures', ...change });
      }
    };

    return () => {
      const region = regions[index];
      if (!region) return null;
      const ui = useUi();
      const content = useContent();
      const format = useFormats();
      const level = view.intensity[index] ?? 0;
      const bits = view.measures[index] ?? 0;
      const happening = view.happening[index] ?? 0;
      /** 这里的传播数；这一方算不出来（守方还没做病原鉴定）时是负数 */
      const reproduction = view.reproduction[index] ?? -1;
      const active = MEASURES.filter((measure) => measureLevel(bits, measure) > 0);
      const { teams } = view.defense;
      const team = teams.find((it) => it.region === index);
      const idle = teams.filter((it) => it.region < 0).length;

      /** 一套预案的按钮 */
      const preset = (id: PresetId | 'custom', plan: MeasurePlan) => {
        const { setup, daily, changes } = planChanges(plan, [index], view.measures);
        return (
          <Tile
            key={id}
            data-preset={id}
            icon={PRESET_ICONS[id]}
            label={ui.region.presetNames[id]}
            tip={`${ui.region.presetHints[id]} ${ui.region.planCost(
              format.amount(setup),
              signedAmount(daily, format.amount),
            )}`}
            // 这里已经是这套预案的样子：亮着
            state={changes.length === 0 ? 'owned' : 'available'}
            detail={
              changes.length === 0
                ? ui.region.presetSame
                : // 只是往下撤的不花钱：不写价钱
                  setup > 0 && ui.region.presetCost(format.amount(setup))
            }
            disabled={readonly || changes.length === 0 || view.resource < setup}
            onPress={() => applyHere(plan)}
          />
        );
      };

      /** “用到别处”的一个按钮：去掉自己之后还有哪些地区、要预付多少 */
      const copy = (id: keyof typeof ui.region.copyTargets, targets: readonly number[]) => {
        const others = targets.filter((target) => target !== index);
        // 岛上的地区没有相邻的
        if (others.length === 0) return null;
        const { setup, daily, changes } = planChanges(planOf(bits), others, view.measures);
        return (
          <ActionButton
            key={id}
            data-copy={id}
            icon={Copy}
            tip={ui.region.copyHint}
            // 一次改很多地区，每天的维持费才是大头：和预付的一起写出来
            detail={
              changes.length === 0
                ? ui.region.presetSame
                : ui.region.planCost(format.amount(setup), signedAmount(daily, format.amount))
            }
            disabled={readonly || changes.length === 0}
            onPress={() => copyTo(others)}
          >
            {ui.region.copyTargets[id](others.length)}
          </ActionButton>
        );
      };

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
            {reproduction >= 0 && (
              <Fact
                label={ui.region.reproduction}
                value={ui.region.reproductionValue(
                  reproduction.toFixed(2),
                  reproduction >= 1,
                  format.percent(Math.max(0, view.suppression[index] ?? 0)),
                )}
              />
            )}
            {(view.strain[index] ?? 0) > 0.02 && (
              <Fact label={ui.region.strain} value={format.percent(view.strain[index] ?? 0)} />
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
          {(happening & HAS_SURGE) !== 0 && (
            <Note icon={Flame} tone="signal">
              {ui.region.surge}
            </Note>
          )}
          {(happening & HAS_DISASTER) !== 0 && (
            <Note icon={CloudRainWind} tone="danger">
              {ui.region.disaster}
            </Note>
          )}
          {(happening & HAS_UNREST) !== 0 && (
            <Note icon={Megaphone} tone={view.attacker ? 'signal' : 'danger'}>
              {ui.region.unrest}
            </Note>
          )}
          {(happening & HAS_RELIEF) !== 0 && (
            <Note icon={Tent} tone={view.attacker ? 'danger' : 'signal'}>
              {ui.region.relief}
            </Note>
          )}
          {(happening & HAS_AID) !== 0 && (
            <Note icon={Package} tone={view.attacker ? 'danger' : 'signal'}>
              {ui.region.aid}
            </Note>
          )}
          {(happening & HAS_LEAK) !== 0 && (
            <Note icon={Footprints} tone="signal">
              {ui.region.leak}
            </Note>
          )}
          {team && (
            <Note icon={Ambulance} tone="signal">
              {team.arrivesIn > 0 ? ui.region.teamComing(team.arrivesIn) : ui.region.teamHere}
            </Note>
          )}

          {view.attacker ? (
            active.length === 0 ? (
              <Note>{ui.region.defenderNone}</Note>
            ) : (
              <Stack gap="xs">
                <Note>
                  {ui.region.defenderHere(
                    ui.list(
                      active.map((measure) =>
                        ui.region.leveled(
                          content.measures[measure].name,
                          ui.region.levels[measureLevel(bits, measure)]!,
                        ),
                      ),
                    ),
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
              {/* 有的章节没有应急队：那就没有这个按钮 */}
              {!readonly &&
                teams.length > 0 &&
                (team ? (
                  <ActionButton
                    icon={Undo2}
                    onPress={() =>
                      onCommand({ type: 'team', team: teams.indexOf(team), region: -1 })
                    }
                  >
                    {ui.region.teamRecall}
                  </ActionButton>
                ) : (
                  <ActionButton
                    icon={Ambulance}
                    detail={idle > 0 ? ui.region.teamIdle(idle) : ui.region.teamNone}
                    tip={
                      idle > 0 ? ui.command.teamsHint(RULES.teamTravelDays) : ui.region.teamNoneHint
                    }
                    disabled={idle === 0}
                    onPress={() =>
                      onCommand({
                        type: 'team',
                        team: teams.findIndex((it) => it.region < 0),
                        region: index,
                      })
                    }
                  >
                    {ui.region.teamSend}
                  </ActionButton>
                ))}
              <Tabs
                label={ui.region.measures}
                value={page}
                tabs={[
                  {
                    value: 'measures',
                    label: ui.region.measures,
                    badge: active.length || undefined,
                  },
                  { value: 'plans', label: ui.region.plans },
                ]}
                onChange={(value) => (page = value as typeof page)}
              />
              {page === 'measures' ? (
                <>
                  <div {...css.attrs(styles.brush)}>
                    <Note>{ui.region.brush}</Note>
                    <Segmented
                      label={ui.region.brush}
                      value={brush}
                      options={BRUSHES.map((value) => ({ value, label: ui.region.levels[value] }))}
                      onChange={(value) => (brush = value as MeasureLevel)}
                    />
                  </div>
                  <Note>
                    {ui.region.brushHint(
                      format.percent(RULES.levelEffect[brush] ?? 0),
                      format.percent(RULES.levelCost[brush] ?? 0),
                    )}
                  </Note>
                  <div {...css.attrs(styles.measures)}>
                    {MEASURES.map((measure) => {
                      const current = measureLevel(bits, measure);
                      // 已经在这一档：再点是关掉；否则设到这一档
                      const target = current === brush ? 0 : brush;
                      const cost = measureCost(index, measure, target, current);
                      const { name, detail } = content.measures[measure];
                      return (
                        <Tile
                          key={measure}
                          icon={MEASURE_ICONS[measure]}
                          label={name}
                          level={current}
                          levels={MAX_LEVEL}
                          data-measure={measure}
                          data-level={current}
                          // 开着的显示每天花多少，没开的显示开到这一档要预付多少
                          detail={
                            current > 0
                              ? ui.region.daily(
                                  format.amount(measureCost(index, measure, current).daily),
                                )
                              : ui.region.setup(format.amount(cost.setup))
                          }
                          state={current > 0 ? 'owned' : 'available'}
                          tip={ui.region.measureHint(
                            ui.region.leveled(name, ui.region.levels[brush]!),
                            detail,
                            format.amount(cost.setup),
                            format.amount(measureCost(index, measure, brush).daily),
                          )}
                          aria-pressed={current > 0}
                          disabled={readonly || view.resource < cost.setup}
                          onPress={() =>
                            onCommand({ type: 'measure', region: index, measure, level: target })
                          }
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <Note>{ui.region.presets}</Note>
                  <div {...css.attrs(styles.presets)}>
                    {PRESET_IDS.map((id) => preset(id, PRESETS[id]))}
                    {customPreset.value && preset('custom', customPreset.value)}
                  </div>
                  {!readonly && (
                    <ActionButton
                      icon={BookmarkPlus}
                      detail={
                        customPreset.value &&
                        planChanges(customPreset.value, [index], view.measures).changes.length ===
                          0 &&
                        ui.region.savedCustom
                      }
                      onPress={() => (customPreset.value = planOf(bits))}
                    >
                      {ui.region.saveCustom}
                    </ActionButton>
                  )}

                  <Note>{ui.region.copy}</Note>
                  {copy('neighbors', region.neighbors)}
                  {copy(
                    'reported',
                    regions.flatMap((_, other) => ((view.cases[other] ?? 0) > 0 ? [other] : [])),
                  )}
                  {copy(
                    'all',
                    regions.map((_, other) => other),
                  )}
                </>
              )}
            </Stack>
          )}
        </Frame>
      );
    };
  },
);
