/** 会话的客户端一头：发命令、调时钟、收自己能看到的状态。界面、渲染、AI 都用它连主机 */
import type { Port } from './port.ts';
import type { ClientMessage, HostMessage } from './protocol.ts';

export interface SessionHandlers<View> {
  /** 主机发来了新的状态 */
  view(message: Extract<HostMessage<View>, { type: 'view' }>): void;
}

export interface Session<Command> {
  send(command: Command): void;
  setSpeed(speed: number): void;
  setPaused(paused: boolean): void;
  /** 不再接收消息 */
  close(): void;
}

export function connectSession<Command, View>(
  port: Port<HostMessage<View>, ClientMessage<Command>>,
  handlers: SessionHandlers<View>,
): Session<Command> {
  port.onmessage = ({ data }) => {
    if (data.type === 'view') handlers.view(data);
  };
  return {
    send: (command) => port.postMessage({ type: 'command', command }),
    setSpeed: (speed) => port.postMessage({ type: 'speed', speed }),
    setPaused: (paused) => port.postMessage({ type: 'pause', paused }),
    close: () => void (port.onmessage = null),
  };
}
