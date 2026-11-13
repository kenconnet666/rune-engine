/** 构建时定下的变量（见 vite.config.ts） */
interface ImportMetaEnv {
  /** 服务端（联机的房间、云存档）的地址，可以是相对的（'/api'）；不设就没有服务端 */
  readonly VITE_API_URL?: string;
}
