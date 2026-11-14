# 这份代码是从哪里来的

`src/` 是从 [vue-tsx-pro](https://github.com/kenconnet666/vue-tsx-pro) 的组件库（`packages/ui/src`）复制过来的：

- 现在对着的是版本 0.26.0，提交 `c42b2f39`（头一回复制的是 0.25.0、`fffc0c7f`，都在 2026-11-14）；
- 同一位作者，MIT 许可；
- 复制时只把包名从 `@zerodep-dev/vue-tsx-pro-ui` 换成了 `@rune-engine/components`，目录结构没有动
  （另有一处：`utils/.test/dependencies.test.ts` 里“第三方依赖”不算这边自己的包）。

之后在这边**分叉着改**，不回流上游，上游的源码也不动。目标是整套组件能画进画布（引擎的舞台，见 `docs/interface.md`），
做法和进度在仓库根目录的 `ROADMAP.md`（阶段 11 起）。上游的文档站（vue-tsx-pro.zerodep.dpdns.org）是对比的基准。

要看这边改了什么：和上游那次提交的 `packages/ui/src` 比。

## 怎么跟上游同步

在这边动组件的源码**之前**，同步就是整份重新复制：按提交号把上游的 `packages/ui/src` 取出来换进来，再做上面那两处改动
（0.25.0 → 0.26.0 就是这么做的）。上游的会话每次发版会给提交号和要点。

开始在这边改组件之后就不能整份覆盖了：到那时按上游两次提交之间的差异（`git diff 旧提交 新提交 -- packages/ui/src`）
逐个文件合进来，这边改过的文件手工对。所以这边的改动尽量集中在少数几个基础件上。
