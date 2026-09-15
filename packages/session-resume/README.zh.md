# @mill413/dsh-session-resume

**dsh-session-resume** 插件：让 DeepSeek Harness 中因进程意外退出而中断的任务，可以点击「继续」恢复。当前尚未发布的 `0.2.0-dev` 单包同时包含宿主部分（中断投影、恢复动作、模型侧提示）和浏览器部分（`./client`，输入框上方的继续条），DSH 通过 `dsh.client` 自动发现浏览器入口。该开发版本已针对 DSH `0.1.5-rc.2` 验证。

## 安装

统一后的 `0.2.0-dev` 尚未发布；本地验证时请先构建当前 checkout，再把 `packages/session-resume` 的绝对路径装入 profile。

npm 的 `latest` 是合并前的 `0.1.1`，目标宿主为 DSH `0.1.2-alpha.5`，使用时需要安装两个旧版配套包：

```sh
dsh plugin --profile web add @mill413/dsh-session-resume@0.1.1
dsh plugin --profile web add @mill413/dsh-client-ui-session-resume@0.1.1
```

安装后重启 DSH Web 并刷新页面，不要手动修改 profile 的 bundle patch。

## 行为

- 从宿主修复后的日志生成 `sessionResume` 投影：只识别 `reason.kind === 'interrupted'` 的 `turn/end`，下一次 `turn/start` 清除状态。
- 提供 `resume` 远程动作，发送续跑消息前再次核对已加载会话。
- 将工具安全指引放到 `next-turn` 队首，再通过 `agent.steer()` 发送简短的继续提示，使续跑指引先于已有排队轮次送达。
- 发送两条插件来源的 `notice` 消息，对模型可见并记入日志；不伪装成人工输入，不修改系统提示。

恢复必须由用户点击触发，没有配置项。提示要求模型避免重复已完成步骤，并在重试非幂等操作前检查外部状态；这不是防重复执行保证，也不会恢复进程内存。

主动取消、token 上限、普通错误、blocked 状态和空闲的 goal 后台工作不会触发本功能。

## 开发

不需要 Harness 源码目录。使用 Node.js 24 和 pnpm 11.26.0，DSH SDK 开发依赖固定为 npm 发布的 0.1.5-rc.2。在插件仓库根目录执行：

```sh
pnpm install --frozen-lockfile
node --test scripts/release.test.mjs
npm test
npm run build
node scripts/pack-release.mjs
```

最后一步检查包内容并在 `dist/` 生成一个 tarball，不会发布到 npm。

完整安装与排查说明见仓库根目录 README。

## 许可

MIT
