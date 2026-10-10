# DSH 0.2.1-alpha.2

目标宿主为 npm 发布的 `@deepseek-ai/dsh@0.2.1-alpha.2`，从本机 0.2.0-rc.2 升级。DSH SDK 固定目标版本；Cordis 4.0.5-alpha.1、Schemastery 3.18.5-alpha.1 及相关组件来自 npm。运行时共享模块继续使用 peer 与客户端注入。

移除上游已废弃的空 invariant 伴生模块、导出、构建入口及依赖。插件主功能保留。

独立验收使用仅含本仓库的临时 checkout，冻结安装后运行仓库声明的测试、类型检查、构建和打包检查。正式安装使用目标 runtime 的 `dsh plugin --profile web add` 加载本地 tarball。
