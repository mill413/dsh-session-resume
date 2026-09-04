# @mill413/dsh-client-ui-session-resume

Web client half of the `dsh-session-resume` plugin. It renders a **Continue** strip in
the `conversation.input.dock` slot (the same composer-stack family as the goal bar,
todo, and queue docks), driven entirely by the host's `sessionResume` projection.

## Behavior

- Reads `useProjection('sessionResume')`. When `interruptedTurn != null`, it shows a
  Continue button; otherwise it renders nothing.
- Clicking Continue calls the host `@Remote('resume')` with the wire `sessionId`, which
  queues a plugin-origin `notice` asking the model to continue the interrupted turn.
- It owns no store and no projection logic — it is a pure view over the projection the
  host already publishes through `session/projection` frames.

## UI copy

The strip label and button text live in a typed locale dictionary
(`src/client/locales.ts`, `zh` and `en` sets) and follow the UI language. They are not
hardcoded in the component and are not deployment-configurable; the model-facing
continuation text is pinned in the host package's `src/resume.ts`.

## Development

Built via `tsdown` using the `clientBundle` preset (see `build/` at the repo root). The
composer-dock component test lives in `tests/resume-dock.client.spec.tsx`.

```sh
pnpm run build   # from the repo root: tsc + tsdown for the client package
pnpm test        # from the repo root: runs the Web dock component tests
```

Published through `dsh.client.inject` (platform `web`); the package's `cordis.patch.yml`
joins the profile's bundle layer stack when installed with `dsh plugin add`.
