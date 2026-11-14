# 这份代码是从哪里来的

`src/` 是从 [vue-tsx-pro](https://github.com/kenconnet666/vue-tsx-pro) 的组件库（`packages/ui/src`）复制过来的：

- 版本 0.25.0，提交 `fffc0c7f`，复制于 2026-11-14；
- 同一位作者，MIT 许可；
- 复制时只把包名从 `@zerodep-dev/vue-tsx-pro-ui` 换成了 `@rune-engine/components`，目录结构没有动。

之后在这边**分叉着改**，不回流上游，上游的源码也不动。目标是整套组件能画进画布（引擎的舞台，见 `docs/interface.md`），
做法和进度在仓库根目录的 `ROADMAP.md`（阶段 11 起）。上游的文档站（vue-tsx-pro.zerodep.dpdns.org）是对比的基准。

要看这边改了什么：和上游那次提交的 `packages/ui/src` 比。
