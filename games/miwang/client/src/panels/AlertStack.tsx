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
  Coins,
  Dna,
  FlaskConical,
  Flag,
  Globe,
  HeartPulse,
  Hourglass,
  Lock,
  Microscope,
  ShieldCheck,
  Skull,
  Syringe,
  TriangleAlert,
  Users,
} from 'lucide';
import type { Alert, AlertData } from '../feedback/alerts.ts';
import { placeName, useContent, useFormats, useUi } from '../i18n.ts';

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
  identified: Microscope,
  goal: Flag,
  deadline: Hourglass,
  trait: Dna,
  research: FlaskConical,
  measure: ShieldCheck,
  measures: ShieldCheck,
  crackdown: Lock,
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
      const ui = useUi().alerts;
      const content = useContent();
      const format = useFormats();

      /** 一条提示写成两行字：标题，和（有的话）一行具体的数 */
      const describe = (data: AlertData): { title: string; detail?: string } => {
        switch (data.kind) {
          case 'firstDeath':
            return { title: ui.firstDeath };
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
          case 'identified':
            return { title: ui.identified };
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
        }
      };

      const items: ToastItem[] = alerts.map(({ id, tone, data }) => ({
        id,
        tone,
        icon: ICONS[data.kind],
        ...describe(data),
        onPress() {
          if ('region' in data) onLocate(data.region);
          onDismiss(id);
        },
      }));
      return <Toasts label={ui.title} items={items} sx={styles.root} />;
    },
);
