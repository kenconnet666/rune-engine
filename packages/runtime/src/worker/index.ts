/** 运行时在 Worker 里的一半：消息通道的适配、主机的计时循环 */
export { asPort, type MessageTarget } from '../shared/as-port.ts';
export { startHostLoop } from './host-loop.ts';
