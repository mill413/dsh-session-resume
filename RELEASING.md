# 发布到 npm

本仓库通过 `.github/workflows/release.yml` 测试、构建并发布两个包：

- `@mill413/dsh-session-resume`：宿主能力。
- `@mill413/dsh-client-ui-session-resume`：Web 界面。

只发布这两个包，不发布仓库根包或 `packages/typert-protocol`，也不会构建、部署或重启 DSH 服务。

## 触发规则

| 操作 | 结果 |
| --- | --- |
| 提交到 `main` / `master`、发起 Pull Request | 测试、构建、打包，上传 `npm-packages` artifact |
| Actions 页面手动运行 | 同上；不会发布 npm |
| 推送 `v*` tag | 通过上述检查后发布 npm |

两个包的 `version` 必须一致，并与 tag 严格匹配。例如两个包均为 `0.1.0`，tag 就是 `v0.1.0`。稳定版发布到 `latest`；`0.2.0-rc.1` 这样的预发布版发布到 `next`。

发布流程不会自动改版本、创建 tag 或 GitHub Release。创建 GitHub Release 时，如果它新建并推送了 tag，同样会触发 tag 流水线。

## 首次配置

### 1. GitHub 仓库

将此仓库上传到自己的 **公开 GitHub 仓库**，启用 Actions。workflow 同时支持 `main` 与 `master`；使用其他主分支名称时修改 `push.branches`。

在 **Settings → Environments** 创建名为 **`npm`** 的 environment。建议设置发布审批及 tag 限制，保护 npm 发布权限。

不必在配置文件中填写 GitHub 用户名：打包脚本会根据 `GITHUB_REPOSITORY` 为两个 npm 包写入正确的 repository、homepage 和 issues 链接。打包时还会去掉仅开发使用的 devDependencies，避免发布 workspace 引用；完成或失败后恢复原清单，不改写工作区文件。

### 2. npm 身份与包名

默认包名使用 `@mill413` scope。发布账号必须拥有该 scope 的发布权限。如果要换成自己的 scope，需要同步修改两个包名、UI 对宿主包的依赖与注入声明、源码中的包引用、bundle patch 以及相关测试，不能只改发布脚本。

认证有两种方式：

#### 推荐：Trusted Publishing（OIDC）

包已在 npm 上存在时，分别在 **两个包** 的 npm 设置里添加 GitHub Actions trusted publisher：

| 字段 | 填写内容 |
| --- | --- |
| Organization or user | GitHub 仓库所有者 |
| Repository | GitHub 仓库名，不带所有者前缀 |
| Workflow filename | `release.yml` |
| Environment name | `npm` |
| Allowed actions（如显示） | 允许直接 `npm publish` |

workflow 已配置 `id-token: write` 和支持 OIDC 的 npm CLI；**无需保存长期 npm token**。切换到 OIDC 后删除 `NPM_TOKEN` secret 并撤销旧 token，避免保留多余的写入凭据。

配置要求以 [npm Trusted Publishing 官方说明](https://docs.npmjs.com/trusted-publishers/) 为准。

#### 首次创建包，或使用 token 认证

新包还不存在时，通常需要先用 npm token 完成首次发布，再为包设置 trusted publisher。

1. 在 npm 创建具有目标 scope/package 写权限的 **granular access token**；自动发布需要允许无人值守发布的 2FA 设置，并遵守账号或组织策略。权限和有效期尽量收窄。
2. 在 GitHub 的 `npm` environment 中添加 secret **`NPM_TOKEN`**。
3. 推送发布 tag。workflow 仅在 publish job 中把 secret 传给 npm，构建和 PR 不接触发布凭据。
4. 首次发布后可配置 OIDC，并撤销 token、删除 secret。

不要把 token 写进 `.npmrc`、workflow 文件或提交记录。workflow 固定发布到 `https://registry.npmjs.org`，并开启 public access 和 provenance。

## 发布一个版本

1. 同时修改以下两个文件中的 `version`：
   - `packages/session-resume/package.json`
   - `packages/ui-session-resume/package.json`
2. 如依赖发生变化，使用仓库指定的 pnpm 版本更新并提交 `pnpm-lock.yaml`。
3. 本地检查：

   ```sh
   pnpm install --frozen-lockfile
   node --test scripts/release.test.mjs
   npm test
   npm run build
   node scripts/pack-release.mjs
   ```

   当前仓库如尚未配置 remote，先添加实际 GitHub 仓库地址，并将 `.github/`、`scripts/`、lockfile 和文档一并提交。

   最后一步只生成 `dist/` 下的两个 `.tgz` 和 `release.json`，不会上传 npm。打包检查会确认入口、类型声明、README、许可证和 bundle patch 都已包含在包里。

4. 提交改动，确认主分支 CI 通过，再推送对应 tag。例如包版本为 `0.1.0` 时：

   ```sh
   git push origin HEAD  # 推送当前主分支
   git tag v0.1.0
   git push origin v0.1.0
   ```

5. 在 Actions 页面查看 build / publish 结果。如果设置了 environment 审批，批准后才会发布。

发布 job 下载 build job 已验证的 tarball，校验 SHA-512 后直接发布，不在持有凭据的 job 中重新安装插件开发依赖或构建源码。

## 失败与重试

- **版本不匹配**：修正两个包版本和 tag 的对应关系。不要移动已经成功发布的 tag，也不要尝试覆盖 npm 的已有版本。
- **构建或测试失败**：publish job 不会运行；先修复问题。
- **401 / 403**：检查 scope 权限、token 的有效期与发布权限，或两个包的 OIDC 设置。workflow 文件名、仓库和 environment 必须完全一致。
- **只发布了一个包**：npm 不支持两个包的原子发布。可重新运行失败的发布任务；脚本跳过已存在的同版本包，并发布剩余包。已存在版本不会被覆盖，跳过时也不会重新设置 dist-tag。
- **网络或 registry 查询失败**：只有明确的 `E404` 才被视为版本不存在，其他错误会中止发布，避免把认证失败当成首次发布。

手动运行 workflow 仅用于验收构建，不会绕过 tag 检查发布。真正的 npm 发布与 GitHub 托管 runner 执行，需要仓库上传及上述身份配置完成后才能验证。
