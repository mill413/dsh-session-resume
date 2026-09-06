# @mill413/dsh-session-resume

Host package for **dsh-session-resume**, a DeepSeek Harness plugin that lets you continue a crash-interrupted task with one click. Requires DSH `0.1.2-alpha.5` and the companion Web UI package.

## Install

When the packages are available on npm, install both into the same profile:

```sh
dsh plugin --profile web add @mill413/dsh-session-resume
dsh plugin --profile web add @mill413/dsh-client-ui-session-resume
```

For local installation, build the repository and replace the package names with absolute paths to `packages/session-resume` and `packages/ui-session-resume`. Restart DSH Web and refresh the page after installation. Do not manually edit the profile's bundle patch.

## Behavior

- Derives the `sessionResume` projection from the host's repaired session log. Only `turn/end` events with `reason.kind === 'interrupted'` qualify; the next `turn/start` clears the state.
- Exposes the `resume` remote action, which checks the live session again before sending anything.
- Prepends tool-safety guidance to `next-turn`, then uses `agent.steer()` to deliver a short continuation lead ahead of queued turns.
- Sends two plugin-origin `notice` messages, recorded in the conversation and visible to the model. It does not impersonate manual input or change the system prompt.

Continuation is user-triggered, with no configuration options. The guidance asks the model to avoid repeating completed steps and to verify external state before retrying non-idempotent operations. It is not an exactly-once execution guarantee, and the plugin does not recover process memory.

Manual cancellation, token limits, ordinary errors, blocked turns, and idle goal work do not trigger this feature.

## Development

From the repository root, with a sibling `../deepseek-harness` checkout:

```sh
pnpm install
pnpm test
pnpm run build
```

See the repository's root README for the full installation and troubleshooting guide.

## License

MIT
