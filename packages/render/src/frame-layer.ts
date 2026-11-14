/** 往一帧上接着画的东西，和把拍下来的界面画出来的那个接口（还没进 TypeScript 自带的声明） */
import type { ElementImage } from './ui-types.ts';

/**
 * 2D 上下文上把 ElementImage 画出来的方法：只取其中一块（源矩形，按**排版像素**算），
 * 画到画布上的一块（目的地，按画布的像素算）——两个矩形不一样大就是缩放着画（高分屏放大着画，字照样清楚）。
 * 只能画在这份界面所在的那张画布上；同一份可以反复画，直到 close
 */
export interface ElementImageContext {
  drawElementImage(
    image: ElementImage,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
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
