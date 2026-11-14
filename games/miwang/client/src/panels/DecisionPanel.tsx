/**
 * 抉择：有一件事等这一方拿主意时出现的卡片——是怎么回事、几个选项各有什么得失、还剩几天。
 * 选项的得失是从抉择表里的数直接写出来的（screens/effects.ts），表改了这里跟着变。
 * 命令到下一天才生效：点了之后先记成“已经选了”，免得看起来像没点上。
 */
import { DECISIONS } from '@miwang/content';
import type { Command, OutbreakView } from '@miwang/sim';
import { ActionButton, colors, Frame, Note, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Scale } from 'lucide';
import { useContent, useUi } from '../i18n.ts';
import { optionEffects } from '../screens/effects.ts';

const styles = css.create({
  // 要人注意的一块：边是信号色
  root: { borderColor: colors.signal },
  name: { fontSize: '1rem', color: colors.text },
  text: { margin: 0, fontSize: '0.8125rem', lineHeight: 1.6, color: colors.text },
  effects: { paddingInlineStart: space.xs },
});

export const DecisionPanel = _component(
  ({
    view,
    onCommand,
    readonly = false,
  }: {
    view: OutbreakView;
    onCommand: (command: Command) => void;
    /** 只能看（回放时）：选项点不动 */
    readonly?: boolean;
  }) => {
    /** 已经点了、还没生效的：“事.选项” */
    let chosen = _state('');

    return () => {
      const pending = view.decision;
      const decision = DECISIONS.find((candidate) => candidate.id === pending?.id);
      const all = useUi();
      const text = useContent().decisions[decision?.id ?? ''];
      if (!pending || !decision || !text) return null;
      const ui = all.decision;
      const picked = chosen.startsWith(`${decision.id}.`);
      return (
        <Frame
          icon={Scale}
          title={ui.title}
          aside={ui.daysLeft(pending.daysLeft)}
          data-decision={decision.id}
          sx={styles.root}
        >
          <span {...css.attrs(styles.name)}>{text.name}</span>
          <p {...css.attrs(styles.text)}>{text.detail}</p>
          {decision.options.map((option, index) => {
            const lines = optionEffects(option, all);
            // 要倒贴的选项，手头不够就选不了
            const price = -((view.attacker ? option.points : option.budget) ?? 0);
            return (
              <Stack key={option.id} gap="xs">
                <ActionButton
                  data-option={option.id}
                  active={chosen === `${decision.id}.${option.id}`}
                  detail={index === 0 ? ui.byDefault : undefined}
                  disabled={readonly || picked || price > view.resource}
                  onPress={() => {
                    chosen = `${decision.id}.${option.id}`;
                    onCommand({ type: 'decide', decision: decision.id, option: option.id });
                  }}
                >
                  {text.options[option.id] ?? option.id}
                </ActionButton>
                <Note sx={styles.effects}>
                  {lines.length > 0
                    ? lines.map((line) => `${line.name} ${line.amount}`).join(' · ')
                    : ui.nothing}
                </Note>
              </Stack>
            );
          })}
          <Note tone={picked ? 'signal' : 'muted'}>{picked ? ui.chosen : ui.fallback}</Note>
        </Frame>
      );
    };
  },
);
