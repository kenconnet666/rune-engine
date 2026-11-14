/** 往一帧上接着画的东西，和把界面画进纹理的那个显卡接口（还没进 @webgpu/types 的声明） */
import type { ElementImage } from './ui-types.ts';

/** GPUQueue 上把 ElementImage 画进纹理的那个方法 */
export interface ElementImageQueue {
  drawElementImageToTexture(
    source: { source: ElementImage },
    destination: { texture: GPUTexture; premultipliedAlpha?: boolean; size?: GPUExtent3D },
  ): void;
}

/** 画完主画面之后，往同一帧上接着画的一层东西。设备丢了重建时 attach 会再叫一次 */
export interface FrameLayer {
  attach(device: GPUDevice, format: GPUTextureFormat): void;
  detach(): void;
  /** target 是这一帧的画布；width、height 是它的像素尺寸 */
  draw(
    encoder: GPUCommandEncoder,
    target: GPUTextureView,
    width: number,
    height: number,
    nowMs: number,
  ): void;
}
