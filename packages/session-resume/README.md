# @mill413/dsh-session-resume

The **dsh-session-resume** plugin for DeepSeek Harness: it lets you continue a crash-interrupted task with one click. One package carries the host half (interruption projection, resume action, model-facing guidance) and the browser half (`./client`, the composer Continue strip). Requires DSH `0.1.3-alpha.2`.

## Install

After publication, install the package into the profile using that installation’s DSH CLI:

```sh
dsh plugin --profile web add @mill413/dsh-session-resume@0.1.1
```

For local installation, build the repository and use the absolute path to `packages/session-resume`. Restart DSH Web and refresh the page after installation. Do not manually edit the profile's bundle patch.

## Behavior

- Derives the `sessionResume` projection from the host's repaired session log. Only `turn/end` events with `reason.kind === 'interrupted'` qualify; the next `turn/start` clears the state.
- Exposes the `resume` remote action, which checks the live session again before sending anything.
- Prepends tool-safety guidance to `next-turn`, then uses `agent.steer()` to deliver a short continuation lead ahead of queued turns.
- Sends two plugin-origin `notice` messages, recorded in the conversation and visible to the model. It does not impersonate manual input or change the system prompt.

Continuation is user-triggered, with no configuration options. The guidance asks the model to avoid repeating completed steps and to verify external state before retrying non-idempotent operations. It is not an exactly-once execution guarantee, and the plugin does not recover process memory.

Manual cancellation, token limits, ordinary errors, blocked turns, and idle goal work do not trigger this feature.

## Development

No Harness source checkout is needed. Use Node.js 24 and pnpm 11.3.0; the SDK development dependencies are pinned npm packages. From the repository root:

```sh
pnpm install --frozen-lockfile
npm test
npm run build
```

See the repository's root README for the full installation and troubleshooting guide.

## License

MIT
