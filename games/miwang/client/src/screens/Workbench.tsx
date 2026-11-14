/**
 * 工作台：攻方的进化、守方的研究，都是一棵树加右边一栏详情。
 * 点树上的图块是看它（右边出现它是什么、改变什么、要多少），要不要它按右边的按钮。
 *
 * 命令发给主机要一小会儿才看得到结果（加入别人房间时还要过网络）：按下之后先在这里记成“已下令”，免得连点两次。
 */
import { PATHOGENS, SYNERGIES, TECHS, TRAITS } from '@miwang/content';
import type { OutbreakView, SynergyDef, TraitGroup } from '@miwang/sim';
import {
  ActionButton,
  colors,
  Dialog,
  Fact,
  fonts,
  Icon,
  Note,
  Scroll,
  space,
  Stack,
  Tabs,
  TechTree,
  type IconData,
  type TreeNode,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Check, Coins, Dna, Lock, Sparkles } from 'lucide';
import { useContent, useFormats, useUi } from '../i18n.ts';
import { GROUP_ICONS, techIcon, traitIcon } from '../icons.ts';
import { LABS } from '../rules.ts';
import { techEffects, traitEffects, type EffectLine } from './effects.ts';

const GROUPS: readonly TraitGroup[] = ['route', 'symptom', 'ability'];

const styles = css.create({
  body: { flexGrow: 1, minHeight: 0, display: 'flex' },
  tree: { flexGrow: 1, minWidth: 0, padding: space.lg },
  detail: {
    flexShrink: 0,
    width: '20rem',
    display: 'flex',
    flexDirection: 'column',
    gap: space.md,
    padding: space.lg,
    borderInlineStartWidth: '1px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
  },
  name: { display: 'flex', alignItems: 'center', gap: space.md, fontSize: '1.125rem' },
  text: { margin: 0, lineHeight: 1.6, color: colors.text },
  resource: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    fontFamily: fonts.numeric,
    fontSize: '1.125rem',
    color: colors.calm,
  },
  tabs: { paddingInline: space.lg },
  // 一组协同：名字一行（凑齐了的用信号色），下面是要哪几个、给什么
  synergy: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  synergyName: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: '0.875rem' },
  synergyOn: { color: colors.signal },
  synergyOff: { color: colors.textMuted },
});

/** 几组协同：各要哪几个性状（有了的打勾）、凑齐了给什么 */
const SynergyList = _component(
  ({
    synergies,
    owned,
    routeScale,
  }: {
    synergies: readonly SynergyDef[];
    owned: ReadonlySet<string>;
    /** 这一局的病原体对传播强度的折算 */
    routeScale: number;
  }) =>
    () => {
      const ui = useUi();
      const content = useContent();
      const w = ui.workbench;
      return (
        <Stack gap="sm">
          <Note>{w.synergies}</Note>
          {synergies.map((synergy) => {
            const missing = synergy.requires.filter((id) => !owned.has(id));
            const active = missing.length === 0;
            const nameOf = (id: string) => content.traits[id]?.name ?? id;
            return (
              <div key={synergy.id} data-synergy={synergy.id} {...css.attrs(styles.synergy)}>
                <span
                  {...css.attrs(styles.synergyName, active ? styles.synergyOn : styles.synergyOff)}
                >
                  <Icon icon={Sparkles} size="0.875rem" />
                  {content.synergies[synergy.id]?.name ?? synergy.id}
                  {' · '}
                  {traitEffects(synergy.effects, content, ui, routeScale)
                    .map((line) => `${line.name} ${line.amount}`)
                    .join('、')}
                </span>
                <Note tone={active ? 'signal' : 'muted'}>
                  {active
                    ? w.synergyActive(ui.list(synergy.requires.map(nameOf)))
                    : missing.length === synergy.requires.length
                      ? w.synergyAll(ui.list(missing.map(nameOf)))
                      : w.synergyNeeds(
                          ui.list(missing.map(nameOf)),
                          synergy.requires.length - missing.length,
                          synergy.requires.length,
                        )}
                </Note>
              </div>
            );
          })}
        </Stack>
      );
    },
);

/** 右边一栏要显示的东西：两种模式各自算好，画法是同一套 */
interface Detail {
  icon: IconData;
  name: string;
  text: string;
  status: { text: string; tone: 'muted' | 'signal' | 'danger' };
  effects: EffectLine[];
  cost: string;
  /** 能不能按、按钮上写什么；不该有按钮（已经有了、还锁着）时是 null */
  action: { label: string; disabled: boolean; press: () => void } | null;
  /** 和它有关的协同（攻方的性状才有） */
  synergies: readonly SynergyDef[];
}

export const Workbench = _component(
  ({
    view,
    onEvolve,
    onDevolve,
    onResearch,
    onClose,
  }: {
    view: OutbreakView;
    onEvolve: (trait: string) => void;
    onDevolve: (trait: string) => void;
    onResearch: (tech: string) => void;
    onClose: () => void;
  }) => {
    let group = _state<TraitGroup>('route');
    let current = _state<string | null>(null);
    /**
     * 已经下了令、还没在状态里看到结果的：id → 下令时“有没有它”。状态里的有无和下令时一样，就是还没生效
     * （换了再退、退了再换都要能接着点，所以不能只记“点过”）
     */
    let ordered = _state<Readonly<Record<string, boolean>>>({});

    return () => {
      const ui = useUi();
      const content = useContent();
      const format = useFormats();
      const { attacker } = view;
      const w = ui.workbench;

      let nodes: TreeNode[];
      let detail: Detail | null = null;
      const ownedTraits: ReadonlySet<string> = new Set(view.pathogen.owned);
      // 病程长的病原体，性状给的传播强度是折算过的：这里写的是这一局里实际加多少
      const routeScale =
        PATHOGENS.find((profile) => profile.id === view.pathogen.id)?.routeScale ?? 1;

      if (attacker) {
        const owned = new Set(view.pathogen.owned);
        const offers = new Map(view.pathogen.offers.map((offer) => [offer.id, offer.cost]));
        const refunds = new Map(view.pathogen.removable.map((offer) => [offer.id, offer.cost]));
        const inGroup = TRAITS.filter((trait) => trait.group === group);
        nodes = inGroup.map((trait) => {
          const cost = offers.get(trait.id);
          const state = owned.has(trait.id) ? 'owned' : cost !== undefined ? 'available' : 'locked';
          return {
            id: trait.id,
            requires: trait.requires,
            icon: traitIcon(trait.id),
            label: content.traits[trait.id]?.name ?? trait.id,
            detail:
              state === 'owned' ? (
                <Icon icon={Check} size="0.875rem" />
              ) : state === 'locked' ? (
                <Icon icon={Lock} size="0.875rem" />
              ) : (
                w.points(cost ?? 0)
              ),
            state,
          };
        });
        const trait = TRAITS.find((candidate) => candidate.id === current);
        if (trait) {
          const cost = offers.get(trait.id);
          const has = owned.has(trait.id);
          const pending = ordered[trait.id] === has;
          const refund = refunds.get(trait.id);
          detail = {
            icon: traitIcon(trait.id),
            name: content.traits[trait.id]?.name ?? trait.id,
            text: content.traits[trait.id]?.detail ?? '',
            status: has
              ? { text: refund === undefined ? w.devolveBlocked : w.devolveHint, tone: 'muted' }
              : cost === undefined
                ? {
                    text: w.requiresAny(
                      ui.list(trait.requires.map((id) => content.traits[id]?.name ?? id)),
                    ),
                    tone: 'muted',
                  }
                : { text: '', tone: 'muted' },
            effects: traitEffects(trait.effects, content, ui, routeScale),
            synergies: SYNERGIES.filter((synergy) => synergy.requires.includes(trait.id)),
            cost: cost === undefined ? '' : w.points(cost),
            action: has
              ? refund === undefined
                ? null
                : {
                    label: w.devolve(refund),
                    disabled: pending,
                    press: () => {
                      ordered = { ...ordered, [trait.id]: has };
                      onDevolve(trait.id);
                    },
                  }
              : cost === undefined
                ? null
                : {
                    label: view.resource < cost ? w.cannotAfford : w.evolve,
                    disabled: pending || view.resource < cost,
                    press: () => {
                      ordered = { ...ordered, [trait.id]: has };
                      onEvolve(trait.id);
                    },
                  },
          };
        }
      } else {
        const done = new Set(view.defense.done);
        const active = new Map(view.defense.active.map((item) => [item.id, item.remaining]));
        const offers = new Set(view.defense.offers.map((offer) => offer.id));
        const busy = active.size >= LABS;
        nodes = TECHS.map((tech) => {
          const state = done.has(tech.id)
            ? 'owned'
            : active.has(tech.id) || offers.has(tech.id)
              ? 'available'
              : 'locked';
          return {
            id: tech.id,
            requires: tech.requires,
            icon: techIcon(tech.id),
            label: content.techs[tech.id]?.name ?? tech.id,
            detail:
              state === 'owned' ? (
                <Icon icon={Check} size="0.875rem" />
              ) : active.has(tech.id) ? (
                w.days(active.get(tech.id) ?? 0)
              ) : state === 'locked' ? (
                <Icon icon={Lock} size="0.875rem" />
              ) : (
                tech.cost
              ),
            state,
          };
        });
        const tech = TECHS.find((candidate) => candidate.id === current);
        if (tech) {
          const running = active.get(tech.id);
          const pending = tech.id in ordered;
          const open = offers.has(tech.id);
          detail = {
            icon: techIcon(tech.id),
            name: content.techs[tech.id]?.name ?? tech.id,
            text: content.techs[tech.id]?.detail ?? '',
            status: done.has(tech.id)
              ? { text: w.done, tone: 'signal' }
              : running !== undefined
                ? { text: w.inProgress(running), tone: 'signal' }
                : !open
                  ? {
                      text: w.requiresAll(
                        ui.list(tech.requires.map((id) => content.techs[id]?.name ?? id)),
                      ),
                      tone: 'muted',
                    }
                  : busy
                    ? { text: w.labsBusy, tone: 'danger' }
                    : { text: '', tone: 'muted' },
            effects: techEffects(tech.effects, content, ui),
            synergies: [],
            cost: w.budget(tech.cost, tech.days),
            action:
              open && running === undefined
                ? {
                    label: view.resource < tech.cost ? w.cannotAfford : w.research,
                    disabled: pending || busy || view.resource < tech.cost,
                    press: () => {
                      ordered = { ...ordered, [tech.id]: false };
                      onResearch(tech.id);
                    },
                  }
                : null,
          };
        }
      }

      return (
        <Dialog
          title={attacker ? w.evolveTitle : w.researchTitle}
          aside={
            <span {...css.attrs(styles.resource)}>
              <Icon icon={attacker ? Dna : Coins} />
              {format.whole(Math.floor(view.resource))}
            </span>
          }
          onClose={onClose}
        >
          {attacker && (
            <Tabs
              label={ui.pathogen.title}
              sx={styles.tabs}
              value={group}
              onChange={(value) => {
                group = value as TraitGroup;
                current = null;
              }}
              tabs={GROUPS.map((value) => ({
                value,
                label: content.groups[value],
                icon: GROUP_ICONS[value],
                badge: view.pathogen.offers.filter(
                  (offer) =>
                    offer.cost <= view.resource &&
                    TRAITS.find((trait) => trait.id === offer.id)?.group === value,
                ).length,
              }))}
            />
          )}
          <div {...css.attrs(styles.body)}>
            <Scroll axis="both" sx={styles.tree}>
              <TechTree nodes={nodes} selected={current} onSelect={(id) => (current = id)} />
            </Scroll>
            <Scroll sx={styles.detail}>
              {detail ? (
                <>
                  <div {...css.attrs(styles.name)}>
                    <Icon icon={detail.icon} size="2rem" weight={1.5} />
                    <span>{detail.name}</span>
                  </div>
                  <p {...css.attrs(styles.text)}>{detail.text}</p>
                  {detail.effects.length > 0 && (
                    <Stack gap="xs">
                      <Note>{w.effects}</Note>
                      {detail.effects.map((line) => (
                        <Fact key={line.name} label={line.name} value={line.amount} />
                      ))}
                    </Stack>
                  )}
                  {detail.cost && <Fact label={w.cost} value={detail.cost} />}
                  {detail.status.text && (
                    <Note tone={detail.status.tone}>{detail.status.text}</Note>
                  )}
                  {detail.action && (
                    <ActionButton disabled={detail.action.disabled} onPress={detail.action.press}>
                      {detail.action.label}
                    </ActionButton>
                  )}
                  {detail.synergies.length > 0 && (
                    <SynergyList
                      synergies={detail.synergies}
                      owned={ownedTraits}
                      routeScale={routeScale}
                    />
                  )}
                </>
              ) : (
                <>
                  <Note>{w.pick}</Note>
                  {/* 没点哪个图块的时候：把所有的协同列出来，好知道往哪边凑 */}
                  {attacker && (
                    <>
                      <Note>{w.synergyHint}</Note>
                      <SynergyList
                        synergies={SYNERGIES}
                        owned={ownedTraits}
                        routeScale={routeScale}
                      />
                    </>
                  )}
                </>
              )}
            </Scroll>
          </div>
        </Dialog>
      );
    };
  },
);
