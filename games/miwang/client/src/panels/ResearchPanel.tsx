/**
 * 研究的概况：进行中的各有一条进度，做完的排成一排图标。研究进度是公开的，攻方也看得到；
 * 守方从这里打开研究的工作台。
 */
import { TECHS } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, colors, Frame, Icon, Meter, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { FlaskConical, Microscope, Syringe } from 'lucide';
import { useContent, useUi } from '../i18n.ts';
import { techIcon } from '../icons.ts';
import { LABS } from '../rules.ts';

const daysOf = new Map(TECHS.map((tech) => [tech.id, tech.days]));

const styles = css.create({
  done: { display: 'flex', flexWrap: 'wrap', gap: space.sm, color: colors.calm },
});

export const ResearchPanel = _component(
  ({
    view,
    onOpen,
    readonly = false,
  }: {
    view: OutbreakView;
    onOpen: () => void;
    /** 只能看（回放时）：不给“安排研究”的入口 */
    readonly?: boolean;
  }) =>
    () => {
      const ui = useUi().research;
      const content = useContent();
      const { active, done, offers, vaccinating } = view.defense;
      const free = LABS - active.length;
      const nameOf = (id: string) => content.techs[id]?.name ?? id;
      return (
        <Frame icon={FlaskConical} title={ui.title} aside={ui.progress(done.length, TECHS.length)}>
          {vaccinating && (
            <Note icon={Syringe} tone="signal">
              {ui.vaccinating}
            </Note>
          )}
          {active.map(({ id, remaining }) => (
            <Meter
              key={id}
              label={nameOf(id)}
              value={1 - remaining / (daysOf.get(id) ?? remaining)}
              detail={ui.remaining(remaining)}
              tone="calm"
            />
          ))}
          {active.length === 0 && done.length === 0 && <Note>{ui.none}</Note>}
          {done.length > 0 && (
            <div {...css.attrs(styles.done)}>
              {done.map((id) => (
                <span key={id} title={nameOf(id)}>
                  <Icon icon={techIcon(id)} label={nameOf(id)} />
                </span>
              ))}
            </div>
          )}
          {!view.attacker && !readonly && (
            <ActionButton
              icon={Microscope}
              // 有空着的实验室、又有能做的研究时亮起来提醒
              active={free > 0 && offers.length > 0}
              detail={free > 0 ? ui.free(free) : ui.busy}
              onPress={onOpen}
            >
              {ui.open}
            </ActionButton>
          )}
        </Frame>
      );
    },
);
