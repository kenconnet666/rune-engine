/** 运行时在主线程的一半：消息通道的适配、画布尺寸、对局记录的暂存 */
export { asPort, type MessageTarget } from '../shared/as-port.ts';
export { observeCanvasSize } from './canvas.ts';
export { jsonStore, type JsonStore } from './json-store.ts';
