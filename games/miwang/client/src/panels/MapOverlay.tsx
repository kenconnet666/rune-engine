/**
 * 压在地图上、跟着地图走的那一层：地区的名字，和地区上正在发生的事的标记（集会、灾害、攻方的激增、起源地、应急队）。
 * 它们是 DOM 元素，位置用和渲染线程同一套换算从相机算出来，所以拖动、缩放时和地图对得上。
 * 名字只给在屏幕上够大的地区标（放大以后小的地区才露出名字），而且最多标那么多个，免得糊成一片。
 * 整层不接收指针：点下去点到的是地图。
 */
import { bounds, regions } from '@miwang/content';
import {
  HAS_AID,
  HAS_DISASTER,
  HAS_GATHERING,
  HAS_LEAK,
  HAS_RELIEF,
  HAS_SURGE,
  HAS_UNREST,
  type OutbreakView,
} from '@miwang/sim';
import { mapScale, type MapBounds } from '@rune-engine/render/map-view';
import { colors, fonts, Icon } from '@rune-engine/ui';
import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { css } from '@zerodep-dev/vue-tsx-pro-tsx/styles';
import {
  Ambulance,
  CloudRainWind,
  Crosshair,
  Flame,
  Footprints,
  Megaphone,
  Package,
  PartyPopper,
  Tent,
} from 'lucide';
import type { Ping } from '../feedback/alerts.ts';
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

const ripple = css.keyframes({
  from: { scale: 0.15, opacity: 1 },
  to: { scale: 1, opacity: 0 },
});

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
  team: { color: colors.calm },
  // 还在路上的应急队：虚线圈
  coming: { borderStyle: 'dashed', opacity: 0.7 },
  // 闪一下：一个圈从小到大、由实到淡，告诉你“这里刚出了事”。
  // 外面一层只管摆位置，里面一层只管动：缩放要是和定位写在同一个元素上，会连位置一起缩
  pingAt: { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0 },
  ping: {
    display: 'block',
    width: '4.5rem',
    height: '4.5rem',
    borderRadius: '50%',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'currentColor',
    animationName: ripple,
    animationDuration: '1.2s',
    animationIterationCount: 2,
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  signal: { color: colors.signal },
  danger: { color: colors.danger },
  calm: { color: colors.calm },
});

const places = css.create({
  at: (x: number, y: number) => ({
    transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
  }),
});

export const MapOverlay = _component(
  ({
    map,
    view,
    canvas,
    pings = [],
  }: {
    map: MapController;
    view: OutbreakView;
    canvas: HTMLCanvasElement;
    /** 地图上正在闪的几处（刚出事的地区） */
    pings?: readonly Ping[];
  }) =>
    () => {
      const camera = map.camera.value;
      const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      const scale = mapScale(bounds as unknown as MapBounds, viewport, camera.zoom);

      /** 各地区的应急队：到了的是 0，还在路上的是剩下的天数 */
      const teams = new Map<number, number>();
      for (const team of view.defense.teams) {
        if (team.region < 0) continue;
        teams.set(team.region, Math.min(team.arrivesIn, teams.get(team.region) ?? Infinity));
      }

      const items = [];
      let labels = 0;
      for (const index of bySize) {
        const marks = view.happening[index] ?? 0;
        const origin = view.origin === index;
        const named = labels < LABEL_LIMIT && sizes[index]! * scale >= LABEL_MIN_SIZE;
        const team = teams.get(index);
        if (!named && marks === 0 && !origin && team === undefined) continue;
        const center = regions[index]!.center;
        const [x, y] = map.toScreen(center[0]!, center[1]!);
        // 屏幕外面的不画
        if (x < -40 || y < -20 || x > viewport.width + 40 || y > viewport.height + 20) continue;
        if (named) labels++;
        items.push(
          <div key={index} {...css.attrs(styles.item, places.at(Math.round(x), Math.round(y)))}>
            {(marks !== 0 || origin || team !== undefined) && (
              <span {...css.attrs(styles.marks)}>
                {team !== undefined && (
                  <span
                    data-mark="team"
                    {...css.attrs(styles.mark, styles.team, team > 0 && styles.coming)}
                  >
                    <Icon icon={Ambulance} size="0.875rem" />
                  </span>
                )}
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
                {(marks & HAS_SURGE) !== 0 && (
                  <span data-mark="surge" {...css.attrs(styles.mark, styles.gathering)}>
                    <Icon icon={Flame} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_DISASTER) !== 0 && (
                  <span {...css.attrs(styles.mark, styles.disaster)}>
                    <Icon icon={CloudRainWind} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_UNREST) !== 0 && (
                  <span data-mark="unrest" {...css.attrs(styles.mark, styles.disaster)}>
                    <Icon icon={Megaphone} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_RELIEF) !== 0 && (
                  <span data-mark="relief" {...css.attrs(styles.mark, styles.gathering)}>
                    <Icon icon={Tent} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_AID) !== 0 && (
                  <span data-mark="aid" {...css.attrs(styles.mark, styles.gathering)}>
                    <Icon icon={Package} size="0.875rem" />
                  </span>
                )}
                {(marks & HAS_LEAK) !== 0 && (
                  <span data-mark="leak" {...css.attrs(styles.mark, styles.gathering)}>
                    <Icon icon={Footprints} size="0.875rem" />
                  </span>
                )}
              </span>
            )}
            {named && <span {...css.attrs(styles.label)}>{placeName(index)}</span>}
          </div>,
        );
      }
      const rings = pings.flatMap((ping) => {
        const center = regions[ping.region]?.center;
        if (!center) return [];
        const [x, y] = map.toScreen(center[0]!, center[1]!);
        return [
          <span
            key={`ping-${ping.id}`}
            {...css.attrs(styles.pingAt, places.at(Math.round(x), Math.round(y)))}
          >
            <span {...css.attrs(styles.ping, styles[ping.tone])} />
          </span>,
        ];
      });
      return (
        <div {...css.attrs(styles.root)}>
          {rings}
          {items}
        </div>
      );
    },
);
