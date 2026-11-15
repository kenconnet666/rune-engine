/**
 * 文字：量有多宽、折成几行。排版要知道一段字占多大，量法得和画的那头一样：两边都交给浏览器的文字引擎
 * （这里用一块 2D 画布的 measureText，渲染线程里把字画进图集用的也是它），字距、中文、字体回退都对得上。
 *
 * 整段量，不能一个字一个字量了相加：英文有字距调整（AV、To 这样的组合会靠拢），相加出来四段里有一段差半个像素以上。
 * 折行时为了知道“这一行还放不放得下下一个词”，按词量了相加（差的那一点不影响在哪折）；折好的每一行再整行量一遍。
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

/** 排好的一行字 */
export interface TextLine {
  /** 这一行画出来的字（末行被截短时带着省略号） */
  readonly text: string;
  /** 它是原文里的哪一段 [start, end)；截短加了省略号的行，end 是原文里留下来的最后一个字之后 */
  readonly start: number;
  readonly end: number;
  readonly width: number;
  /** 登记的文字段（见 display.ts；null 是还没登记，runEpoch 是哪一回登记的） */
  run: { readonly id: number; usedAt: number } | null;
  runEpoch: number;
  /** 光标能停的位置（见 caretStops）：算过一次记着 */
  stops: CaretStops | null;
}

export interface CaretStops {
  /** 每个能停的位置在这一行的字里是第几个字符（从 0 到这一行的长度），和它离行首多远（像素） */
  readonly offsets: readonly number[];
  readonly positions: readonly number[];
}

export interface BreakOptions {
  /** 最多多宽；没给就不折行（只在换行符处断） */
  maxWidth?: number;
  /** normal：放不下就折；nowrap：一行到底（换行符也不断）；pre：只在换行符处断 */
  whiteSpace?: 'normal' | 'nowrap' | 'pre';
  /** 最多几行；多出来的不要 */
  maxLines?: number;
  /** 被截掉了的话，最后一行末尾放省略号 */
  ellipsis?: boolean;
}

const ELLIPSIS = '…';
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const isSpace = (text: string) => text.trim() === '';

const line = (text: string, start: number, end: number, width: number): TextLine => ({
  text,
  start,
  end,
  width,
  run: null,
  runEpoch: -1,
  stops: null,
});

/** 把一段字排成行 */
export function breakLines(
  measurer: TextMeasurer,
  font: ViewFont,
  content: string,
  { maxWidth, whiteSpace = 'normal', maxLines, ellipsis = false }: BreakOptions = {},
): TextLine[] {
  // 最常见的情况（表格的格子、按钮上的字）：没有换行符、整段放得下——不用分词，直接一行
  if (!content.includes('\n')) {
    const width = measurer.width(font, content);
    if (maxWidth === undefined || width <= maxWidth)
      return [line(content, 0, content.length, width)];
  }
  const lines: TextLine[] = [];
  /** 原文的 [start, end) 是一行（两头的空白不画，也不算宽度） */
  const push = (start: number, end: number) => {
    while (end > start && isSpace(content[end - 1]!) && whiteSpace === 'normal') end--;
    const text = content.slice(start, end);
    lines.push(line(text, start, end, measurer.width(font, text)));
  };

  if (whiteSpace === 'nowrap') push(0, content.length);
  else {
    let paragraphStart = 0;
    for (const paragraph of content.split('\n')) {
      if (whiteSpace === 'pre' || maxWidth === undefined) {
        push(paragraphStart, paragraphStart + paragraph.length);
      } else wrap(paragraph, paragraphStart);
      paragraphStart += paragraph.length + 1;
    }
  }

  /** 一个自然段按 maxWidth 折成几行 */
  function wrap(paragraph: string, base: number) {
    const limit = maxWidth!;
    let start = 0;
    let width = 0;
    let filled = false;
    for (const { segment, index } of words.segment(paragraph)) {
      const space = isSpace(segment);
      const size = measurer.width(font, segment);
      if (filled && !space && width + size > limit) {
        push(base + start, base + index);
        start = index;
        width = 0;
        filled = false;
      }
      // 行首的空白不要（上一行就是在这里折的）
      if (space && !filled && start > 0) {
        start = index + segment.length;
        continue;
      }
      if (!space && size > limit) {
        // 一个词比一行还宽（长网址、一长串字母）：只能在词里面断
        let pieceStart = index;
        let pieceWidth = width;
        for (const { segment: glyph, index: at } of graphemes.segment(segment)) {
          const glyphWidth = measurer.width(font, glyph);
          if (pieceWidth + glyphWidth > limit && index + at > pieceStart) {
            push(base + start, base + index + at);
            start = index + at;
            pieceStart = start;
            pieceWidth = 0;
          }
          pieceWidth += glyphWidth;
        }
        width = pieceWidth;
        filled = true;
        continue;
      }
      width += size;
      filled ||= !space;
    }
    push(base + start, base + paragraph.length);
  }

  const cut = maxLines !== undefined && lines.length > maxLines;
  if (cut) lines.length = maxLines;
  // 截掉了行、或者不折行的那一行放不下：最后一行截短，末尾放省略号
  const last = lines.at(-1);
  if (ellipsis && last && maxWidth !== undefined && (cut || last.width > maxWidth)) {
    let end = last.end;
    let text = content.slice(last.start, end) + ELLIPSIS;
    const stops = [...graphemes.segment(content.slice(last.start, end))].map((each) => each.index);
    while (stops.length > 0 && measurer.width(font, text) > maxWidth) {
      end = last.start + stops.pop()!;
      text = content.slice(last.start, end).trimEnd() + ELLIPSIS;
    }
    lines[lines.length - 1] = line(text, last.start, end, measurer.width(font, text));
  }
  return lines;
}

/**
 * 这一行里光标能停在哪些位置、各离行首多远。按“字”（一个表情、一个带声调的字母算一个）停，
 * 位置是把行首到那里的一段整段量出来的，和画出来的对得上。选中文字、之后的输入框都靠它
 */
export function caretStops(measurer: TextMeasurer, font: ViewFont, textLine: TextLine): CaretStops {
  if (textLine.stops) return textLine.stops;
  const offsets = [0];
  const positions = [0];
  for (const { segment, index } of graphemes.segment(textLine.text)) {
    const end = index + segment.length;
    offsets.push(end);
    positions.push(measurer.width(font, textLine.text.slice(0, end)));
  }
  return (textLine.stops = { offsets, positions });
}
