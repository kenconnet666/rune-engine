/**
 * 主机的计时循环：主机自己不计时，这里每隔 intervalMs 告诉它现实里过了多久。
 * 放在 Worker 里：页面切到后台时主线程的定时器会被压到一秒一次，Worker 里的受影响小得多。返回停止的函数
 */
export function startHostLoop(
  host: { advance(elapsedMs: number): void },
  intervalMs = 50,
  afterAdvance?: () => void,
): () => void {
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    host.advance(now - last);
    last = now;
    afterAdvance?.();
  }, intervalMs);
  return () => clearInterval(timer);
}
