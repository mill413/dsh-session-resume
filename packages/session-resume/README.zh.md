# @deepseek-ai/dsh-session-resume

一个 DeepSeek Harness 插件：当会话在 turn 进行中被中断（Harness 进程死亡——重启、OOM、崩溃），
Web 客户端会显示一个 **继续** 按钮，点击后让模型接着被打断的 turn 继续工作——无需手动发送
"继续"消息。续跑**严格由用户触发**。

当 Harness 在 turn 进行中死亡，持久化会话日志会以一个悬空的 `turn/start` 结尾。下次冷加载时，
会话持久化层会把这个撕裂的日志修复：补一条 `turn/end { reason: { kind: 'interrupted' } }`
把该 turn 闭合为"已结束"。会话虽被恢复，但置于 idle——harness 不会自动续跑，用户需手动处理。

本插件以**用户触发**的方式补上这一环：在会话停在一个被打断的 turn 上时显示按钮，点击后由宿主
排入一条 **plugin 来源的 `notice`** 消息，指示模型继续。绝不自动续跑。

## 组成

- `packages/session-resume` — `@deepseek-ai/dsh-session-resume`（宿主）：注册
  `sessionResume` 会话投影与 `@Remote('resume')` 动作。
- `packages/ui-session-resume` — `@deepseek-ai/dsh-client-ui-session-resume`（Web 客户端）：
  composer 上方的继续停靠条。
- `packages/typert-protocol` — Typert Remote 协议（workspace 副本）。

## 工作原理

1. **检测** — 没有持久化的"是否活跃/被中断"标志；插件从修复后的日志推导状态。
   `sessionResume` 投影折叠每一条 `turn/end`；`turn/end` 的 `reason.kind === 'interrupted'`
   会把会话标记为"待续跑"（记录 turn 号），下一条 `turn/start` 则清除该标记。该投影通过标准的
   `session/projection` 帧推送给客户端。
2. **按钮** — Web 停靠条位于 `conversation.input.dock` 槽（与 goal/Todo/Queue 同族，读起来是
   composer 卡片堆叠的一部分）。它读取 `useProjection('sessionResume')`，当 `interruptedTurn != null`
   时才渲染继续按钮。
3. **继续** — 按钮以 wire `sessionId` 调宿主 `@Remote('resume')`。宿主解析 live agent、重新折叠
   会话日志，若存在待续跑的中断 turn，则 `agent.followup(buildResumeMessage())` 排入一条
   **plugin `notice`** user 消息（不是伪装的用户输入），指示模型继续。续跑一开始，投影即清除，
   按钮消失。

严格的 `interrupted` 边界意味着按钮只在真正被撕裂的 turn 上出现；"仅当工具为只读或幂等才重试"
的指引遵循崩溃修复 `TOOL_OUTCOME_UNKNOWN` 的语义，而不会盲目重跑可能有副作用的工具。

### 检测范围

只有 `turn/end { reason: 'interrupted' }` 被当作可续跑。该标记**只有崩溃修复路径**会产生，因此覆盖
一切"进程中途死亡"的情形（重启、OOM、被 kill、崩溃）。它**刻意不**覆盖 `max-tokens`（模型输出上限）、
`aborted`（主动取消）、`error`、`blocked`——那些要么不是"被截断且想继续"，要么是用户主动发起的。
扩大到 `max-tokens`/`aborted` 可作为后续项（见限制）。

### UI 文案

停靠条的标签与按钮文案在类型化 locale 字典里（`ui-session-resume/src/client/locales.ts`，含 `zh`/`en`
两套），随界面语言切换；不写死在组件里，也不通过 settings 做部署级配置（产品文案遵循客户端 i18n 规则）。
模型侧续跑提示与折叠摘要钉在 `session-resume/src/resume.ts`。

## 安装

在 harness 检出目录把宿主与 UI 包通过插件命令装进 `web` profile（`dsh` CLI 会锚定相对路径、应用各包自带
的 `dsh.bundle` patch，并 reconcile profile 的 bundle 层栈）：

```sh
cd /home/haruto/Documents/Code/dsh/deepseek-harness
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/session-resume
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/ui-session-resume
```

两条命令都会在 `$DSH_HOME/profiles/web` 里 `pnpm add` 并把包并进 `dsh.profile.bundles`。profile 按路径
链接这些包，所以重新构建插件 `lib/` 后重启即可生效：

```sh
systemctl --user restart dsh-web.service   # 见工作区 AGENTS.md
```

## 开发

```sh
pnpm install            # workspace 安装；镜像 deepseek-harness 检出
pnpm run build          # host: tsc + tsdown + typert；client: tsc + tsdown clientBundle
pnpm test               # host 折叠/续跑消息 + Web dock 组件测试
```

宿主投影折叠是纯函数，已在 `packages/session-resume/tests/projection.spec.ts` 中单测覆盖。

`pnpm-workspace.yaml` 镜像 Harness 自身的包 glob（`vendor/*`、`packages/*/*`、`apps/*`、`website`、
`python/sdk-runtime`、`native/landlock-run`），并带一个指向 harness 的 `patches` 软链，使本仓库能在同级
`../deepseek-harness` 检出旁独立构建插件。若换检出路径，需同步改这些 glob、两条 `overrides` 与 `patches` 软链。

## 配置

宿主服务声明了空 `Config`（`Config: z.object({})`），因此插件挂载即生效、不可从 `cordis.yml` 调参；也**没有**
自动续跑模式与部署级文案覆盖。

## 已知限制与延期工作

- 续跑**严格由用户触发**，刻意不提供自动续跑模式；可配置的自动模式可作为后续项。
- 检测仅覆盖"崩溃撕裂的 turn"（`reason: 'interrupted'`）。它不提供对 `max-tokens`/`aborted` turn 的续跑，
  也不覆盖"agent 空闲但已有排队的后台工作"（例如已 armed 的 goal 轮次）；该场景由 goal 子系统自身的
  resume 流程负责。
