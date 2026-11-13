/** 设置：语言、配色、音量 */
import type { Locale } from '@miwang/content';
import { Dialog, Note, Scroll, Segmented, Slider, space, Stack } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { i18n, LOCALE_NAMES, useFormats, useUi } from '../i18n.ts';
import { palette } from '../palette.ts';
import type { GameAudio } from '../sound.ts';

const styles = css.create({
  // 设置的内容不多：对话框用窄一点、矮一点的
  root: {
    width: 'min(34rem, calc(100vw - 2rem))',
    height: 'fit-content',
    maxHeight: 'calc(100vh - 2rem)',
  },
  volumes: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: space.lg,
    rowGap: space.sm,
  },
  body: { flexGrow: 1, minHeight: 0, padding: space.lg },
});

/** 音量的各路，按这个顺序排 */
const CHANNELS = ['master', 'music', 'ambience', 'alert', 'ui'] as const;

export const Settings = _component(
  ({ audio, onClose }: { audio: GameAudio | null; onClose: () => void }) => {
    // 音量存在声音引擎里，不是响应式的：改了之后靠它让这里重画
    let revision = _state(0);
    return () => {
      const ui = useUi().settings;
      const format = useFormats();
      void revision;
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
                <Note>{ui.palette}</Note>
                <Segmented
                  label={ui.palette}
                  value={palette.value}
                  options={[
                    { value: 'standard', label: ui.palettes.standard },
                    { value: 'safe', label: ui.palettes.safe },
                  ]}
                  onChange={(value) => (palette.value = value === 'safe' ? 'safe' : 'standard')}
                />
                <Note>{ui.paletteHelp}</Note>
              </Stack>
              {audio && (
                <Stack gap="xs">
                  <Note>{ui.volume}</Note>
                  <div {...css.attrs(styles.volumes)}>
                    {CHANNELS.map((channel) => (
                      <Slider
                        key={channel}
                        label={ui.volumes[channel]}
                        value={audio.engine.volume(channel)}
                        format={format.percent}
                        onChange={(value) => {
                          audio.engine.setVolume(channel, value);
                          revision++;
                        }}
                      />
                    ))}
                  </div>
                </Stack>
              )}
            </Stack>
          </Scroll>
        </Dialog>
      );
    };
  },
);
