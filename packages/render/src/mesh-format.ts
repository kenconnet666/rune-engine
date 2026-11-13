/**
 * 地区网格的二进制格式：构建时（assets-build）写出，运行时直接读成 GPU 能用的数组，不解析文本。
 *
 *   头部（5 个 u32）：标记、版本、顶点数、三角形索引数、边界线索引数
 *   边界（4 个 f32）：minX、minY、maxX、maxY
 *   顶点（每个 3 个 f32）：x、y、所属地区的下标
 *   三角形索引（u32）、边界线索引（u32，两个一条线段）
 */
export interface RegionMeshData {
  /** x、y、地区下标，三个一组 */
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  /** 地区轮廓的线段，两个顶点下标一条 */
  readonly lines: Uint32Array;
  readonly bounds: readonly [minX: number, minY: number, maxX: number, maxY: number];
}

const MAGIC = 0x4d4e5552; // 'RUNM'
const VERSION = 1;
const HEADER_BYTES = 5 * 4 + 4 * 4;

export function encodeRegionMesh(mesh: RegionMeshData): Uint8Array {
  const bytes = new Uint8Array(
    HEADER_BYTES + mesh.vertices.byteLength + mesh.indices.byteLength + mesh.lines.byteLength,
  );
  const header = new Uint32Array(bytes.buffer, 0, 5);
  header.set([MAGIC, VERSION, mesh.vertices.length / 3, mesh.indices.length, mesh.lines.length]);
  new Float32Array(bytes.buffer, 20, 4).set(mesh.bounds);
  let offset = HEADER_BYTES;
  for (const part of [mesh.vertices, mesh.indices, mesh.lines]) {
    bytes.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), offset);
    offset += part.byteLength;
  }
  return bytes;
}

export function decodeRegionMesh(buffer: ArrayBuffer): RegionMeshData {
  const [magic, version, vertexCount, indexCount, lineCount] = new Uint32Array(buffer, 0, 5);
  if (magic !== MAGIC || version !== VERSION) {
    throw new Error(
      `不是地区网格文件，或版本不对（标记 ${magic?.toString(16)}，版本 ${version}，要 ${VERSION}）`,
    );
  }
  const [minX, minY, maxX, maxY] = new Float32Array(buffer, 20, 4);
  const vertices = new Float32Array(buffer, HEADER_BYTES, vertexCount! * 3);
  const indices = new Uint32Array(buffer, HEADER_BYTES + vertices.byteLength, indexCount);
  const lines = new Uint32Array(
    buffer,
    HEADER_BYTES + vertices.byteLength + indices.byteLength,
    lineCount,
  );
  return { vertices, indices, lines, bounds: [minX!, minY!, maxX!, maxY!] };
}
