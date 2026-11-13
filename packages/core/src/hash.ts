/**
 * 状态哈希（FNV-1a，32 位）：两边各自算一遍，数字相同就说明模拟没有分叉。
 * 按数组的原始字节算，所以逐位不同的两个状态一定（几乎）得到不同的哈希。
 */

/** 哈希的起始值；几段数据串着算时把上一段的结果当下一段的起始值 */
export const HASH_SEED = 0x811c9dc5;

/** 一段字节的哈希 */
export function hashBytes(bytes: Uint8Array, seed: number = HASH_SEED): number {
  let h = seed;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 一个数值数组的哈希（按它在内存里的字节） */
export function fnv1a(values: ArrayBufferView, seed: number = HASH_SEED): number {
  return hashBytes(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), seed);
}

/** 几个数的哈希（都按 64 位浮点数的字节算） */
export function hashNumbers(values: readonly number[], seed: number = HASH_SEED): number {
  return fnv1a(Float64Array.from(values), seed);
}
