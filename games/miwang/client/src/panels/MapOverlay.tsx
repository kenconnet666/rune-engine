/**
 * 压在地图上、跟着地图走的那一层：地区的名字，和地区上正在发生的事的标记（集会、灾害、起源地）。
 * 它们是 DOM 元素，位置用和渲染线程同一套换算从相机算出来，所以拖动、缩放时和地图对得上。
 * 名字只给在屏幕上够大的地区标（放大以后小的地区才露出名字），而且最多标那么多个，免得糊成一片。
 * 整层不接收指针：点下去点到的是地图。
 */
import { bounds, regions } from '@miwang/content';
import { HAS_DISASTER, HAS_GATHERING, type OutbreakView } from '@miwang/sim';
import { mapScale, type MapBounds } from '@rune-engine/render/map-view';
import { colors, fonts, Icon } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import { CloudRainWind, Crosshair, PartyPopper } from 'lucide';
import { placeName } from '../i18n.ts';
import type { MapController } from '../map.ts';

/** 一个地区在屏幕上的“个头”（像素）到这个数才标名字 */
const LABEL_MIN_SIZE = 46;
/** 最多同时标多少个名字 */
const LABEL_LIMIT = 48;

/** 各地区的个头：面积开方（面积是单位球上的，地图坐标是弧度，量级相当） */
const sizes = regions.map((region) => Math.sqrt(region.area));
/** 从大到小排好的地区下标：标名字时大的优先 */
const bySize = regions.map((_, index) => index).sort((a, b) => sizes[b]! - sizes[a]!);

const styles = css.create({
  root: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  item: {
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.15rem',
    // 锚在自己的中心：translate 把左上角放到那个点，再往回挪半个身位
    willChange: 'transform',
  },
  label: {
    fontFamily: fonts.text,
    fontSize: '0.6875rem',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    color: colors.text,
    opacity: 0.72,
    // 压在各种颜色的地区上都看得清
    textShadow: '0 0 3px rgba(3, 6, 9, 0.95), 0 0 6px rgba(3, 6, 9, 0.8)',
  },
  marks: { display: 'flex', gap: '0.2rem' },
  mark: {
    display: 'grid',
    placeItems: 'center',
    width: '1.375rem',
    height: '1.375rem',
    borderRadius: '50%',
    backgroundColor: colors.raised,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'currentColor',
  },
  gathering: { color: colors.signal },
  disaster: { color: colors.danger },
  origin: { color: colors.calm },
});

const places = css.create({
  at: (x: number, y: number) => ({
    transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
  }),
});

export const MapOverlay = _component(
  ({ map, view, canvas }: { map: MapController; view: OutbreakView; canvas: HTMLCanvasElement }) =>
    () => {
      const camera = map.camera.value;
      const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      const scale = mapScale(bounds as unknown as MapBounds, viewport, camera.zoom);

      const items = [];
      let labels = 0;
      for (const index of bySize) {
        const marks = view.happening[index] ?? 0;
        const origin = view.origin === index;
        const named = labels < LABEL_LIMIT && sizes[index]! * scale >= LABEL_MIN_SIZE;
        if (!named && marks === 0 && !origin) continue;
        const center = regions[index]!.center;
        const [x, y] = map.toScreen(center[0]!, center[1]!);
        // 屏幕外面的不画
        if (x < -40 || y < -20 || x > viewport.width + 40 || y > viewport.height + 20) continue;
        if (named) labels++;
        items.push(
          <div key={index} {...css.attrs(styles.item, places.at(Math.round(x), Math.round(y)))}>
            {(marks !== 0 || origin) && (
              <span {...css.attrs(styles.marks)}>
                {origin && (
                  <span {...css.attrs(styles.mark, styles.origin)}>
                    <Icon icon={Crosshair} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_GATHERING) !== 0 && (
                  <span {...css.attrs(styles.mark, styles.gathering)}>
                    <Icon icon={PartyPopper} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_DISASTER) !== 0 && (
                  <span {...css.attrs(styles.mark, styles.disaster)}>
                    <Icon icon={CloudRainWind} size="0.875rem" />
                  </span>
                )}
              </span>
            )}
            {named && <span {...css.attrs(styles.label)}>{placeName(index)}</span>}
          </div>,
        );
      }
      return <div {...css.attrs(styles.root)}>{items}</div>;
    },
);
