import { describe, expect, it } from 'vitest';
import { addressFrame, readAddress, ROOM_CODE, ROOM_TOKEN, roomCode, roomToken } from './room.ts';

/** 测试用的“随机数”：每次给下一个，够均匀地把字母表走一遍 */
function sequence() {
  let n = 0;
  return () => (n++ * 0.6180339887) % 1;
}

describe('房间的约定', () => {
  it('生成的房间号、标识都合自己的规矩；房间号里没有容易看混的字', () => {
    const random = sequence();
    for (let i = 0; i < 200; i++) {
      const code = roomCode(random);
      expect(code).toMatch(ROOM_CODE);
      expect(code).not.toMatch(/[01OIL]/);
      expect(roomToken(random)).toMatch(ROOM_TOKEN);
    }
    expect(roomCode(random, 4)).toHaveLength(4);
  });

  it('中转帧：加上客人的标识再拆出来，内容原样', () => {
    const payload = new Uint8Array([0, 255, 7]);
    const frame = addressFrame('guest001', payload);
    expect(frame.byteLength).toBe(1 + 8 + 3);
    expect(readAddress(frame)).toEqual({ peer: 'guest001', payload });
    // 没有内容的帧也行
    expect(readAddress(addressFrame('abcd', new Uint8Array()))).toEqual({
      peer: 'abcd',
      payload: new Uint8Array(),
    });
  });

  it('前缀不对的帧拆不出来：空的、长度超出了帧、标识里有不该有的字', () => {
    expect(readAddress(new Uint8Array())).toBeNull();
    expect(readAddress(new Uint8Array([9, 97, 98]))).toBeNull();
    expect(readAddress(new Uint8Array([4, 65, 66, 67, 68]))).toBeNull();
    expect(readAddress(new Uint8Array([2, 97, 98]))).toBeNull();
  });
});
