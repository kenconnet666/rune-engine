/**
 * 量文字有多宽。排版要知道一段字占多宽，量法得和画的那头一样：两边都交给浏览器的文字引擎
 * （这里用一块 2D 画布的 measureText，渲染线程里把字画进图集用的也是它），字距、中文、字体回退都对得上。
 *
 * 整段量，不能一个字一个字量了相加：英文有字距调整（AV、To 这样的组合会靠拢），相加出来四段里有一段差半个像素以上。
 */
import { viewFontString, type ViewFont } from '@rune-engine/render/view-types';

export interface TextMeasurer {
  /** 这段字用这个字体画出来有多宽（CSS 像素） */
  width(font: ViewFont, text: string): number;
}

/** 每种字体记多少段的宽度：超过了就整个清掉重记（界面上的字来来回回就那些，清一次无妨） */
const CACHE_LIMIT = 50_000;

/** 用一块 2D 画布量（主线程、Worker 里都行）。同一个字体、同一段字只量一次 */
export function createCanvasMeasurer(): TextMeasurer {
  const pen = new OffscreenCanvas(1, 1).getContext('2d');
  if (!pen) throw new Error('量文字的画布拿不到 2D 上下文');
  const byFont = new Map<ViewFont, Map<string, number>>();
  let current: ViewFont | undefined;
  return {
    width(font, text) {
      let cache = byFont.get(font);
      if (!cache) byFont.set(font, (cache = new Map()));
      let width = cache.get(text);
      if (width !== undefined) return width;
      if (current !== font) {
        pen.font = viewFontString(font);
        current = font;
      }
      width = pen.measureText(text).width;
      if (cache.size >= CACHE_LIMIT) cache.clear();
      cache.set(text, width);
      return width;
    },
  };
}
