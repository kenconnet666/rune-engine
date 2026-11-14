/**
 * 指挥：守方不分地区的那几件事——
 *   应急队    数量有限，派到选中的地区（要走几天），或者召回；点一支队伍，地图飞到它在的地方
 *   疫苗分配  先给谁
 *   发布会    花预算换信任，开过要隔一阵
 */
import { VACCINE_POLICIES, type Command, type OutbreakView, type VaccinePolicy } from '@miwang/sim';
import {
  ActionButton,
  colors,
  focusRing,
  fonts,
  Frame,
  Icon,
  Note,
  Segmented,
  space,
  Stack,
  type IconData,
} from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import {
  Ambulance,
  Banknote,
  Flame,
  HeartPulse,
  Megaphone,
  Navigation,
  Scale,
  Siren,
  Undo2,
} from 'lucide';
import { placeName, useFormats, useUi } from '../i18n.ts';
import { RULES } from '../rules.ts';
import { DeployBar } from './DeployBar.tsx';

const styles = css.create({
  team: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    gap: space.xs,
  },
  // 队伍在哪：点了飞过去（待命的点不动）
  where: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    minWidth: 0,
    minHeight: '2.75rem',
    padding: 0,
    fontFamily: fonts.text,
    fontSize: '0.8125rem',
    textAlign: 'start',
    color: colors.textMuted,
    backgroundColor: 'transparent',
    borderWidth: 0,
    pointerEvents: 'auto',
  },
  placed: { cursor: 'pointer', color: { default: colors.text, ':hover': colors.signal } },
  arrived: { color: { default: colors.signal, ':hover': colors.signal } },
});

const POLICY_ICONS: Readonly<Record<VaccinePolicy, IconData>> = {
  even: Scale,
  hotspots: Flame,
  vulnerable: HeartPulse,
  productive: Banknote,
};

export const CommandPanel = _component(
  ({
    view,
    selected,
    onCommand,
    onLocate,
    readonly = false,
  }: {
    view: OutbreakView;
    /** 地图上选中的地区（没选是 -1）：应急队派去的就是它 */
    selected: number;
    onCommand: (command: Command) => void;
    onLocate: (region: number) => void;
    /** 只能看（回放时） */
    readonly?: boolean;
  }) =>
    () => {
      const ui = useUi().command;
      const format = useFormats();
      const { teams, priority, briefingIn, vaccinating } = view.defense;
      return (
        <Frame icon={Siren} title={ui.title}>
          {/* 有的章节没有应急队 */}
          {teams.length > 0 && (
            <>
              <Note>{ui.teams}</Note>
              <Stack gap="xs">
                {teams.map((team, index) => (
                  <div key={index} data-team={index} {...css.attrs(styles.team)}>
                    <button
                      type="button"
                      disabled={team.region < 0}
                      onClick={() => onLocate(team.region)}
                      {...css.attrs(
                        focusRing.visible,
                        styles.where,
                        team.region >= 0 && styles.placed,
                        team.region >= 0 && team.arrivesIn === 0 && styles.arrived,
                      )}
                    >
                      <Icon icon={Ambulance} size="1rem" />
                      <span>
                        {team.region < 0
                          ? ui.idle
                          : team.arrivesIn > 0
                            ? ui.travelling(placeName(team.region), team.arrivesIn)
                            : ui.stationed(placeName(team.region))}
                      </span>
                    </button>
                    {!readonly && (
                      <>
                        <ActionButton
                          compact
                          icon={Navigation}
                          aria-label={ui.send}
                          tip={selected >= 0 ? ui.send : ui.sendNone}
                          disabled={selected < 0 || team.region === selected}
                          onPress={() => onCommand({ type: 'team', team: index, region: selected })}
                        />
                        <ActionButton
                          compact
                          icon={Undo2}
                          aria-label={ui.recall}
                          tip={ui.recall}
                          disabled={team.region < 0}
                          onPress={() => onCommand({ type: 'team', team: index, region: -1 })}
                        />
                      </>
                    )}
                  </div>
                ))}
              </Stack>
              <Note>{ui.teamsHint(RULES.teamTravelDays)}</Note>
            </>
          )}

          <DeployBar view={view} selected={selected} onCommand={onCommand} readonly={readonly} />

          <Note>{ui.priority}</Note>
          <Segmented
            label={ui.priority}
            value={priority}
            options={VACCINE_POLICIES.map((policy) => ({
              value: policy,
              label: <Icon icon={POLICY_ICONS[policy]} />,
              name: ui.policies[policy].name,
            }))}
            onChange={(policy) => {
              if (!readonly) onCommand({ type: 'priority', policy: policy as VaccinePolicy });
            }}
          />
          <Note tone={vaccinating ? 'signal' : 'muted'}>
            {ui.policyLine(ui.policies[priority].name, ui.policies[priority].detail)}
          </Note>
          {!vaccinating && <Note>{ui.priorityPending}</Note>}

          {!readonly && (
            <ActionButton
              icon={Megaphone}
              tip={ui.briefingHint}
              detail={
                briefingIn > 0
                  ? ui.briefingWait(briefingIn)
                  : ui.briefingCost(
                      format.amount(RULES.briefingCost),
                      format.percent(RULES.briefingTrust),
                    )
              }
              disabled={briefingIn > 0 || view.resource < RULES.briefingCost}
              onPress={() => onCommand({ type: 'briefing' })}
            >
              {ui.briefing}
            </ActionButton>
          )}
        </Frame>
      );
    },
);
