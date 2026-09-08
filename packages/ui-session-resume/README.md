# @mill413/dsh-client-ui-session-resume

Web UI for **dsh-session-resume**. Adds a **Continue** button above the DSH message input when the host identifies an interrupted turn awaiting continuation.

## Install

Requires DSH `0.1.3-alpha.2` and the companion host package. When published to npm, install both into the same profile:

```sh
dsh plugin --profile web add @mill413/dsh-session-resume@0.1.1
dsh plugin --profile web add @mill413/dsh-client-ui-session-resume@0.1.1
```

For a local build, use absolute paths to the two package directories instead. Restart DSH Web and refresh the page after installation.

## Behavior

- Renders in the native `conversation.input.dock` slot, driven by the host's `sessionResume` projection.
- Shows nothing unless an interrupted turn is pending.
- Calls the host's resume action on click; disables the button while the request is pending and displays request errors inline.
- Disappears when a new turn starts. Never resumes automatically.
- Follows the DSH interface language, with Chinese and English copy.

The host sends continuation and tool-safety guidance ahead of queued turns. This UI does not detect interruptions independently or retry tools.

## Development

From the repository root:

```sh
pnpm test
pnpm run build
```

UI copy lives in `src/client/locales.ts`; the component is covered by `tests/resume-dock.client.spec.tsx`. See the root README for source prerequisites and troubleshooting.

## License

MIT
