/**
 * 地图的图层：同一张地图上涂的是哪一样数。渲染线程和界面（图例）都用这里的定义。
 *   infection     感染程度（守方看到的是上报的）
 *   reproduction  有效传播数：一个发病者平均传给几个人。正中间是 1——亮过一半在涨，暗过一半在退
 *   suppression   措施压掉了多少传播
 *   strain        医疗被挤兑的程度
 *   immune        接种得到免疫的人口比例
 * 传播数和压制要知道病原体的底细才算得出来：守方做完病原鉴定之前这两层是空的。
 */
import type { OutbreakView } from '@miwang/sim';

export const MAP_LAYERS = ['infection', 'reproduction', 'suppression', 'strain', 'immune'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/** 传播数到这个值就涂满：2 以上都是“涨得很快”，再分没有意义 */
export const REPRODUCTION_FULL = 2;

/** 这一层现在有没有数可看 */
export const layerKnown = (view: OutbreakView, layer: MapLayer) =>
  (layer !== 'reproduction' && layer !== 'suppression') || view.pathogen.known;

/** 这一层在各地区的数值，都折到 0–1（涂在地图上用） */
export function layerValues(view: OutbreakView, layer: MapLayer): Float32Array {
  switch (layer) {
    case 'infection':
      return view.intensity;
    case 'reproduction':
      return view.reproduction.map((value) => Math.min(1, Math.max(0, value) / REPRODUCTION_FULL));
    case 'suppression':
      return view.suppression.map((value) => Math.max(0, value));
    case 'strain':
      return view.strain;
    case 'immune':
      return view.immune;
  }
}
