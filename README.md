# dsh-session-resume

**An interrupted task, one Continue button.**

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a **Continue** button above the message input when a task was interrupted by a process exit. Reopen the session and choose when to pick up the work—no need to type a continuation prompt.

[中文说明](README.zh.md)

## What to expect

1. DSH exits during a task, for example after a crash, OOM kill, or mid-task restart.
2. Restart DSH and open the original session. Once the host repairs its log, an interruption notice appears above the input.
3. Click **Continue**. The plugin sends continuation guidance ahead of messages already waiting in the queue.
4. The notice disappears when a new turn starts.

The interface follows DSH's Chinese or English language setting. Nothing resumes automatically, and there are no configuration options.

## Install

The current release is **`0.4.0`**, verified against **DSH `0.1.7-alpha.2`**. Other host versions need separate verification.

The plugin ships as one package carrying both the host half and the Web UI half. Its `dsh.client` declaration makes DSH load `./client` automatically, so it needs only one profile installation. These examples use `web`.

### From a local checkout

Build the plugin as described under Development, then install using an actual absolute path:

```sh
dsh plugin --profile web add /path/to/dsh-session-resume/packages/session-resume
```

### From npm

Install the unified package from npm:

```sh
dsh plugin --profile web add @mill413/dsh-session-resume@0.4.0
```

After installation, **restart the DSH Web process and refresh the page**. Do not edit the profile's `cordis.patch.yml` manually; the install commands apply the packages' own bundle declarations.

## Scope and safety

- **Only turns marked `interrupted` by the host are eligible.** Manual cancellation, token limits, ordinary errors, and `blocked` states do not show the button.
- **This is not checkpoint recovery.** It asks the model to continue using the existing conversation. It does not restore process memory or guarantee exact replay from the interruption point.
- **The plugin does not retry tools itself.** Its guidance tells the model to retry only read-only or idempotent operations directly, check external state before other retries, and avoid repeating completed steps. This is model guidance, not a transaction rollback or an exactly-once guarantee.
- **It does not replace goal recovery.** A session with queued background work but no interrupted turn is outside its detection scope.

### No Continue button?

Check that the package is installed in the active profile, then restart Web and refresh the page. The button appears only after the host loads the session and identifies an interrupted turn awaiting continuation. No button on a completed or manually cancelled session is expected.

If clicking returns an error, check whether the session is loaded or a new turn has already started elsewhere. The host rechecks the session before sending the continuation.

## Development

**No Harness source checkout is required.** Development dependencies come from npm, with the DSH SDK pinned to `0.1.7-alpha.2`. Only the local Typert protocol source needed by the generator remains in this repository. Installation, development, and CI do not modify or deploy Harness itself.

Use Node.js 24 to match CI, and pnpm `11.26.0` as declared in `packageManager`. Run from the plugin repository root:

```sh
npm install --global pnpm@11.26.0  # skip if this version is already installed
pnpm install --frozen-lockfile
node --test scripts/release.test.mjs
npm test
npm run build
node scripts/pack-release.mjs
```

The final command validates the package contents and writes one tarball to `dist/`; it does not publish it.

When changing dependencies, run `pnpm install` and commit the updated `pnpm-lock.yaml`. CI uses the frozen lockfile to prevent implicit dependency changes.

| Directory | Responsibility |
| --- | --- |
| `packages/session-resume` | Interruption projection, resume action, model-facing guidance, and the Continue button with Chinese/English UI copy |
| `packages/typert-protocol` | Typert protocol source required by the build |
| `build` | Client bundling configuration |

### Implementation in brief

The `sessionResume` projection records the interrupted turn from a `turn/end` event with `reason.kind === 'interrupted'`, then clears it on the next `turn/start`.

On click, the host rechecks the log, prepends safety guidance to `next-turn`, and sends a short continuation lead through `agent.steer()` to wake the agent. Both messages are plugin-origin `notice` messages, visible to the model and recorded in the session log—not disguised manual input.

## License

[MIT](LICENSE). Extracted Harness build support is attributed in [third-party notices](THIRD_PARTY_NOTICES.md).

## 0.1.7-alpha.2 compatibility

Development SDKs are pinned to npm 0.1.7-alpha.2. The published UI primitives omit runtime dependencies from their manifest; the independent test environment explicitly supplies `clsx`, `simple-icons` and `diff` alongside its Markdown dependencies. No harness checkout is used.
