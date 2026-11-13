/**
 * 病原体的概况：严重度、致死性、隐匿三条读数，已有的性状排成一排图标。
 * 攻方从这里打开进化的工作台；守方做完病原鉴定之后才看得到这些。
 */
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, colors, Frame, Icon, Meter, Note, space } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Biohazard, Dna } from 'lucide';
import { useContent, useUi } from '../i18n.ts';
import { pathogenIcon, traitIcon } from '../icons.ts';

/** 三条读数各自“满格”是多少：严重度到 10、致死性到 30%、隐匿到 5 就算顶了 */
const FULL = { severity: 10, lethality: 0.3, stealth: 5 };

const styles = css.create({
  owned: { display: 'flex', flexWrap: 'wrap', gap: space.sm, color: colors.signal },
});

export const PathogenPanel = _component(
  ({ view, onOpen }: { view: OutbreakView; onOpen: () => void }) =>
    () => {
      const ui = useUi().pathogen;
      const content = useContent();
      const { known, id, owned, stats, offers } = view.pathogen;
      if (!known || !stats) {
        return (
          <Frame icon={Biohazard} title={ui.title}>
            <Note>{ui.unknown}</Note>
          </Frame>
        );
      }
      const affordable = offers.filter((offer) => offer.cost <= view.resource).length;
      return (
        <Frame
          icon={id ? pathogenIcon(id) : Biohazard}
          title={(id && content.pathogens[id]?.name) || ui.title}
          aside={ui.traits(owned.length)}
        >
          <Meter
            label={content.effects.severity}
            value={stats.severity / FULL.severity}
            detail={stats.severity.toFixed(1)}
            tone="signal"
          />
          <Meter
            label={content.effects.lethality}
            value={stats.lethality / FULL.lethality}
            detail={`${(stats.lethality * 100).toFixed(1)}%`}
            tone="danger"
          />
          <Meter
            label={content.effects.stealth}
            value={stats.stealth / FULL.stealth}
            detail={stats.stealth.toFixed(1)}
            tone="calm"
          />
          {owned.length === 0 ? (
            <Note>{ui.none}</Note>
          ) : (
            <div {...css.attrs(styles.owned)}>
              {owned.map((id) => (
                <span key={id} title={content.traits[id]?.name}>
                  <Icon icon={traitIcon(id)} label={content.traits[id]?.name ?? id} />
                </span>
              ))}
            </div>
          )}
          {view.attacker && (
            <ActionButton
              icon={Dna}
              active={affordable > 0}
              detail={ui.affordable(affordable)}
              onPress={onOpen}
            >
              {ui.evolve}
            </ActionButton>
          )}
        </Frame>
      );
    },
);
