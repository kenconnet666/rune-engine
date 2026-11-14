/**
 * 百科：游戏里所有东西的说明——病原体、性状、技能、地区措施、研究。
 * 每一类都是左边一面图块、右边选中那一样的详情；和对局无关，随时可以翻。
 */
import { PATHOGENS, SKILLS, TECHS, TRAITS } from '@miwang/content';
import { DEFAULT_RULES, MEASURES, type Measure } from '@miwang/sim';
import {
  colors,
  Dialog,
  Fact,
  Icon,
  Note,
  Scroll,
  space,
  Stack,
  Tabs,
  Tile,
  type IconData,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Biohazard, Dna, FlaskConical, ShieldCheck, Zap } from 'lucide';
import type { VNodeChild } from 'vue';
import { useContent, useFormats, useUi } from '../i18n.ts';
import { MEASURE_ICONS, pathogenIcon, skillIcon, techIcon, traitIcon } from '../icons.ts';
import { modifierEffects, techEffects, traitEffects, type EffectLine } from './effects.ts';
import { PathogenDetail } from './PathogenDetail.tsx';

type Section = 'pathogens' | 'traits' | 'skills' | 'measures' | 'techs';

const styles = css.create({
  tabs: { paddingInline: space.lg },
  body: { flexGrow: 1, minHeight: 0, display: 'flex' },
  list: { flexShrink: 0, width: '23rem', padding: space.lg },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: space.sm },
  detail: {
    flexGrow: 1,
    minWidth: 0,
    padding: space.lg,
    borderInlineStartWidth: '1px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
  },
  name: { display: 'flex', alignItems: 'center', gap: space.md, fontSize: '1.25rem' },
  text: { margin: 0, lineHeight: 1.65, color: colors.text },
});

/** 左边图块上的一项 */
interface Entry {
  id: string;
  icon: IconData;
  name: string;
  /** 分组的小标题（性状按传播途径、症状、能力分） */
  group?: string;
}

/** 名字、一段说明、几行“改变了什么”、几行别的事实：性状、措施、研究的详情都是这个样子 */
function describe(
  icon: IconData,
  name: string,
  text: string,
  effectsTitle: string,
  effects: readonly EffectLine[],
  facts: readonly { label: string; value: string }[],
): VNodeChild {
  return (
    <Stack gap="md">
      <div {...css.attrs(styles.name)}>
        <Icon icon={icon} size="2rem" weight={1.5} />
        <span>{name}</span>
      </div>
      <p {...css.attrs(styles.text)}>{text}</p>
      {effects.length > 0 && (
        <Stack gap="xs">
          <Note>{effectsTitle}</Note>
          {effects.map((line) => (
            <Fact key={line.name} label={line.name} value={line.amount} />
          ))}
        </Stack>
      )}
      <Stack gap="xs">
        {facts.map((fact) => (
          <Fact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </Stack>
    </Stack>
  );
}

export const Encyclopedia = _component(({ onClose }: { onClose: () => void }) => {
  let section = _state<Section>('pathogens');
  /** 各类里选中的是哪一项 */
  let chosen = _state<Record<Section, string>>({
    pathogens: PATHOGENS[0]!.id,
    traits: TRAITS[0]!.id,
    skills: SKILLS[0]!.id,
    measures: MEASURES[0],
    techs: TECHS[0]!.id,
  });

  return () => {
    const ui = useUi();
    const content = useContent();
    const format = useFormats();
    const e = ui.encyclopedia;
    const current = chosen[section];

    const entries: Record<Section, Entry[]> = {
      pathogens: PATHOGENS.map(({ id }) => ({
        id,
        icon: pathogenIcon(id),
        name: content.pathogens[id]?.name ?? id,
      })),
      traits: TRAITS.map((trait) => ({
        id: trait.id,
        icon: traitIcon(trait.id),
        name: content.traits[trait.id]?.name ?? trait.id,
        group: content.groups[trait.group],
      })),
      skills: SKILLS.map(({ id }) => ({
        id,
        icon: skillIcon(id),
        name: content.skills[id]?.name ?? id,
      })),
      measures: MEASURES.map((measure) => ({
        id: measure,
        icon: MEASURE_ICONS[measure],
        name: content.measures[measure].name,
      })),
      techs: TECHS.map((tech) => ({
        id: tech.id,
        icon: techIcon(tech.id),
        name: content.techs[tech.id]?.name ?? tech.id,
      })),
    };

    const names = (ids: readonly string[], table: Readonly<Record<string, { name: string }>>) =>
      ids.length ? ui.list(ids.map((id) => table[id]?.name ?? id)) : e.none;

    /** 轻、中、全力三档各是全力的几成 */
    const shares = (byLevel: readonly number[]) => byLevel.slice(1).map(format.percent).join(' / ');

    const detail = (): VNodeChild => {
      if (section === 'pathogens') return <PathogenDetail id={current} />;
      if (section === 'traits') {
        const trait = TRAITS.find((candidate) => candidate.id === current);
        if (!trait) return null;
        return describe(
          traitIcon(trait.id),
          content.traits[trait.id]?.name ?? trait.id,
          content.traits[trait.id]?.detail ?? '',
          ui.workbench.effects,
          traitEffects(trait.effects, content, ui),
          [
            { label: e.cost, value: ui.workbench.points(trait.cost) },
            { label: e.requires, value: names(trait.requires, content.traits) },
          ],
        );
      }
      if (section === 'skills') {
        const skill = SKILLS.find((candidate) => candidate.id === current);
        if (!skill) return null;
        const k = ui.skills;
        return describe(
          skillIcon(skill.id),
          content.skills[skill.id]?.name ?? skill.id,
          content.skills[skill.id]?.detail ?? '',
          ui.workbench.effects,
          [
            ...(skill.kind === 'spillover'
              ? [{ name: ui.effects.spread, amount: k.seeds(skill.amount ?? 0) }]
              : []),
            ...(skill.kind === 'surge'
              ? [{ name: ui.effects.spread, amount: k.boost(String(DEFAULT_RULES.surgeBoost)) }]
              : []),
            ...modifierEffects(skill.modifiers, ui),
            ...(skill.days ? [{ name: k.lasts(skill.days), amount: '' }] : []),
          ],
          [{ label: e.cost, value: k.facts(skill.cost, skill.cooldown) }],
        );
      }
      if (section === 'measures') {
        const measure = current as Measure;
        return describe(
          MEASURE_ICONS[measure],
          content.measures[measure].name,
          content.measures[measure].detail,
          ui.workbench.effects,
          [],
          [
            { label: e.cost, value: e.upkeep(format.amount(DEFAULT_RULES.upkeep[measure])) },
            {
              label: e.levels,
              value: e.levelsValue(
                shares(DEFAULT_RULES.levelEffect),
                shares(DEFAULT_RULES.levelCost),
              ),
            },
          ],
        );
      }
      const tech = TECHS.find((candidate) => candidate.id === current);
      if (!tech) return null;
      return describe(
        techIcon(tech.id),
        content.techs[tech.id]?.name ?? tech.id,
        content.techs[tech.id]?.detail ?? '',
        ui.workbench.effects,
        techEffects(tech.effects, content, ui),
        [
          { label: e.cost, value: e.research(tech.cost, tech.days) },
          { label: e.requires, value: names(tech.requires, content.techs) },
        ],
      );
    };

    // 性状按组分段排，别的类就是一整面
    const groups = new Map<string, Entry[]>();
    for (const entry of entries[section]) {
      const key = entry.group ?? '';
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }

    return (
      <Dialog title={e.title} onClose={onClose}>
        <Tabs
          label={e.title}
          sx={styles.tabs}
          value={section}
          onChange={(value) => (section = value as Section)}
          tabs={[
            { value: 'pathogens', label: e.pathogens, icon: Biohazard },
            { value: 'traits', label: e.traits, icon: Dna },
            { value: 'skills', label: e.skills, icon: Zap },
            { value: 'measures', label: e.measures, icon: ShieldCheck },
            { value: 'techs', label: e.techs, icon: FlaskConical },
          ]}
        />
        <div {...css.attrs(styles.body)}>
          <Scroll sx={styles.list}>
            <Stack gap="md">
              {[...groups].map(([group, items]) => (
                <Stack key={group}>
                  {group && <Note>{group}</Note>}
                  <div {...css.attrs(styles.grid)}>
                    {items.map((entry) => (
                      <Tile
                        key={entry.id}
                        icon={entry.icon}
                        label={entry.name}
                        state={entry.id === current ? 'owned' : 'available'}
                        aria-pressed={entry.id === current}
                        onPress={() => (chosen = { ...chosen, [section]: entry.id })}
                      />
                    ))}
                  </div>
                </Stack>
              ))}
            </Stack>
          </Scroll>
          <Scroll sx={styles.detail}>{detail()}</Scroll>
        </div>
      </Dialog>
    );
  };
});
