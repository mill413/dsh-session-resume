# @deepseek-ai/dsh-session-resume

一个 DeepSeek Harness 插件：当会话被 Harness 重启打断时，Web 客户端会显示一个
**继续** 按钮，点击后让模型接着被打断的 turn 继续工作——无需手动发送"继续"消息。

当 Harness 在 turn 进行中被重启（例如模型执行了 `systemctl restart dsh-web`），
持久化会话日志会以一个悬空的 `turn/start` 结尾。下次冷加载时，会话持久化层会把这个
撕裂的日志修复：补一条 `turn/end { reason: { kind: 'interrupted' } }` 把该 turn
闭合为"已结束"。会话虽被恢复，但默认置于 idle——harness 本身不会自动续跑，用户
必须手动发一条消息。

本插件以**用户触发**的方式补上这一环：在会话停在一个被打断的 turn 上时显示按钮，
点击后由宿主排入一条 **plugin 来源的 `notice`** 消息，指示模型继续。绝不自动续跑。

## 组成

- `packages/session-resume` — `@deepseek-ai/dsh-session-resume`（宿主）：注册
  `sessionResume` 会话投影与 `@Remote('resume')` 动作。
- `packages/ui-session-resume` — `@deepseek-ai/dsh-client-ui-session-resume`（Web 客户端）：
  composer 上方的继续停靠条。
- `packages/typert-protocol` — Typert Remote 协议（workspace 副本）。

## 工作原理

1. **检测** — 没有持久化的"是否活跃/被中断"标志；插件从修复后的日志推导状态。
   `sessionResume` 投影折叠每一条 `turn/end`；`turn/end` 的 `reason.kind === 'interrupted'`
   会把会话标记为"待续跑"（记录 turn 号），下一条 `turn/start` 则清除该标记。该投影
   通过标准的 `session/projection` 帧推送给客户端。
2. **按钮** — Web 停靠条位于 `conversation.input.dock` 槽（与 goal 条同一槽位）。
   它读取 `useProjection('sessionResume')`，当 `interruptedTurn != null` 时才渲染继续按钮。
3. **继续** — 按钮调用宿主 `@Remote('resume')`。宿主重新折叠 live 会话日志；若存在待续跑的
   中断 turn，则 `agent.followup(buildResumeMessage())` 排入一条 **plugin `notice`** user
   消息（不是伪装的用户输入），指示模型继续。续跑一开始，投影即清除，按钮消失。

严格的 `interrupted` 边界意味着按钮只在真正被撕裂的 turn 上出现；"仅当工具为只读或幂等
才重试"的指引遵循崩溃修复 `TOOL_OUTCOME_UNKNOWN` 的语义，而不会盲目重跑可能有副作用的工具。

## 安装

把宿主与 UI 包通过插件命令装进 `web` profile（各自使用自带的 bundle patch）：

```sh
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/session-resume
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/ui-session-resume
```

在 harness 检出目录运行（`dsh` CLI 走源码启动）。随后重建 web bundle 并重启 profile
（见工作区 AGENTS.md）。

## 开发

```sh
pnpm install
pnpm run build   # host: tsc + tsdown + typert；client: tsc + tsdown clientBundle
pnpm test
```

宿主投影折叠是纯函数，已在 `packages/session-resume/tests/projection.spec.ts` 中单测覆盖。

## 已知限制与延期工作

- 续跑**严格由用户触发**，刻意不提供自动续跑模式；可配置的自动模式可作为后续项。
- 检测仅覆盖"被打断的 turn"（悬空 `turn/start` 被修复为 `turn/end { interrupted }`）。
  它不检测"agent 空闲但已有排队的后台工作"（例如已 armed 的 goal 轮次）；该场景由
  goal 子系统自身的 resume 流程负责。
