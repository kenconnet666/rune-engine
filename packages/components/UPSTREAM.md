# 这份代码是从哪里来的

`src/` 是从 [vue-tsx-pro](https://github.com/kenconnet666/vue-tsx-pro) 的组件库（`packages/ui/src`）复制过来的；
文档站（`apps/docs`）是从它的 `apps/docs` 复制过来的，对着同一个提交：

- 现在对着的是版本 0.29.0，提交 `0de173eb`（头一回复制的是 0.25.0、`fffc0c7f`，中间跟过 0.26.0 到 0.28.0，都在 2026-11-14）；
- 同一位作者，MIT 许可；
- 复制时只把包名从 `@zerodep-dev/vue-tsx-pro-ui` 换成了 `@rune-engine/components`，目录结构没有动
  （另有一处：`utils/.test/dependencies.test.ts` 里“第三方依赖”不算这边自己的包）；
- 文档站没取的：流程中心和它的示例（Workflow 那一页、“流程引擎”那一页）、移动端的演示外框、预渲染和部署、
  样式更新的基准页。代码演练场取了。这边自己的文件是 `package.json`、`vite.config.ts`、`tsconfig.json`、
  `src/main.ts` 和 `src/stage/`（整站放进舞台、两种摆法的开关），同步时不会被换掉；另外有几处固定的小改动
  （路由、导航里拿掉没取的页面，读 API 时认这边的导出表），都写在同步脚本里。

之后在这边**分叉着改**，不回流上游，上游的源码也不动。目标是整套组件能画进画布（引擎的舞台，见 `docs/interface.md`），
做法和进度在仓库根目录的 `ROADMAP.md`（阶段 11 起）。上游的文档站（vue-tsx-pro.zerodep.dpdns.org）是对比的基准。

要看这边改了什么：和上游那次提交的 `packages/ui/src` 比。

## 这边改过的地方

分叉从 2026-11-14 开始，目前很少，全部由同步脚本重新打上（脚本里每一处都写了为什么）：

- **加的文件**：`utils/dom/scroll-root.ts`——“整页滚动”滚的是谁。站点放在舞台里时滚的是一个盒子，不是窗口；
  最外面用 `provideScrollRoot` 说一声，没有另外指定容器的组件就认它。入口是 `@rune-engine/components/scroll-root`。
- **改的文件**：`utils/dom/scroll-spy.ts`（本页目录的高亮）、`layout/BackTop.tsx`（回到顶部）——默认的滚动容器
  从“窗口”改成“页面滚动的那个，没人说过才是窗口”。在普通网页里行为不变。
- 还盯着窗口、没改的：`ViewportFill`（量自己离文档顶多远）、窗口模式的虚拟滚动、拖拽排序到边缘时的自动滚动。

## 怎么跟上游同步

这边的改动还少、都写在同步脚本里的这段时间，同步还是整份重新复制再把改动打上，一条命令
（只读上游仓库的那个提交，不碰它的工作区）：

```sh
node scripts/sync-upstream.mjs <上游仓库的路径> <提交> <版本号>
pnpm install && pnpm check
```

它把上游的 `packages/ui/src` 和 `apps/docs` 取出来换进来，做上面说的那些改动，再照这边的格式重排一遍。
上游改了脚本要动的那几处的话它会停下来说是哪里。同步完把这个文件开头的版本和提交号改掉。
上游的会话每次发版会给提交号和要点。

开始在这边改组件之后就不能整份覆盖了：到那时按上游两次提交之间的差异（`git diff 旧提交 新提交 -- packages/ui/src`）
逐个文件合进来，这边改过的文件手工对。所以这边的改动尽量集中在少数几个基础件上。
