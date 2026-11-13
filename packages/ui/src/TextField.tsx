/**
 * 单行的文字输入：上面一行名字，下面是输入框。按回车算“填好了”（onEnter）。
 * 没声明的属性落到外层的 label 上；输入框自己的属性（maxlength、inputmode、autocapitalize…）经 input 给。
 *
 *   <TextField label="房间号" value={code} onChange={(next) => (code = next)} onEnter={join} />
 */
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { mergeAttrs, type PartProps } from './props.ts';
import { focusRing } from './styles.ts';
import { colors, durations, fonts, space } from './tokens.ts';

export interface TextFieldProps extends PartProps<'label', 'onChange'> {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  /** 在输入框里按了回车 */
  onEnter?: () => void;
  placeholder?: string;
  /** 落到 input 元素上的属性 */
  input?: PartProps<'input'>;
}

const styles = css.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.xs, pointerEvents: 'auto' },
  label: { fontSize: '0.8125rem', color: colors.text },
  input: {
    // 触屏上也好点：不低于 44px
    minHeight: '2.75rem',
    paddingInline: space.md,
    fontFamily: fonts.text,
    // 不小于 16px：再小的话手机上点进去页面会自己放大
    fontSize: '1rem',
    color: colors.text,
    backgroundColor: colors.inset,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: colors.line, ':hover': colors.lineStrong, ':focus': colors.signal },
    transitionProperty: 'border-color',
    transitionDuration: durations.fast,
    // 页面整体关了选字，输入框里要能选
    userSelect: 'text',
    '::placeholder': { color: colors.textMuted },
  },
});

export const TextField = _component(
  ({ label, value, onChange, onEnter, placeholder, input, ...rest }: TextFieldProps) =>
    () => (
      <label {...mergeAttrs<'label'>({ sx: styles.root }, rest)}>
        <span {...css.attrs(styles.label)}>{label}</span>
        <input
          {...mergeAttrs<'input'>(
            {
              type: 'text',
              value,
              placeholder,
              // 名字、房间号这类东西不该被拼写检查和自动更正动手脚
              spellcheck: false,
              autocomplete: 'off',
              sx: [focusRing.visible, styles.input],
              onInput: (event: Event) => onChange?.((event.target as HTMLInputElement).value),
              onKeydown: (event: KeyboardEvent) => {
                if (event.key === 'Enter') onEnter?.();
              },
            },
            input ?? {},
          )}
        />
      </label>
    ),
);
