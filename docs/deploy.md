# 部署到 Cloudflare

这一步要用仓库主人自己的 Cloudflare 账号，所以留给你来做；代码、配置和本地的核对都已经备好。
免费计划就够用，不需要绑信用卡、不需要域名。

## 部署出去的是什么

一个 Worker（名字是 `miwang`，在 `games/miwang/server/wrangler.jsonc` 里），里面有三样东西：

| 地址                    | 是什么                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| `/`、`/assets/…`        | 游戏本身：构建出来的静态文件，由 Cloudflare 直接提供，不经过 Worker 的代码 |
| `/api/rooms/<房间号>`   | 联机的房间（WebSocket）：让两位玩家找到彼此、商量直连，直连不通时中转      |
| `/api/saves[/<存档名>]` | 云存档                                                                     |

房间和云存档各是一个 Durable Object 类（`Room`、`Vault`），用的是 SQLite 存储的那一种——免费计划只能用这一种。
页面和接口同一个来源，所以没有跨域的配置。

## 步骤

需要 Node 24 和 pnpm（版本见根目录 `package.json`）。

```bash
pnpm install
```

登录 Cloudflare（会打开浏览器让你授权；只用做一次）：

```bash
pnpm --filter @miwang/server exec wrangler login
```

构建并部署：

```bash
pnpm --filter @miwang/server run deploy
```

它先把游戏按“有服务端”的模式构建到 `games/miwang/server/site/`，再连同 Worker 一起传上去。
第一次部署会创建这个 Worker 和两个 Durable Object 类。结束时会打印地址，形如 `https://miwang.<你的子域>.workers.dev`。

之后每次更新都是同一条命令。

### 部署之后核对

打开那个地址：

1. 地图画出来，主菜单能进对局；
2. 主菜单 → 联机 → 开一个房间：页面上**没有**“这个版本没有接联机服务”这句话，说明连的是真的房间服务；
3. 用另一台设备（或者另一个浏览器）打开邀请链接：进得来；大厅里写着“直连”或者“经服务器中转”；
4. 主菜单 → 存档与回放 → 云端 → 开启云存档，存一份；在另一台设备上填同一个同步码，看得到那一份。

第 3 步是这里测不了的：本机只能测同一台电脑上的两个页面，跨设备、跨网络（各自在路由器后面）要部署之后才试得出来。
两台设备在不同网络时走“中转”是正常的——有些网络环境就是打不通直连，对局不受影响。

### 部署之前在本机核对同一个形态

```bash
pnpm --filter @miwang/server build:site
pnpm --filter @miwang/server preview        # http://localhost:8787：和线上一样，一个地址既是页面也是接口
```

另开一个终端：

```bash
pnpm smoke http://localhost:8787            # 单人流程
pnpm smoke:online http://localhost:8787     # 两个页面联机
pnpm smoke:cloud http://localhost:8787      # 两台“设备”的云存档
```

CI 里每次提交跑的就是这几条。

## 免费额度里要知道的

具体数字以 Cloudflare 的价格页为准（会变）：<https://developers.cloudflare.com/workers/platform/pricing/>、
<https://developers.cloudflare.com/durable-objects/platform/pricing/>。和这个游戏有关的是这几条：

- 静态文件的请求不计数；只有 `/api/…` 的请求算 Worker 的请求数，免费计划按天有上限。
- 联机走**直连**时，对局的消息不经过 Cloudflare，只有开头商量直连的那几条经过房间。
- 联机走**中转**时，每条消息都经过房间：WebSocket 上收到的消息按 20 条折算一次请求。经网络发的状态限在每秒八份左右，
  一局打一个小时大约折算一两千次请求——免费额度一天够打很多局，但不是无限的。
- 没人说话的房间会休眠（连接留着、不计运行时间）；人都走了十分钟后房间自己清掉。
- 云存档每个同步码最多八份、每份不超过 512 KB（压缩后一份通常二三十 KB）；半年没人碰的整个清掉。

额度用完的那一天，`/api` 会报错：联机和云存档暂时不可用，单人照常玩（游戏本身是静态文件）。

## 数据和安全

- 没有账号，不收集任何个人信息。
- 房间里只存主人的那把随机钥匙（用来认出“同一位主人又进来了”），不存对局内容。
- 云存档的柜子用同步码的 SHA-256 命名，服务端不存同步码本身；同步码是唯一的凭据，拿到它的人能读写那批存档。
- 房间号是 6 位，知道房间号就能进；房间服务没有做限速。给朋友之间玩够用，不防有人存心捣乱。
- 主机（在开房间的玩家的浏览器里）不信网络另一头发来的东西：形状不对的消息不理，一步之内的命令数有上限。

## 以后要改的时候

- **换名字**：改 `wrangler.jsonc` 里的 `name`，地址跟着变。
- **用自己的域名**：在 Cloudflare 控制台给这个 Worker 加 Custom Domain，或者在 `wrangler.jsonc` 里加 `routes`。不用改代码。
- **页面和服务端分开部署**（比如页面放别处）：构建时用环境变量 `VITE_API_URL` 指向服务端的地址；
  房间会核对页面的来源，云存档没有配跨域，分开部署要自己加上。
- **改了 Durable Object 的类**（加一个类、改名、删掉）：在 `wrangler.jsonc` 的 `migrations` 里**加一条新的**（`v2`、`v3`…），
  不要改已经部署过的那一条。本机的开发状态在 `games/miwang/server/.wrangler/`，对不上了可以整个删掉。
- **回滚**：`pnpm --filter @miwang/server exec wrangler rollback`。**整个下线**：`pnpm --filter @miwang/server exec wrangler delete`
  （Durable Object 里的数据会一起删掉）。
- **在 CI 里自动部署**：给 wrangler 一个 API 令牌（环境变量 `CLOUDFLARE_API_TOKEN`，放在 GitHub 的 secrets 里，不要写进任何文件）。
  现在的 CI 不部署。
