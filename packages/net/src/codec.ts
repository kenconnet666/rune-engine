/**
 * 把一条消息编成一段字节、再解回来：消息要走网络（WebRTC 数据通道、WebSocket）时用。
 * 线程之间传消息用不着它——那里有结构化克隆。
 *
 * 消息里的数值数组（各地区的感染程度之类）不转成 JSON 的数字列表，而是原样的字节接在后面：
 *   [4 字节：JSON 部分的长度][JSON 的 UTF-8][各个数组的字节，每个对齐到 8 字节]
 * JSON 里数组的位置上放一个占位 { $array: [类型, 从哪个字节开始, 多少个元素] }。
 * Decimal、bigint、日历日期照 core 的过线格式走（toWire / fromWire）。
 *
 * 收到的字节是网络上来的，不能信：长度、偏移、类型对不上都抛错，由调用方决定丢掉这条消息。
 */
import { fromWire, toWire } from '@rune-engine/core';

// 这个包不引用宿主环境的类型；这两个类浏览器、Worker、Node 里都有
declare class TextEncoder {
  encode(text: string): Uint8Array;
}
declare class TextDecoder {
  decode(bytes: Uint8Array): string;
}

const ARRAY_TYPES = {
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
} as const;
type ArrayTypeName = keyof typeof ARRAY_TYPES;
type NumericArray = InstanceType<(typeof ARRAY_TYPES)[ArrayTypeName]>;

const HEADER_BYTES = 4;
const align = (offset: number) => (offset + 7) & ~7;

const isNumericArray = (value: unknown): value is NumericArray =>
  ArrayBuffer.isView(value) && value.constructor.name in ARRAY_TYPES;

export function encodeMessage(message: unknown): Uint8Array {
  const arrays: { offset: number; array: NumericArray }[] = [];
  let size = 0;
  /** 把数组换成占位，记下它的字节排在哪里 */
  const strip = (value: unknown): unknown => {
    if (isNumericArray(value)) {
      const offset = align(size);
      size = offset + value.byteLength;
      arrays.push({ offset, array: value });
      return { $array: [value.constructor.name, offset, value.length] };
    }
    if (typeof value !== 'object' || value === null) return value;
    if (Array.isArray(value)) return value.map(strip);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = strip(item);
    return out;
  };

  const json = new TextEncoder().encode(JSON.stringify(strip(toWire(message))));
  const blobs = align(HEADER_BYTES + json.byteLength);
  const bytes = new Uint8Array(blobs + size);
  new DataView(bytes.buffer).setUint32(0, json.byteLength, true);
  bytes.set(json, HEADER_BYTES);
  for (const { offset, array } of arrays) {
    bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), blobs + offset);
  }
  return bytes;
}

export function decodeMessage(data: ArrayBuffer | Uint8Array): unknown {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength < HEADER_BYTES) throw new Error('消息太短');
  const jsonLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    0,
    true,
  );
  if (HEADER_BYTES + jsonLength > bytes.byteLength) throw new Error('消息的长度对不上');
  const blobs = align(HEADER_BYTES + jsonLength);

  /** 把占位换回数组（拷一份出来：对齐和所有权都不依赖收到的那段字节） */
  const restore = (value: unknown): unknown => {
    if (typeof value !== 'object' || value === null) return value;
    if (Array.isArray(value)) return value.map(restore);
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.$array)) {
      const [name, offset, length] = record.$array as [unknown, unknown, unknown];
      const type = typeof name === 'string' ? ARRAY_TYPES[name as ArrayTypeName] : undefined;
      if (!type || !Number.isInteger(offset) || !Number.isInteger(length)) {
        throw new Error('消息里的数组写得不对');
      }
      const start = blobs + (offset as number);
      const end = start + (length as number) * type.BYTES_PER_ELEMENT;
      if ((offset as number) < 0 || (length as number) < 0 || end > bytes.byteLength) {
        throw new Error('消息里的数组超出了范围');
      }
      return new type(bytes.slice(start, end).buffer);
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) out[key] = restore(item);
    return out;
  };

  const text = new TextDecoder().decode(bytes.subarray(HEADER_BYTES, HEADER_BYTES + jsonLength));
  return fromWire(restore(JSON.parse(text)));
}
