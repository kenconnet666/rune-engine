/**
 * 攻方的技能：一排按钮，各写着要多少点、还要等几天。对着地区用的（外溢、激增）用在地图上选中的那个地区，
 * 不对着地区的（蛰伏、抗原转变）直接用；
 * 选的地区不合适（外溢要没到过的，激增要到过的）时按不动，提示里说为什么。
 */
import { SKILLS } from '@miwang/content';
import type { Command, OutbreakView, SkillDef } from '@miwang/sim';
import { ActionButton, Note, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { placeName, useContent, useUi } from '../i18n.ts';
import { skillIcon } from '../icons.ts';

/** 不对着某个地区用的技能（蛰伏、抗原转变） */
const global = (skill: SkillDef) => skill.kind === 'veil' || skill.kind === 'shift';

export const SkillBar = _component(
  ({
    view,
    selected,
    onCommand,
  }: {
    view: OutbreakView;
    /** 地图上选中的地区（没选是 -1） */
    selected: number;
    onCommand: (command: Command) => void;
  }) =>
    () => {
      const ui = useUi().skills;
      const content = useContent();
      /** 这个技能现在为什么对选中的地区用不了；用得了是 null */
      const blocked = (skill: SkillDef): string | null => {
        if (global(skill)) return null;
        if (selected < 0) return ui.needRegion;
        // 它到没到过：现在有感染，或者死过人
        const reached = (view.cases[selected] ?? 0) > 0 || (view.deaths[selected] ?? 0) > 0;
        if (skill.kind === 'spillover') return reached ? ui.needUnreached : null;
        return reached ? null : ui.needReached;
      };
      return (
        <Stack gap="xs">
          <Note>{ui.title}</Note>
          {view.pathogen.skills.map(({ id, cost, readyIn }) => {
            const skill = SKILLS.find((candidate) => candidate.id === id);
            if (!skill) return null;
            const { name = id, detail = '' } = content.skills[id] ?? {};
            const reason = blocked(skill);
            const targeted = !global(skill) && selected >= 0 && reason === null;
            return (
              <ActionButton
                key={id}
                data-skill={id}
                icon={skillIcon(id)}
                tip={reason ? `${detail} ${reason}` : detail}
                detail={readyIn > 0 ? ui.wait(readyIn) : ui.cost(cost)}
                disabled={readyIn > 0 || view.resource < cost || reason !== null}
                onPress={() =>
                  onCommand({
                    type: 'skill',
                    skill: id,
                    ...(!global(skill) && { region: selected }),
                  })
                }
              >
                {targeted ? ui.at(name, placeName(selected)) : name}
              </ActionButton>
            );
          })}
        </Stack>
      );
    },
);
