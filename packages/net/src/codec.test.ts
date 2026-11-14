import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from './codec.ts';

describe('消息的编码', () => {
  it('普通的值、嵌套的对象、各种数值数组，编了再解回来一模一样', () => {
    const message = {
      type: 'view',
      tick: 42,
      view: {
        intensity: new Float32Array([0, 0.25, 1]),
        measures: new Uint32Array([0, 8, 1048575]),
        cases: new Float64Array([1e12, 0.5]),
        flags: new Uint8Array([1, 2, 3, 4, 5]),
        news: [{ kind: 'spread', region: 3 }],
        outcome: null,
        name: '中文也行',
      },
    };
    const decoded = decodeMessage(encodeMessage(message)) as typeof message;
    expect(decoded).toEqual(message);
    expect(decoded.view.intensity).toBeInstanceOf(Float32Array);
    expect(decoded.view.measures).toBeInstanceOf(Uint32Array);
  });

  it('数组是原样的字节，不是数字列表：一千个数只占四千多字节', () => {
    const bytes = encodeMessage({ values: new Float32Array(1000) });
    expect(bytes.byteLength).toBeLessThan(4200);
  });

  it('数组是别的数组的一段时，只带上那一段', () => {
    const whole = new Float64Array([1, 2, 3, 4, 5, 6]);
    const part = whole.subarray(2, 4);
    expect(decodeMessage(encodeMessage({ part }))).toEqual({ part: new Float64Array([3, 4]) });
  });

  it('坏的字节解不出来就抛错，不会读到范围外面去', () => {
    expect(() => decodeMessage(new Uint8Array([1, 2]))).toThrow();
    // 声称 JSON 有很长
    expect(() => decodeMessage(new Uint8Array([255, 255, 255, 0, 1, 2, 3, 4]))).toThrow();
    // 数组的范围超出了消息
    const forged = encodeMessage({ values: new Float32Array(4) });
    const text = new TextDecoder()
      .decode(forged)
      .replace('"Float32Array",0,4', '"Float32Array",0,9');
    expect(() => decodeMessage(new TextEncoder().encode(text))).toThrow();
    // 没有这种数组
    const odd = new TextDecoder().decode(forged).replace('Float32Array', 'Float99Array');
    expect(() => decodeMessage(new TextEncoder().encode(odd))).toThrow();
  });
});

declare class TextEncoder {
  encode(text: string): Uint8Array;
}
declare class TextDecoder {
  decode(bytes: Uint8Array): string;
}
