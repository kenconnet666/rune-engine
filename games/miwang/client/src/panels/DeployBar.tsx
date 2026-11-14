/**
 * 守方的部署：一排按钮（野战医院、援助物资），各写着要多少预算、还要等几天。
 * 放在地图上选中的那个地区；选的地区不合适（要上报过的；援助物资只给低于中等收入的）时按不动，提示里说为什么。
 * 和攻方的技能条是一对。
 */
import { DEPLOYMENTS, regions } from '@miwang/content';
import type { Command, DeploymentDef, OutbreakView } from '@miwang/sim';
import { ActionButton, Note, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { placeName, useContent, useFormats, useUi } from '../i18n.ts';
import { deploymentIcon } from '../icons.ts';

export const DeployBar = _component(
  ({
    view,
    selected,
    onCommand,
    readonly = false,
  }: {
    view: OutbreakView;
    /** 地图上选中的地区（没选是 -1） */
    selected: number;
    onCommand: (command: Command) => void;
    readonly?: boolean;
  }) =>
    () => {
      if (view.defense.deployments.length === 0) return null;
      const all = useUi();
      const ui = all.deploy;
      const content = useContent();
      const format = useFormats();
      /** 这样东西现在为什么放不到选中的地区；放得了是 null */
      const blocked = (def: DeploymentDef): string | null => {
        if (selected < 0) return ui.needRegion;
        // 守方只看得到上报的：有病例或者死亡，就是上报过的地区
        const reported = (view.cases[selected] ?? 0) > 0 || (view.deaths[selected] ?? 0) > 0;
        if (!reported) return ui.needReported;
        if (def.kind === 'aid' && (regions[selected]?.wealth ?? 0) >= 2) return ui.needPoor;
        return null;
      };
      return (
        <Stack gap="xs">
          <Note>{ui.title}</Note>
          {view.defense.deployments.map(({ id, cost, readyIn }) => {
            const def = DEPLOYMENTS.find((candidate) => candidate.id === id);
            if (!def) return null;
            const { name = id, detail = '' } = content.deployments[id] ?? {};
            const reason = blocked(def);
            return (
              <ActionButton
                key={id}
                data-deploy={id}
                icon={deploymentIcon(id)}
                tip={reason ? `${detail} ${reason}` : detail}
                detail={readyIn > 0 ? all.skills.wait(readyIn) : format.amount(cost)}
                disabled={readonly || readyIn > 0 || view.resource < cost || reason !== null}
                onPress={() => onCommand({ type: 'deploy', deployment: id, region: selected })}
              >
                {reason === null ? all.skills.at(name, placeName(selected)) : name}
              </ActionButton>
            );
          })}
        </Stack>
      );
    },
);
