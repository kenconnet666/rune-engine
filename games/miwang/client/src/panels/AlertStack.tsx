/**
 * 提示条：把 feedback/alerts.ts 给的几条提示写成字、配上图标，摞在画面上方中间。
 * 带地区的那几条点一下，地图飞过去。
 */
import type { OutbreakView } from '@miwang/sim';
import { Toasts, type IconData, type ToastItem } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import {
  Activity,
  Ambulance,
  CalendarDays,
  Coins,
  Dna,
  FlaskConical,
  Flag,
  Globe,
  HeartPulse,
  Hourglass,
  Lock,
  Megaphone,
  Package,
  Scale,
  ShieldCheck,
  Siren,
  Skull,
  Sparkles,
  Syringe,
  Target,
  TriangleAlert,
  Undo2,
  Users,
  Zap,
} from 'lucide';
import type { Alert, AlertData } from '../feedback/alerts.ts';
import { newsSentence } from '../feedback/news-text.ts';
import { placeName, useContent, useFormats, useUi } from '../i18n.ts';
import { skillIcon } from '../icons.ts';

const styles = css.create({
  root: {
    position: 'absolute',
    insetBlockStart: 'max(0.75rem, env(safe-area-inset-top))',
    insetInlineStart: '50%',
    translate: '-50% 0',
    alignItems: 'center',
  },
});

const ICONS: Readonly<Record<AlertData['kind'], IconData>> = {
  firstDeath: Skull,
  regions: Globe,
  infected: Activity,
  calamity: TriangleAlert,
  strain: HeartPulse,
  strainCount: HeartPulse,
  trust: Users,
  runway: Coins,
  vaccine: Syringe,
  firstReport: Siren,
  goal: Flag,
  deadline: Hourglass,
  trait: Dna,
  synergy: Sparkles,
  deployed: Package,
  research: FlaskConical,
  measure: ShieldCheck,
  measures: ShieldCheck,
  crackdown: Lock,
  teamSent: Ambulance,
  teamArrived: Ambulance,
  briefing: Megaphone,
  priority: Syringe,
  decisionPending: Scale,
  decided: Scale,
  skill: Zap,
  devolve: Undo2,
  calendar: CalendarDays,
  taskNew: Target,
  taskResult: Target,
};

export const AlertStack = _component(
  ({
    alerts,
    view,
    onLocate,
    onDismiss,
  }: {
    alerts: readonly Alert[];
    view: OutbreakView;
    onLocate: (region: number) => void;
    onDismiss: (id: number) => void;
  }) =>
    () => {
      const all = useUi();
      const ui = all.alerts;
      const content = useContent();
      const format = useFormats();

      /** 一条提示写成两行字：标题，和（有的话）一行具体的数 */
      const describe = (data: AlertData): { title: string; detail?: string } => {
        switch (data.kind) {
          case 'firstDeath':
            return { title: ui.firstDeath };
          case 'firstReport':
            return { title: ui.firstReport(placeName(data.region)), detail: ui.firstReportDetail };
          case 'regions':
            return { title: ui.regions(data.count) };
          case 'infected':
            return {
              title: (view.attacker ? ui.infected : ui.reported)(format.compact(data.count)),
            };
          case 'calamity':
            return { title: ui.calamity(format.percent(data.share)) };
          case 'strain':
            return { title: ui.strain(placeName(data.region)), detail: ui.strainDetail };
          case 'strainCount':
            return { title: ui.strainCount(data.count), detail: ui.strainDetail };
          case 'trust':
            return { title: ui.trust(format.percent(data.level)), detail: ui.trustDetail };
          case 'runway':
            return { title: ui.runway(data.days) };
          case 'vaccine':
            return { title: ui.vaccine };
          case 'goal':
            return { title: ui.goal(format.percent(data.share)) };
          case 'deadline':
            return { title: ui.deadline(data.days) };
          case 'trait': {
            const name = content.traits[data.trait]?.name ?? data.trait;
            return {
              title: (data.own ? ui.traitOwn : ui.traitTheirs)(name),
              detail: content.traits[data.trait]?.detail,
            };
          }
          case 'research': {
            const name = content.techs[data.tech]?.name ?? data.tech;
            return {
              title: (data.own ? ui.researchOwn : ui.researchTheirs)(name),
              detail: content.techs[data.tech]?.detail,
            };
          }
          case 'measure':
            return {
              title: ui.measure(placeName(data.region)),
              detail:
                data.to < 0
                  ? ui.measureUnknown
                  : ui.measureEffect(
                      format.percent(Math.max(0, data.from)),
                      format.percent(Math.max(0, data.to)),
                    ),
            };
          case 'measures':
            return { title: ui.measures(data.count) };
          case 'crackdown':
            return { title: ui.crackdown(placeName(data.region), data.count) };
          case 'teamSent':
            return {
              title:
                data.region < 0 ? ui.teamRecalled : ui.teamSent(placeName(data.region), data.days),
            };
          case 'teamArrived':
            return {
              title: (data.own ? ui.teamArrived : ui.teamArrivedTheirs)(placeName(data.region)),
              detail: ui.teamDetail,
            };
          case 'briefing':
            return {
              title: data.own ? ui.briefingOwn : ui.briefingTheirs,
              detail: ui.briefingEffect(format.percent(data.from), format.percent(data.to)),
            };
          case 'priority':
            return { title: ui.priority(all.command.policies[data.policy].name) };
          case 'decisionPending': {
            const text = content.decisions[data.decision];
            return { title: ui.decisionPending(text?.name ?? data.decision), detail: text?.detail };
          }
          case 'decided': {
            const [id = '', option = ''] = data.subject.split('.');
            const text = content.decisions[id];
            return {
              title: (data.own ? ui.decided : ui.decidedTheirs)(
                text?.name ?? id,
                text?.options[option] ?? option,
              ),
            };
          }
          case 'skill': {
            const name = content.skills[data.skill]?.name ?? data.skill;
            return {
              title: data.region < 0 ? ui.skill(name) : ui.skillAt(name, placeName(data.region)),
              detail: content.skills[data.skill]?.detail,
            };
          }
          case 'deployed': {
            const name = content.deployments[data.deployment]?.name ?? data.deployment;
            return {
              title: (data.own ? ui.deployed : ui.deployedTheirs)(name, placeName(data.region)),
              detail: content.deployments[data.deployment]?.detail,
            };
          }
          case 'synergy':
            return {
              title: newsSentence(data.item, view.attacker),
              detail: content.synergies[data.item.subject]?.detail,
            };
          case 'calendar': {
            const [id = ''] = data.item.subject.split('.');
            return {
              title: newsSentence(data.item, view.attacker),
              detail: content.calendar[id]?.detail,
            };
          }
          case 'taskNew':
            return {
              title: ui.taskNew(content.tasks[data.task]?.name ?? data.task),
              detail: content.tasks[data.task]?.detail,
            };
          case 'taskResult':
            return {
              title: (data.done ? ui.taskDone : ui.taskFailed)(
                content.tasks[data.task]?.name ?? data.task,
              ),
            };
          case 'devolve': {
            const name = content.traits[data.trait]?.name ?? data.trait;
            return { title: (data.own ? ui.devolved : ui.devolvedTheirs)(name) };
          }
        }
      };

      const items: ToastItem[] = alerts.map(({ id, tone, data }) => ({
        id,
        tone,
        icon: data.kind === 'skill' ? skillIcon(data.skill) : ICONS[data.kind],
        ...describe(data),
        onPress() {
          if ('region' in data) onLocate(data.region);
          onDismiss(id);
        },
      }));
      return <Toasts label={ui.title} items={items} sx={styles.root} />;
    },
);
