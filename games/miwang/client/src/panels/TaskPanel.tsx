/**
 * 短期任务：这一方手里那件小目标——要做什么、现在到了多少、还剩几天、做到了给什么。
 * 要做到多少、奖励多少都从任务表和模拟给的进度里取，文案里不写死数字。
 */
import { TASKS } from '@miwang/content';
import type { OutbreakView, TaskDef } from '@miwang/sim';
import { Frame, Meter, Note } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Target } from 'lucide';
import { useContent, useFormats, useUi } from '../i18n.ts';
import { optionEffects } from '../screens/effects.ts';

const styles = css.create({ root: { width: '22rem' } });

/** 进度条画多满：往上攒的是“到了几成”，不能超的是“用掉了几成”，要压下去的是“离线还差多少” */
function fill(task: TaskDef, have: number, need: number): number {
  if (task.mode === 'hold') return have;
  if (task.mode === 'shrink') return have > 0 ? Math.min(1, need / have) : 1;
  return need > 0 ? Math.min(1, have / need) : 0;
}

export const TaskPanel = _component(({ view }: { view: OutbreakView }) => () => {
  const current = view.task;
  const task = TASKS.find((candidate) => candidate.id === current?.id);
  if (!current || !task) return null;
  const all = useUi();
  const ui = all.tasks;
  const format = useFormats();
  const text = useContent().tasks[task.id];
  const number = task.metric === 'trust' ? format.percent : format.compact;
  const reward = optionEffects({ id: task.id, ...task.reward }, all);
  /** 不能超、不能掉的任务：条越满越危险 */
  const guarding = task.mode === 'cap';
  return (
    <Frame
      icon={Target}
      title={ui.title}
      aside={ui.daysLeft(current.daysLeft)}
      data-task={task.id}
      sx={styles.root}
    >
      <Meter
        label={text?.name ?? task.id}
        value={fill(task, current.have, current.need)}
        detail={ui.progress[task.mode](number(Math.max(0, current.have)), number(current.need))}
        tone={guarding ? 'danger' : 'signal'}
      />
      <Note>{text?.detail}</Note>
      <Note tone="signal">
        {ui.reward(reward.map((line) => `${line.name} ${line.amount}`).join(' · '))}
      </Note>
    </Frame>
  );
});
