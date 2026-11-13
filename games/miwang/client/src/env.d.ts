/** 构建时定下的变量（见 vite.config.ts） */
interface ImportMetaEnv {
  /** 联机的房间服务的地址，可以是相对的（'/api/rooms'）；不设就没有联机服务 */
  readonly VITE_SIGNAL_URL?: string;
}
