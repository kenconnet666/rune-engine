/**
 * 跟着画布的布局尺寸报告它该有多少设备像素：画布交给 Worker 之后主线程不能再改它的宽高，
 * 尺寸变了由这里告诉渲染线程。用 devicePixelContentBoxSize，缩放比不是整数时也不发虚。返回停止观察的函数
 */
export function observeCanvasSize(
  canvas: HTMLCanvasElement,
  onResize: (width: number, height: number) => void,
): () => void {
  const observer = new ResizeObserver(([entry]) => {
    const size = entry?.devicePixelContentBoxSize?.[0];
    const width = size?.inlineSize ?? Math.round(canvas.clientWidth * devicePixelRatio);
    const height = size?.blockSize ?? Math.round(canvas.clientHeight * devicePixelRatio);
    if (width > 0 && height > 0) onResize(width, height);
  });
  observer.observe(canvas, { box: 'device-pixel-content-box' });
  return () => observer.disconnect();
}
