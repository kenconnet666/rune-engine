/**
 * 图层：地图上涂的是哪一样数（感染、传播数、措施压掉的传播、医疗挤兑、接种），和这一层的颜色是什么意思。
 * 传播数那一层的正中间是 1：亮过一半在涨，暗过一半在退。
 */
import type { OutbreakView } from '@miwang/sim';
import { MAP_PALETTES } from '@rune-engine/render';
import { colors, Icon, Note, Ramp, Segmented, space, type IconData } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { Activity, HeartPulse, ShieldCheck, Syringe, TrendingUp } from 'lucide';
import { useUi } from '../i18n.ts';
import { layerKnown, MAP_LAYERS, type MapLayer } from '../layers.ts';
import type { MapController } from '../map.ts';
import { palette } from '../palette.ts';

const styles = css.create({
  root: {
    display: 'flex',
    alignItems: 'end',
    gap: space.md,
    paddingBlock: space.xs,
    paddingInline: space.sm,
    backgroundColor: colors.panel,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.line,
    pointerEvents: 'auto',
  },
  legend: { display: 'flex', flexDirection: 'column', gap: '0.15rem', width: '13rem' },
});

const ICONS: Readonly<Record<MapLayer, IconData>> = {
  infection: Activity,
  reproduction: TrendingUp,
  suppression: ShieldCheck,
  strain: HeartPulse,
  immune: Syringe,
};

const cssColor = ([r, g, b]: readonly number[]) =>
  `rgb(${Math.round(r! * 255)} ${Math.round(g! * 255)} ${Math.round(b! * 255)})`;

export const LayerBar = _component(
  ({ map, view }: { map: MapController; view: OutbreakView }) =>
    () => {
      const ui = useUi().layers;
      const layer = map.layer.value;
      const ramp = MAP_PALETTES[palette.value];
      const text = ui.items[layer];
      return (
        <div data-layer={layer} {...css.attrs(styles.root)}>
          <Segmented
            label={ui.title}
            value={layer}
            options={MAP_LAYERS.map((id) => ({
              value: id,
              label: <Icon icon={ICONS[id]} />,
              name: ui.items[id].name,
            }))}
            onChange={(value) => map.setLayer(value as MapLayer)}
          />
          <div {...css.attrs(styles.legend)}>
            <Note>{view.attacker || layer !== 'infection' ? text.name : ui.reportedInfection}</Note>
            {layerKnown(view, layer) ? (
              <Ramp
                stops={[ramp.land, ramp.warm, ramp.hot].map(cssColor)}
                low={text.low}
                middle={text.middle}
                high={text.high}
              />
            ) : (
              <Note tone="signal">{ui.unknown}</Note>
            )}
          </div>
        </div>
      );
    },
);
