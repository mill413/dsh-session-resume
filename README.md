# dsh-session-resume

A DeepSeek Harness plugin: when a session was interrupted by a Harness restart,
the Web client shows a **Continue** button; clicking it asks the model to pick up
where the interrupted turn left off — no manual "continue" message.

See [packages/session-resume/README.md](packages/session-resume/README.md) for the
full design, install, and model-experience notes.

## Layout

```
packages/session-resume/        host package (@deepseek-ai/dsh-session-resume)
packages/ui-session-resume/     Web client package (@deepseek-ai/dsh-client-ui-session-resume)
packages/typert-protocol/       Typert Remote protocol (workspace copy)
build/                          extracted clientBundle preset + platform table
```

## Build / test

```sh
pnpm install
pnpm run build
pnpm test
```

## Install (from the harness checkout)

```sh
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/session-resume
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/ui-session-resume
```

Then rebuild the web bundle and restart the profile (see the workspace
AGENTS.md).
