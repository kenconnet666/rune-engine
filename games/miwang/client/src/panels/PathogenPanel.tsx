/**
 * 病原体：攻方在这里换性状（按传播途径、症状、能力分组，只列现在能换的）；
 * 守方做完病原鉴定之后，在这里看对手已经有了什么。
 */
import { GROUP_TEXT, TRAIT_TEXT, TRAITS } from '@miwang/content';
import type { OutbreakView, TraitGroup } from '@miwang/sim';
import { ActionButton, Fact, Frame, Note, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { percent } from './format.ts';

const GROUPS: readonly TraitGroup[] = ['route', 'symptom', 'ability'];
const groupOf = new Map(TRAITS.map((trait) => [trait.id, trait.group]));
const nameOf = (id: string) => TRAIT_TEXT[id]?.name ?? id;

export const PathogenPanel = _component(
  ({ view, onEvolve }: { view: OutbreakView; onEvolve: (trait: string) => void }) =>
    () => {
      const { known, owned, stats, offers } = view.pathogen;
      if (!known) {
        return (
          <Frame title="病原体">
            <Note>还不知道对手的底细：做完“病原鉴定”才看得到它的传播途径和每一次变异。</Note>
          </Frame>
        );
      }
      return (
        <Frame title={`病原体 · ${owned.length} 个性状`}>
          {stats && (
            <Stack gap="xs">
              <Fact label="严重度" value={stats.severity.toFixed(1)} />
              <Fact label="致死性" value={percent.format(stats.lethality)} />
              <Fact label="隐匿" value={stats.stealth.toFixed(1)} />
            </Stack>
          )}
          {owned.length > 0 && <Note>已有：{owned.map(nameOf).join('、')}</Note>}
          {view.attacker &&
            GROUPS.map((group) => {
              const available = offers.filter((offer) => groupOf.get(offer.id) === group);
              if (available.length === 0) return null;
              return (
                <Stack key={group}>
                  <Note>{GROUP_TEXT[group]}</Note>
                  {available.map((offer) => (
                    <ActionButton
                      key={offer.id}
                      title={TRAIT_TEXT[offer.id]?.detail}
                      detail={`${offer.cost} 点`}
                      disabled={view.resource < offer.cost}
                      onPress={() => onEvolve(offer.id)}
                    >
                      {nameOf(offer.id)}
                    </ActionButton>
                  ))}
                </Stack>
              );
            })}
        </Frame>
      );
    },
);
