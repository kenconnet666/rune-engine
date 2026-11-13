/** 设置：语言；下面是数据与素材的来源和致谢 */
import type { Locale } from '@miwang/content';
import { colors, Dialog, Note, Scroll, Segmented, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { i18n, LOCALE_NAMES, useUi } from '../i18n.ts';

const styles = css.create({
  // 设置的内容不多：对话框用窄一点、矮一点的
  root: { width: 'min(34rem, calc(100vw - 2rem))', height: 'min(30rem, calc(100vh - 2rem))' },
  body: { flexGrow: 1, minHeight: 0, padding: space.lg },
  credits: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    margin: 0,
    paddingInlineStart: '1.1rem',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
    color: colors.text,
  },
});

export const Settings = _component(({ onClose }: { onClose: () => void }) => () => {
  const ui = useUi().settings;
  return (
    <Dialog title={ui.title} onClose={onClose} sx={styles.root}>
      <Scroll sx={styles.body}>
        <Stack gap="lg">
          <Stack gap="xs">
            <Note>{ui.language}</Note>
            <Segmented
              label={ui.language}
              value={i18n.locale.value}
              options={i18n.locales.map((locale) => ({
                value: locale,
                label: LOCALE_NAMES[locale],
              }))}
              onChange={(value) => (i18n.locale.value = value as Locale)}
            />
          </Stack>
          <Stack gap="xs">
            <Note>{ui.credits}</Note>
            <ul {...css.attrs(styles.credits)}>
              {ui.creditLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Note>{ui.license}</Note>
          </Stack>
        </Stack>
      </Scroll>
    </Dialog>
  );
});
