/**
 * 章节的目标：这一章叫什么、这一方要做什么、各个目标到了多少、还剩几天。普通对局不显示。
 * 攻方看到的进度是真实的；守方看到的是按上报算的（它要拦的那个数只多不少），所以另加一句说明。
 */
import type { ChapterId } from '@miwang/content';
import type { OutbreakView } from '@miwang/sim';
import { Frame, Meter, Note } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Flag } from 'lucide';
import { useContent, useFormats, useUi } from '../i18n.ts';

const styles = css.create({ root: { width: '22rem' } });

export const GoalPanel = _component(({ view }: { view: OutbreakView }) => () => {
  const { scenario } = view;
  if (!scenario) return null;
  const ui = useUi().chapters;
  const format = useFormats();
  const chapter = useContent().chapters[scenario.id as ChapterId];
  const daysLeft = Math.max(0, scenario.days - view.tick);
  return (
    <Frame
      icon={Flag}
      title={`${chapter.name} · ${chapter.theme}`}
      aside={ui.daysLeft(daysLeft)}
      data-chapter={scenario.id}
      sx={styles.root}
    >
      <Note>{view.attacker ? chapter.attacker : chapter.defender}</Note>
      {scenario.goals.map((goal) => (
        <Meter
          key={goal.metric}
          label={ui.goals[goal.metric](format.compact(goal.target))}
          value={Math.min(1, (goal.value ?? 0) / goal.target)}
          detail={goal.value === null ? ui.unknown : format.compact(goal.value)}
          // 对攻方是进度，对守方是逼近的危险
          tone={view.attacker ? 'signal' : 'danger'}
        />
      ))}
      {scenario.goals.length === 0 && <Note>{ui.standard}</Note>}
      {!view.attacker && scenario.goals.length > 0 && <Note>{ui.reportedNote}</Note>}
    </Frame>
  );
});
