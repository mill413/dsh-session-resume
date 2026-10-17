# 0.2.1-alpha.3 构建移植记录

## 确证的根因

这是 generator 的分析范围回归，不是 session 声明布局变化，也不是合并检查新增。

分别在临时目录 `npm pack` 并解包两个已发布的
`@deepseek-ai/dsh-session@0.2.1-alpha.{2,3}` 后，
`lib/types/index.d.ts` 的 `diff -u` 为空，两者 SHA-256 均为：

```text
f3e7b142a37713ec13a40a7269ee871cff83ad8184d84ce58c8b6adcc8107b08
```

两版第 72–76 行都有同一个 `declare module '@deepseek-ai/dsh-typert-protocol'`
及 `TypertLookupMap.session: TypertLookup<Session, SessionId>`。

只读对比 harness 的 `dsh-v0.2.1-alpha.2` / `dsh-v0.2.1-alpha.3` tags：

| 位置 | 最小相关差异 |
| --- | --- |
| `packages/typert/generator/src/analyzer.ts` 的 `ensureDeclaration` | 整个函数相同；错误检查位于 alpha.2:2072 / alpha.3:2178。 |
| 同文件 `registrationForFile` | 整个函数相同；仍要求同 face、文件位于注册包根目录内。 |
| 同文件 `loadRegistrations` | aggregate 配置单独缓存，project config 改为惰性读取；仍从 references 注册 `packages/` 内的包，没有增加 node_modules 注册。两版均注册本仓库的 protocol、session-resume。 |
| `workspace.ts:66` → `:77` 的 `generate` | alpha.2 将 `selected` 传给 analyzer；alpha.3 将全部 `contributors` 传给 analyzer，仅在 emit 时用 `selected` 过滤。**这才是触发差异。** |
| `tsdown-plugin.ts` / 新增 `worker.ts` | workspace 生成移入 Worker，调用 `generateContributors()`；后者仍进入上述 `generate()`。Worker 只改变调度和报错包装。 |

本地 protocol 镜像的 `Context.typert: TypertRegistryContract` 使它被发现为 contributor。
alpha.2 workspace 插件先按 manifest 中的 Typert/remote 导出筛选，仅分析 session-resume；
镜像仍注册，用于识别 `Remote` / `TypertRemoteService`，但不会主动反射它的 registry。
alpha.3 则额外反射镜像的 registry，经 lookup API 遍历到 `TypertLookupMap`，
碰到未注册的 npm session augmentation，于是触发原有严格检查。

对照实验使用临时解包的 **alpha.2 generator 发布包**和当前 alpha.3 generator，
均读取同一仓库、当前已安装 SDK、同一组 host 配置：

- alpha.2 `discover → 按 manifest 筛选 → generate(selected, ['host'])` 成功。
- alpha.3 `generate(selected, ['host'])` 复现用户报告的同一错误。
- alpha.3 `WorkspaceAnalyzer({ packages: selected, faces: ['host'], ... })` + emitter 成功。

此实验隔离了 generator 的变化；没有声称重新安装并验证了整套 alpha.2 依赖树。

## 本仓库修法及产物

`build/typert-workspace.ts` 通过公开 API 继承 `WorkspaceTypertGenerator`，
在 contributor discovery 中只排除私有协议镜像。保留所有 face 注册、paths、
业务 contributor、上游 manifest 校验和完整 workspace 产物写入。
装饰器转换仍使用上游插件。没有改成 package 模式，没有修改 node_modules 或 generator。

这是针对当前两包结构的 workaround：协议镜像用于编译符号解析，不作为宿主 registry 的反射根。
代价是本地适配代码和同步生成，暂不使用上游 Worker。升级 generator 时须复核此适配。
如果未来协议镜像本身也要发布 Typert face，则不能继续排除它。

未选择全量刷新镜像：已 pack 检查 alpha.3 protocol 发布包，它仍有同一 lookup map
和 `Context.typert` augmentation，刷新不会消除这条分析路径。
插件公开选项只有 `mode` / `faces`，没有受支持的外部 SDK 注册入口；
移除镜像的 face 注册又会破坏生成器对协议符号的识别。

alpha.3 生成代码还新增了对 `@deepseek-ai/dsh-typert-protocol/remote-info` 的运行时引用。
`build/client-bundle.ts` 仅允许这个精确子路径内联：发布文件没有运行时 import，
无共享 registry，接收调用方的 Zod。协议根模块仍受原 purity gate 约束。

产物核验：

- 与 alpha.2 对照产物相比，host `model`（services、成员、类型、events、objects）完全一致：
  一个 `sessionResume` service、一个 `resume` 方法、两个关联类型；host `.d.ts` 也完全一致。
- 实际构建的 `typert.host.js`、`typert.host.d.ts`、`typert.remote-client.js`、
  `typert.remote-client.d.ts`、`typert.remote-client.d.ts.map`，逐项与 alpha.3
  聚焦 analyzer + 原生 emitter 的结果字节一致。
- alpha.3 的 JS/remote 声明相比 alpha.2 有正常格式升级：`createTypertRemoteInfo`、
  类型化 methods、描述与 JSON Schema、独立 strict input codec；没有回退到旧生成格式。
- 回归测试执行新生成的 host/remote JS，验证端点、参数/返回类型符号、反射成员，
  并验证数字 sessionId、错误或缺失 resumedTurn、额外的命名输入字段都被拒绝。

## 最小复现与上游建议

依赖已安装后执行：

```sh
node scripts/repro-typert-alpha3.mjs
```

脚本仅在临时目录创建两包 fixture：一个带 `Context.typert` / `TypertLookupMap` 的
最小协议镜像，一个导入已发布 session 声明的 `Repro.ping()` 服务。
它验证 alpha.3 `generateContributors(['host'])` 抛出本错误，而聚焦 analyzer 成功，
然后清理 fixture。不需要安装依赖，也不需要 harness checkout。

建议上游将“编译程序需要纳入哪些文件以保留 face-wide augmentation”和
“主动反射哪些服务/对象根”分开：保留全量注册及必要的编译根，
仅对显式选中的贡献包构建反射根。避免未请求产物的协议支持包导致生成无关包失败。
若新增配置，应显式提供 analysis roots / support-package 区分；不能简单忽略外部 merge
或取消 `ensureDeclaration` 的严格检查。上游回归测试还应覆盖未选中包对已选中业务
接口的 augmentation，以保留 alpha.3 扩大程序范围的原本目的。

## 验证与限制

2026-10-15，使用既有 node_modules，Node 26.11.1 / pnpm 11.26.0：

- `pnpm run build`：退出 0，host + client 均通过。
- `pnpm test`：退出 0，5 个文件、14 个测试通过（原 13 个测试全部保留）。
- 最小复现脚本：退出 0，确认预期错误及聚焦分析成功。
- 另对新构建适配器执行 TypeScript strict/noEmit 检查。

沙箱无法写全局 pnpm 版本管理缓存，因此从 npm pack 提取项目锁定的 pnpm 11.26.0
到临时目录，用临时 PATH 执行上述原命令；没有 `pnpm install`、新增依赖或修改锁文件。
用户已做的 SDK 升级 diff 保留。

Vitest 有 SDK 发布包缺失 `dsh-client-ui-primitives/lib/index.js.map` 的非致命警告；
client 构建仍有 tsdown 的 CommonJS/依赖内联提示。
没有操作正式服务、浏览器运行态或 `~/.dsh`，也没有做需要重新安装依赖的干净环境验收。
