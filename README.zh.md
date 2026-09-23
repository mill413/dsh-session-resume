# dsh-session-resume

**任务意外中断，点一下「继续」，接着完成。**

这是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。当 DSH 进程在任务执行中退出，重新打开会话后，插件会在输入框上方显示「继续」按钮。你决定什么时候恢复，不需要再手动输入续跑提示。

[English](README.md)

## 使用体验

1. DSH 在执行任务时意外退出，例如崩溃、OOM 或中途重启。
2. 重新启动 DSH 并打开原会话；宿主恢复日志后，输入框上方出现中断提示。
3. 点击 **继续**。插件将续跑指引放在已有待发送消息之前。
4. 新一轮开始后，提示自动消失。

界面支持中文和英文，跟随 DSH 的语言设置。插件不自动恢复任务，也没有额外配置项。

## 安装

当前发布版本是 **`0.4.0`**，已针对 **DSH `0.1.7-alpha.2`** 验证。其他宿主版本需要另行验证。

插件是单个包，同时包含宿主和 Web 界面两部分；其 `dsh.client` 声明会让 DSH 自动加载 `./client`，因此只需安装一次。以下以 `web` 为例，使用运行该 profile 的 DSH CLI。

### 从本地源码安装

先按下方「开发」章节构建，再执行（替换为实际绝对路径）：

```sh
dsh plugin --profile web add /path/to/dsh-session-resume/packages/session-resume
```

### 从 npm 安装

从 npm 安装统一包：

```sh
dsh plugin --profile web add @mill413/dsh-session-resume@0.4.0
```

安装后，**重启 DSH Web 进程并刷新页面**。不要手动修改 profile 的 `cordis.patch.yml`；安装命令会应用插件自带的挂载声明。

## 边界与安全

- **只识别宿主标记为 `interrupted` 的轮次。** 主动停止、输出达到 token 上限、普通错误和 `blocked` 状态不会触发按钮。
- **不是检查点恢复。** 它基于已有会话上下文请求模型继续，不会恢复进程内存，也不能保证从中断的精确位置重放。
- **不会自动重试工具。** 续跑指引要求模型：仅对只读或幂等操作直接重试；其他操作先检查外部状态，并避免重复已完成步骤。这是给模型的指引，不是事务回滚或防重复执行保证。
- **不替代 goal 的恢复流程。** 仅有后台任务排队、但没有中断轮次的会话不在检测范围内。

### 为什么没有「继续」按钮？

先确认该包已装入当前 profile，并且已重启 Web、刷新页面。按钮只会在宿主恢复日志后确认存在待续跑的中断轮次时显示；正常完成或主动取消的会话没有按钮是预期行为。

如果点击后出现错误，请检查会话是否已加载，以及是否已在其他页面开始了新一轮。插件会在发送前重新核对会话状态。

## 开发

**不需要 Harness 源码目录。** 开发依赖直接从 npm 安装，DSH SDK 固定到 `0.1.7-alpha.2`；仅保留本仓库内构建所需的 Typert 协议源码。安装、开发和 CI 都不需要修改或部署 Harness 本体。

建议使用 Node.js 24（与 CI 一致），以及 `packageManager` 指定的 pnpm `11.26.0`。在插件仓库根目录执行：

```sh
npm install --global pnpm@11.26.0  # 已安装对应版本时可跳过
pnpm install --frozen-lockfile
node --test scripts/release.test.mjs
npm test
npm run build
node scripts/pack-release.mjs
```

最后一步检查包内容并在 `dist/` 生成一个 tarball，不会发布到 npm。

更新依赖时使用 `pnpm install` 并提交新的 `pnpm-lock.yaml`；CI 使用 frozen lockfile，防止构建时悄悄改变依赖版本。

| 目录 | 职责 |
| --- | --- |
| `packages/session-resume` | 中断状态投影、恢复动作、模型侧提示，以及输入框上方的继续按钮与中英文文案 |
| `packages/typert-protocol` | 构建所需的 Typert 协议源码 |
| `build` | 客户端打包配置 |

### 实现概要

`sessionResume` 投影从会话日志中读取 `turn/end` 的 `reason.kind === 'interrupted'`，记录待续跑轮次，并在下一次 `turn/start` 时清除。

点击按钮后，宿主重新核对日志，将安全指引放到 `next-turn` 队首，再通过 `agent.steer()` 发送简短的继续提示以唤醒 agent。两条消息均标记为插件来源的 `notice`，对模型可见并记入会话日志，不伪装成人工输入。

## 许可

[MIT](LICENSE)。提取自 Harness 的构建支持代码见[第三方声明](THIRD_PARTY_NOTICES.md)。
