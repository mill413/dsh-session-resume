# dsh-session-resume

A DeepSeek Harness plugin: when a session was interrupted mid-turn (the Harness
process died — a restart, OOM, or crash), the Web client shows a **Continue**
button; clicking it asks the model to pick up where the interrupted turn left off
— no manual "continue" message. Continuation is strictly user-triggered.

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
pnpm install            # needs a sibling ../deepseek-harness checkout (workspace mirror)
pnpm run build          # host: tsc + tsdown + typert; client: tsc + tsdown clientBundle
pnpm test               # host fold/resume-message + Web dock component tests
```

## Install (from the harness checkout)

```sh
cd /home/haruto/Documents/Code/dsh/deepseek-harness
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/session-resume
pnpm dsh plugin --profile web add ../dsh-session-resume/packages/ui-session-resume
systemctl --user restart dsh-web.service
```

Both `dsh plugin add` invocations install the package into
`$DSH_HOME/profiles/web` and join the profile's bundle layer stack.
