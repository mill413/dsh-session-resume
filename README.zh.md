# dsh-session-resume

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：当会话在 turn
进行中被**中断**时显示一个 **继续** 按钮。当 Harness 进程死亡（重启、OOM 被 kill、或崩溃），
恢复后的会话停在一个被打断的 turn 上；点击按钮让模型接着该 turn 收尾——
无需手动敲"继续"消息。续跑**严格由用户触发**：绝不自动续跑。

[English](README.md)

## 它能做什么

- **检测被撕裂的 turn。** 没有持久化的"是否被中断"标志——`sessionResume` 投影从修复后的会话日志
  推导状态，因此只对真正崩溃中断的 turn 生效。
- **显示继续按钮。** 位于 `conversation.input.dock` composer 槽的停靠条（与 goal、todo、queue
  停靠条同族），仅在 `interruptedTurn != null` 时渲染。
- **点击续跑。** 调宿主 `@Remote('resume')`（带 wire `sessionId`），排入一条 **plugin 来源的
  `notice`** 消息指示模型继续。续跑一开始，投影即清除，按钮消失。

绝不自动续跑，也绝不把续跑伪装成用户的输入。

## 工作原理

1. **检测** — `sessionResume` 投影折叠每一条已提交的 `turn/end`：`turn/end` 的
   `reason.kind === 'interrupted'` 把会话标记为"待续跑"（记录 turn 号）；下一条 `turn/start`
   清除该标记。投影通过标准的 `session/projection` 帧推送给客户端，插件自身不建 store。
2. **按钮** — Web 停靠条读取 `useProjection('sessionResume')`，当 `interruptedTurn != null`
   时才渲染继续按钮。
3. **继续** — 宿主解析 live agent、重新折叠会话日志，若存在待续跑的中断 turn，则
   `agent.followup(buildResumeMessage())`。"仅当工具为只读或幂等才重试"的指引遵循崩溃修复
   `TOOL_OUTCOME_UNKNOWN` 的语义，而不会盲目重跑可能有副作用的工具。

### 检测范围

只有 `turn/end { reason: 'interrupted' }` 被当作可续跑。该标记**只有崩溃修复路径**会产生，因此覆盖
一切"进程中途死亡"的情形（重启、OOM、被 kill、崩溃）。它**刻意不**覆盖 `max-tokens`（模型输出上限）、
`aborted`（主动取消）、`error`、`blocked`——那些要么不是"被截断且想继续"，要么是用户主动发起的。
扩大到 `max-tokens` / `aborted` 可作为后续项。

## 安装

用 `dsh-plugin` CLI 把插件装进某个 DSH profile；它会锚定包路径（或包名）、应用各包自带的
`dsh.bundle` patch，并 reconcile profile 的 bundle 层栈。宿主与 UI 是**两个包**，都要加到同一
个 profile。

**从本地源码检出**——先构建（见[从源码构建 / 测试](#从源码构建--测试)），再从 harness 检出按路径
逐个添加：

```sh
pnpm install
pnpm run build

cd <harness-checkout>
pnpm dsh plugin --profile web add <path-to-dsh-session-resume>/packages/session-resume
pnpm dsh plugin --profile web add <path-to-dsh-session-resume>/packages/ui-session-resume
```

**发布到 npm 后**，用包名即可安装：

```sh
dsh plugin --profile web add @mill413/dsh-session-resume
dsh plugin --profile web add @mill413/dsh-client-ui-session-resume
```

无论哪种方式，改变 profile 的 bundle 列表后都需要**重启 DSH web 进程**（你如何运行它都行——`dsh web`、
服务管理器、或你自己的部署方式），新 bundle 才会加载。两条 `add` 命令都会在 `$DSH_HOME/profiles/web`
里 `pnpm add` 并把包并进 `dsh.profile.bundles`；按路径安装时 profile 以 path 链接该包，所以重新构建
插件 `lib/` 后重启即可生效。**不要**往 `$DSH_HOME/profiles/web/cordis.patch.yml` 手动 insert 本插件——
包里自带的 `cordis.patch.yml` 已构成该行，重复 insert 会让加载器报 duplicate loader entry id 无法启动。

## 兼容性

针对 **`@deepseek-ai/dsh` `0.1.2-alpha.5`**（本插件验证所用的 harness 版本线）构建与测试。宿主与 UI 包
把 `@deepseek-ai/*` 依赖声明为 `"*"` 的 peer，运行时由宿主 DSH web profile 的 node_modules 解析（遵循
插件开发约定）。后续 harness 版本可能改动 session-projection 或 conversation-input-dock 接缝；升级 `dsh`
后请看本节。

## 使用

崩溃后下次冷加载，会话会在 composer 上方显示继续停靠条。文案随界面语言切换（`zh` / `en`）；模型侧
续跑提示钉在 `packages/session-resume/src/resume.ts`。停靠条与按钮在正常会话、用户主动取消的 turn、
`max-tokens` 截断、或没有中断 turn 的会话上**都不会**出现。

## 配置

宿主服务声明了空 `Config`（`Config: z.object({})`），因此插件挂载即生效、不可从 `cordis.yml` 调参；
也**没有**自动续跑模式与部署级文案覆盖。

## 从源码构建 / 测试

```sh
pnpm install            # 需要同级 ../deepseek-harness 检出（workspace 镜像）
pnpm run build          # host: tsc + tsdown + typert；client: tsc + tsdown clientBundle
pnpm test               # host 折叠/续跑消息 + Web dock 组件测试

npm pack --dry-run -C packages/session-resume
npm pack --dry-run -C packages/ui-session-resume
```

宿主投影折叠与续跑消息构造是纯函数，已在 `packages/session-resume/tests/` 单测覆盖；composer 停靠条
组件在 `packages/ui-session-resume/tests/resume-dock.client.spec.tsx` 覆盖。

> **注（独立 workspace）：** `@deepseek-ai/dsh-typert-protocol` 没有链到仓库根 `node_modules`
> （它只是宿主/客户端包的 `workspace:*` 依赖）。从仓库根跑 `vitest` 时，只有该包自身的 `node_modules`
> 在解析路径上才能解析到它。投影单测（`projection.spec.ts`）不引入 llm/typert 链路，可直接通过；
> 另外两个经 `@deepseek-ai/dsh-llm` 间接引入它的（`resume-message.spec.ts`、`resume-dock.client.spec.tsx`）
> 需要该链接存在才能解析。

## 已知限制

- 续跑**严格由用户触发**，刻意不提供自动续跑模式；可配置的自动模式可作为后续项。
- 检测仅覆盖"崩溃撕裂的 turn"（`reason: 'interrupted'`）。它不提供对 `max-tokens`/`aborted` turn 的续跑，
  也不覆盖"agent 空闲但已有排队的后台工作"（例如已 armed 的 goal 轮次）；该场景由 goal 子系统自身的
  resume 流程负责。

## License

MIT。完整设计、安装与模型体验说明见宿主包
[README.md](packages/session-resume/README.md)（英文）与
[`README.zh.md`](packages/session-resume/README.zh.md)（中文）。
