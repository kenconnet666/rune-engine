/** 研究：进行中的、做完的；守方在这里开始新的研究，攻方只能看（研究进度是公开的） */
import { TECH_TEXT, TECHS } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { ActionButton, Frame, Meter, Note, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { LABS } from './format.ts';

const daysOf = new Map(TECHS.map((tech) => [tech.id, tech.days]));
const nameOf = (id: string) => TECH_TEXT[id]?.name ?? id;

export const ResearchPanel = _component(
  ({ view, onResearch }: { view: OutbreakView; onResearch: (tech: string) => void }) =>
    () => {
      const { active, done, offers, vaccinating } = view.defense;
      const busy = active.length >= LABS;
      return (
        <Frame title={`研究 · 完成 ${done.length} / ${TECHS.length}`}>
          {vaccinating && <Note tone="signal">疫苗已经量产，各地正在接种。</Note>}
          {active.map(({ id, remaining }) => (
            <Meter
              key={id}
              label={nameOf(id)}
              value={1 - remaining / (daysOf.get(id) ?? remaining)}
              detail={`还要 ${remaining} 天`}
              tone="calm"
            />
          ))}
          {active.length === 0 && done.length === 0 && <Note>还没有开始任何研究。</Note>}
          {done.length > 0 && <Note>已完成：{done.map(nameOf).join('、')}</Note>}
          {!view.attacker && (
            <Stack>
              {busy && offers.length > 0 && <Note>实验室都占着：等一项做完再开新的。</Note>}
              {offers.map((offer) => (
                <ActionButton
                  key={offer.id}
                  title={TECH_TEXT[offer.id]?.detail}
                  detail={`${offer.cost} · ${daysOf.get(offer.id)} 天`}
                  disabled={busy || view.resource < offer.cost}
                  onPress={() => onResearch(offer.id)}
                >
                  {nameOf(offer.id)}
                </ActionButton>
              ))}
            </Stack>
          )}
        </Frame>
      );
    },
);
