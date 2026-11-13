/** 教学提示：章节里眼下该讲的那一句话，点“知道了”收起来（什么时候讲哪一句见 chapters/hints.ts） */
import { ActionButton, colors, Frame } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Check, Lightbulb } from 'lucide';
import type { HintId } from '../chapters/hints.ts';
import { useUi } from '../i18n.ts';

const styles = css.create({
  root: { width: '22rem', borderColor: colors.signal },
  text: { margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: colors.text },
});

export const HintPanel = _component(
  ({ hint, onDismiss }: { hint: HintId; onDismiss: () => void }) =>
    () => {
      const ui = useUi().hints;
      return (
        // 新的一句出现时读屏念出来
        <Frame icon={Lightbulb} title={ui.title} role="status" data-hint={hint} sx={styles.root}>
          <p {...css.attrs(styles.text)}>{ui.items[hint]}</p>
          <ActionButton icon={Check} onPress={onDismiss}>
            {ui.dismiss}
          </ActionButton>
        </Frame>
      );
    },
);
